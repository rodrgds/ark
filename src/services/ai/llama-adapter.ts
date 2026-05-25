import { SAFETY_COPY } from '@/constants/app';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ARK_LLAMARN_TOOLS, executeArkToolCall } from '@/services/ai/ark-tool-executor';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { normalizeAssistantTurn, stripHiddenModelOutput } from '@/services/ai/response-normalizer';
import type { AiAdapterResponse } from '@/types/ai';
import type { AiAdapterSendInput } from '@/types/ai';

type LlamaModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaModule['initLlama']>>;
type LlamaMessage = {
  role: string;
  content?: string;
  tool_calls?: Array<{
    type: 'function';
    id?: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

let llamaModulePromise: Promise<LlamaModule | null> | null = null;
let contextPromise: Promise<LlamaContext | null> | null = null;
let activeCompletionContext: LlamaContext | null = null;

export function resetLlamaAdapterForTests() {
  llamaModulePromise = null;
  contextPromise = null;
  activeCompletionContext = null;
}

export function resetLlamaRuntimeContext() {
  contextPromise = null;
  activeCompletionContext = null;
}

export class LlamaAdapter {
  readonly id = 'llama';

  async isAvailable() {
    const [module, model] = await Promise.all([loadLlamaModule(), getInstalledModelUri()]);
    return !!module && !!model;
  }

  async sendMessage(input: AiAdapterSendInput): Promise<AiAdapterResponse> {
    const context = await getContext();
    if (!context) {
      return {
        content:
          'No on-device AI runtime is available in this build. Download an answer model and use a build with local AI enabled.',
        citations: input.citations,
      };
    }
    const sourceText = input.citations.length
      ? input.citations
          .map((citation, index) => `${index + 1}. ${citation.title}: ${citation.snippet}`)
          .map((line, index) => {
            const citation = input.citations[index];
            const location = [
              citation.sectionTitle ? `section ${citation.sectionTitle}` : null,
              typeof citation.page === 'number' ? `page ${citation.page}` : null,
            ]
              .filter(Boolean)
              .join(', ');
            return location ? `${line} (${location})` : line;
          })
          .join('\n')
      : 'No retrieved sources.';
    const sourceContextText =
      input.sourceContext && input.sourceContext.length
        ? input.sourceContext
            .map(
              (source, index) => `${index + 1}. ${source.title}\n${source.content.slice(0, 1200)}`
            )
            .join('\n\n')
        : 'No expanded source content.';
    const toolTraceText =
      input.toolTrace?.map((entry) => `- ${entry.summary}`).join('\n') ?? 'No tools used.';
    let streamedText = '';
    activeCompletionContext = context;
    const messages: LlamaMessage[] = [
      {
        role: 'system',
        content: [
          'You are Arky, an offline survival-grade assistant for practical emergency, field, and self-reliance questions.',
          'Answer the user directly and keep continuity with the conversation history. Resolve short follow-ups such as "why not?" against the previous user and assistant turns.',
          'Use local tool results and opened source context when they are relevant. If retrieved sources are weak, irrelevant, or incomplete, say that briefly and answer from general survival knowledge instead of pretending the sources answer the question.',
          'Do not refuse ordinary survival skills such as making fishing hooks, knots, shelter, fire, water storage, food procurement, navigation, tool repair, or improvised non-weapon field gear. Include practical cautions, local-law reminders, and safer alternatives where useful.',
          'Refuse instructions for harming people, traps intended for people, explosives, poisons, or evading law enforcement.',
          'Never print chat-template control tokens such as <|channel|>, thought, analysis, or final in the visible answer.',
          `Safety note to include when advice is high-stakes: ${SAFETY_COPY.ai}`,
        ].join('\n'),
      },
      ...(input.history ?? []).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'user',
        content: `Tools already used:\n${toolTraceText}\n\nRetrieved local sources:\n${sourceText}\n\nOpened source context:\n${sourceContextText}\n\nUser question:\n${input.content}`,
      },
    ];
    const combinedCitations = [...input.citations];
    let turn;
    try {
      let result = await completeWithLlama(
        context,
        messages,
        (content) => {
          streamedText = content;
          if (streamedText) input.onToken?.(streamedText);
        },
        (reasoning) => input.onReasoning?.(reasoning)
      );

      turn = normalizeAssistantTurn(result);
      if (turn.reasoning) input.onReasoning?.(turn.reasoning);
      for (let iteration = 0; iteration < 2 && turn.toolCalls.length; iteration += 1) {
        messages.push({
          role: 'assistant',
          content: turn.content || '',
          tool_calls: turn.toolCalls.map((call) => ({
            type: 'function',
            id: call.id,
            function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
          })),
        });

        for (const call of turn.toolCalls) {
          const executed = await executeArkToolCall(call).catch((error) => ({
            call,
            output: {
              citations: [],
              sourceContext: [],
              toolTrace: [
                {
                  tool: 'search_local_knowledge' as const,
                  summary:
                    error instanceof Error
                      ? `Tool call rejected: ${error.message}`
                      : 'Tool call rejected.',
                },
              ],
            },
          }));
          for (const citation of executed.output.citations) {
            if (!combinedCitations.some((item) => item.sourceId === citation.sourceId)) {
              combinedCitations.push(citation);
            }
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              summary: executed.output.toolTrace.map((entry) => entry.summary),
              sources: executed.output.sourceContext.map((source) => ({
                title: source.title,
                content: source.content.slice(0, 1200),
              })),
            }),
          });
        }

        streamedText = '';
        result = await completeWithLlama(
          context,
          messages,
          (content) => {
            streamedText = content;
            if (streamedText) input.onToken?.(streamedText);
          },
          (reasoning) => input.onReasoning?.(reasoning)
        );
        turn = normalizeAssistantTurn(result);
        if (turn.reasoning) input.onReasoning?.(turn.reasoning);
      }

      if (!turn.content && turn.reasoning && !turn.toolCalls.length) {
        streamedText = '';
        const finalResult = await completeWithLlama(
          context,
          [
            ...messages,
            {
              role: 'user',
              content:
                'Return the final answer to the last user question now. Do not include hidden reasoning, analysis notes, or channel markers.',
            },
          ],
          (content) => {
            streamedText = content;
            if (streamedText) input.onToken?.(streamedText);
          },
          (reasoning) => input.onReasoning?.(reasoning),
          { enableThinking: false, useTools: false }
        );
        const finalTurn = normalizeAssistantTurn(finalResult);
        turn = { ...finalTurn, reasoning: turn.reasoning || finalTurn.reasoning };
      }
    } finally {
      if (activeCompletionContext === context) activeCompletionContext = null;
    }

    return {
      content:
        turn.content ||
        stripHiddenModelOutput(streamedText) ||
        'The local model returned an empty response.',
      citations: combinedCitations,
      reasoning: turn.reasoning,
    };
  }

  async cancelActiveCompletion() {
    await activeCompletionContext?.stopCompletion().catch(() => undefined);
  }

  async getRuntimeStatus() {
    const [module, model] = await Promise.all([loadLlamaModule(), getInstalledModel()]);
    return {
      moduleAvailable: !!module,
      modelUri: model?.localUri ?? null,
      modelTitle: model?.title ?? null,
      contextTokens: contextTokensForModel(model?.sizeBytes ?? null),
      maxResponseTokens: 640,
    };
  }
}

