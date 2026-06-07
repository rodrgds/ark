import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { SAFETY_COPY } from '@/constants/app';
import { createArkAiSdkTools } from '@/services/ai/ai-sdk-tools';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { ContentPackService } from '@/services/content/content-pack.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import type { AiAdapterResponse, AiAdapterSendInput, AiCitation } from '@/types/ai';

type ReactNativeAiLlamaModule = typeof import('@react-native-ai/llama');
type LlamaLanguageModel = ReturnType<ReactNativeAiLlamaModule['llama']['languageModel']>;

let llamaModulePromise: Promise<ReactNativeAiLlamaModule | null> | null = null;
let modelPromise: Promise<LlamaLanguageModel | null> | null = null;
let modelPromiseKey: string | null = null;
let activeAbortController: AbortController | null = null;
let activeModel: LlamaLanguageModel | null = null;

const COMPLETION_TIMEOUT_MS = 60_000;

export function resetLlamaAdapterForTests() {
  llamaModulePromise = null;
  modelPromise = null;
  modelPromiseKey = null;
  activeAbortController = null;
  activeModel = null;
}

export function resetLlamaRuntimeContext() {
  modelPromise = null;
  modelPromiseKey = null;
  activeAbortController = null;
  activeModel = null;
}

export class LlamaAdapter {
  readonly id = 'llama';

  async isAvailable(selectedModelId?: string | null) {
    const [module, model] = await Promise.all([loadLlamaModule(), getInstalledModel(selectedModelId)]);
    return !!module && !!model?.localUri;
  }

  async sendMessage(input: AiAdapterSendInput): Promise<AiAdapterResponse> {
    const model = await getLanguageModel(input.selectedModelId);
    if (!model) {
      return {
        content:
          'No on-device AI runtime is available in this build. Download an answer model and use a build with local AI enabled.',
        citations: input.citations,
      };
    }

    const abortController = new AbortController();
    activeAbortController = abortController;
    activeModel = model;
    const combinedCitations = [...input.citations];
    let rawText = '';
    let visibleText = '';
    let channelReasoning = '';
    let sdkReasoning = '';

    const timeoutHandle = setTimeout(() => {
      abortController.abort(new Error('Local model completion timed out.'));
    }, COMPLETION_TIMEOUT_MS);

    try {
      const result = streamText({
        model,
        system: buildSystemPrompt(),
        messages: buildMessages(input),
        tools: createArkAiSdkTools({
          onRun: (run) => {
            mergeCitations(combinedCitations, run.citations);
          },
        }),
        toolChoice: 'auto',
        stopWhen: stepCountIs(3),
        maxOutputTokens: 640,
        temperature: 0.2,
        abortSignal: abortController.signal,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'start-step') {
          rawText = '';
          visibleText = '';
          channelReasoning = '';
          sdkReasoning = '';
        } else if (part.type === 'text-delta') {
          rawText += part.text;
          const normalized = normalizeReasoningOutput(rawText);
          visibleText = normalized.content;
          channelReasoning = normalized.reasoning;
          if (visibleText) input.onToken?.(visibleText);
        } else if (part.type === 'reasoning-delta') {
          sdkReasoning += part.text;
          const nextReasoning = joinReasoning(sdkReasoning, channelReasoning);
          if (nextReasoning) input.onReasoning?.(nextReasoning);
        } else if (part.type === 'tool-result') {
          const output = part.output as unknown;
          if (isArkToolOutput(output)) mergeCitations(combinedCitations, output.citations);
        }
        const nextReasoning = joinReasoning(sdkReasoning, channelReasoning);
        if (part.type === 'text-delta' && nextReasoning) input.onReasoning?.(nextReasoning);
      }
    } catch (error) {
      const reason = abortController.signal.reason;
      const message = reason instanceof Error ? reason.message : 'Local model completion failed.';
      throw new Error(message, { cause: error });
    } finally {
      clearTimeout(timeoutHandle);
      if (activeAbortController === abortController) activeAbortController = null;
      if (activeModel === model) activeModel = null;
    }

    return {
      content: visibleText.trim() || 'The local model returned an empty response.',
      citations: combinedCitations,
      reasoning: joinReasoning(sdkReasoning, channelReasoning) || undefined,
    };
  }

  async cancelActiveCompletion() {
    activeAbortController?.abort();
    await activeModel
      ?.getContext()
      ?.stopCompletion()
      .catch(() => undefined);
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
    llamaModulePromise = import('@react-native-ai/llama').catch(() => null);
  }
  return llamaModulePromise;
}

async function getLanguageModel(selectedModelId?: string | null) {
  const key = selectedModelId ?? '__default__';
  if (!modelPromise || modelPromiseKey !== key) {
    modelPromiseKey = key;
    modelPromise = (async () => {
      const [module, model] = await Promise.all([loadLlamaModule(), getInstalledModel(selectedModelId)]);
      if (!module || !model?.localUri) return null;
      const languageModel = module.llama.languageModel(model.localUri, {
        contextParams: {
          n_ctx: contextTokensForModel(model.sizeBytes ?? null),
          n_gpu_layers: 0,
          ctx_shift: true,
        },
      });
      await languageModel.prepare();
      return languageModel;
    })().catch(() => null);
  }
  return modelPromise;
}

async function getInstalledModel(selectedModelId?: string | null) {
  if (selectedModelId === undefined && (await PreferencesService.getAiChatModelDisabled())) {
    return null;
  }
  const models = (await ContentPackService.listPacks()).filter(
    (pack) =>
      pack.category === 'AI Models' &&
      pack.installed &&
      pack.localUri &&
      !isEmbeddingModelPack(pack)
  );
  const selectedId = selectedModelId ?? (await PreferencesService.getSelectedAiModelId());
  return models.find((model) => model.id === selectedId) ?? models[0] ?? null;
}

function buildSystemPrompt() {
  return [
    'You are Arky, an offline survival-grade assistant for practical emergency, field, and self-reliance questions.',
    'Answer the user directly and keep continuity with the conversation history. Resolve short follow-ups such as "why not?" against the previous user and assistant turns.',
    'Use local tool results and opened source context when they are relevant. If retrieved sources are weak, irrelevant, or incomplete, say that briefly and answer from general survival knowledge instead of pretending the sources answer the question.',
    'When using retrieved local sources, cite them inline with their source number like [1] or [2]. Cite only the specific source that supports that sentence.',
    'Do not include hidden reasoning, analysis channels, or scratchpad text in the final answer. If the model has a separate final channel, move to it promptly.',
    'Do not refuse ordinary survival skills such as making fishing hooks, knots, shelter, fire, water storage, food procurement, navigation, tool repair, or improvised non-weapon field gear. Include practical cautions, local-law reminders, and safer alternatives where useful.',
    'Refuse instructions for harming people, traps intended for people, explosives, poisons, or evading law enforcement.',
    `Safety note to include when advice is high-stakes: ${SAFETY_COPY.ai}`,
  ].join('\n');
}

function buildMessages(input: AiAdapterSendInput): ModelMessage[] {
  return [
    ...(input.history ?? []).flatMap((message): ModelMessage[] =>
      message.role === 'user' || message.role === 'assistant'
        ? [
            {
              role: message.role,
              content: message.content,
            },
          ]
        : []
    ),
    {
      role: 'user',
      content: [
        `Tools already used:\n${formatToolTrace(input)}`,
        `Retrieved local sources:\n${formatCitations(input.citations)}`,
        `Opened source context:\n${formatSourceContext(input)}`,
        `User question:\n${input.content}`,
      ].join('\n\n'),
    },
  ];
}

function formatToolTrace(input: AiAdapterSendInput) {
  return input.toolTrace?.length
    ? input.toolTrace.map((entry) => `- ${entry.summary}`).join('\n')
    : 'No tools used yet.';
}

function formatCitations(citations: AiCitation[]) {
  if (!citations.length) return 'No retrieved sources yet.';
  return citations
    .map((citation, index) => {
      const location = [
        citation.sectionTitle ? `section ${citation.sectionTitle}` : null,
        typeof citation.page === 'number' ? `page ${citation.page}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      return `${index + 1}. ${citation.title}: ${citation.snippet}${
        location ? ` (${location})` : ''
      }`;
    })
    .join('\n');
}

function formatSourceContext(input: AiAdapterSendInput) {
  if (!input.sourceContext?.length) return 'No expanded source content yet.';
  return input.sourceContext
    .map((source, index) => `${index + 1}. ${source.title}\n${source.content.slice(0, 1200)}`)
    .join('\n\n');
}

function mergeCitations(target: AiCitation[], citations: AiCitation[]) {
  for (const citation of citations) {
    const key = `${citation.sourceId}:${citation.sourceRef ?? ''}:${citation.sectionTitle ?? ''}:${
      citation.page ?? ''
    }`;
    if (
      !target.some(
        (item) =>
          `${item.sourceId}:${item.sourceRef ?? ''}:${item.sectionTitle ?? ''}:${item.page ?? ''}` ===
          key
      )
    ) {
      target.push(citation);
    }
  }
}

function isArkToolOutput(
  value: unknown
): value is { citations: AiCitation[]; summary: string; sources: unknown[] } {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { citations?: unknown }).citations)
  );
}

function joinReasoning(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

function contextTokensForModel(sizeBytes: number | null) {
  if (!sizeBytes) return 2048;
  if (sizeBytes > 2.5 * 1024 * 1024 * 1024) return 1536;
  return 2048;
}