async function loadLlamaModule() {
  if (!llamaModulePromise) {
    llamaModulePromise = import('llama.rn').catch(() => null);
  }
  return llamaModulePromise;
}

async function getInstalledModelUri() {
  return (await getInstalledModel())?.localUri ?? null;
}

async function getInstalledModel() {
  if (await PreferencesService.getAiChatModelDisabled()) return null;
  const models = (await ContentPackService.listPacks()).filter(
    (pack) =>
      pack.category === 'AI Models' &&
      pack.installed &&
      pack.localUri &&
      !isEmbeddingModelPack(pack)
  );
  const selectedId = await PreferencesService.getSelectedAiModelId();
  return models.find((model) => model.id === selectedId) ?? models[0] ?? null;
}

async function getContext() {
  if (!contextPromise) {
    contextPromise = (async () => {
      const module = await loadLlamaModule();
      const model = await getInstalledModel();
      if (!module || !model?.localUri) return null;
      return module.initLlama({
        model: model.localUri,
        n_ctx: contextTokensForModel(model.sizeBytes ?? null),
        n_gpu_layers: 0,
        ctx_shift: true,
      });
    })().catch(() => null);
  }
  return contextPromise;
}

async function completeWithLlama(
  context: LlamaContext,
  messages: LlamaMessage[],
  onContent: (content: string) => void,
  onReasoning: (content: string) => void,
  options: { enableThinking?: boolean; useTools?: boolean } = {}
) {
  let streamedText = '';
  let streamedReasoning = '';
  const enableThinking = options.enableThinking ?? true;
  const useTools = options.useTools ?? true;
  return context.completion(
    {
      messages: messages as never,
      ...(useTools ? { tools: ARK_LLAMARN_TOOLS, tool_choice: 'auto' } : {}),
      jinja: true,
      enable_thinking: enableThinking,
      reasoning_format: 'auto',
      chat_template_kwargs: {
        enable_thinking: enableThinking,
        thinking: enableThinking,
      },
      n_predict: 640,
      temperature: 0.2,
    },
    (data) => {
      const reasoning =
        data.reasoning_content ??
        (data as { accumulated_reasoning_content?: string }).accumulated_reasoning_content;
      if (reasoning && reasoning !== streamedReasoning) {
        streamedReasoning = reasoning;
        onReasoning(streamedReasoning);
      }
      const next = data.content ?? data.accumulated_text ?? `${streamedText}${data.token ?? ''}`;
      streamedText = stripHiddenModelOutput(next);
      if (streamedText) onContent(streamedText);
    }
  );
}

function contextTokensForModel(sizeBytes: number | null) {
  if (!sizeBytes) return 2048;
  if (sizeBytes > 2.5 * 1024 * 1024 * 1024) return 1536;
  return 2048;
}
