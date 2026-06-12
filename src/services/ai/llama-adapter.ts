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

const COMPLETION_TIMEOUT_MS = 120_000;
const ANSWER_MAX_OUTPUT_TOKENS = 2048;
const REPAIR_MAX_OUTPUT_TOKENS = 1024;

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
    const completedStepRawText: string[] = [];
    const completedStepVisibleText: string[] = [];
    const completedStepChannelReasoning: string[] = [];
    let stepRawText = '';
    let stepVisibleText = '';
    let stepChannelReasoning = '';
    let sdkReasoning = '';

    const finishCurrentStep = () => {
      if (!stepRawText && !stepVisibleText && !stepChannelReasoning) return;
      completedStepRawText.push(stepRawText);
      completedStepVisibleText.push(stepVisibleText);
      completedStepChannelReasoning.push(stepChannelReasoning);
      stepRawText = '';
      stepVisibleText = '';
      stepChannelReasoning = '';
    };

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
        maxOutputTokens: ANSWER_MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        abortSignal: abortController.signal,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'start-step') {
          finishCurrentStep();
        } else if (part.type === 'text-delta') {
          stepRawText += getTextDelta(part);
          const normalized = normalizeReasoningOutput(stepRawText);
          stepVisibleText = normalized.content;
          stepChannelReasoning = normalized.reasoning;
          const streamingText = latestNonEmpty([...completedStepVisibleText, stepVisibleText]);
          if (streamingText) input.onToken?.(streamingText);
        } else if (part.type === 'reasoning-delta') {
          sdkReasoning += getTextDelta(part);
          const nextReasoning = joinReasoning(sdkReasoning, stepChannelReasoning);
          if (nextReasoning) input.onReasoning?.(nextReasoning);
        } else if (part.type === 'tool-result') {
          const output = part.output as unknown;
          if (isArkToolOutput(output)) mergeCitations(combinedCitations, output.citations);
        }
        const nextReasoning = joinReasoning(sdkReasoning, stepChannelReasoning);
        if (part.type === 'text-delta' && nextReasoning) input.onReasoning?.(nextReasoning);
      }
      finishCurrentStep();
    } catch (error) {
      const reason = abortController.signal.reason;
      const message = reason instanceof Error ? reason.message : 'Local model completion failed.';
      throw new Error(message, { cause: error });
    } finally {
      clearTimeout(timeoutHandle);
      if (activeAbortController === abortController) activeAbortController = null;
      if (activeModel === model) activeModel = null;
    }

    let finalText = recoverFinalText(
      completedStepRawText,
      completedStepVisibleText,
      sdkReasoning
    );
    let finalReasoning = recoverReasoningText(
      completedStepRawText,
      sdkReasoning,
      completedStepChannelReasoning
    );
    if (isReasoningLeak(finalText)) {
      finalReasoning = joinReasoning(finalReasoning, finalText);
      finalText = '';
    }
    if (!finalText && finalReasoning) {
      const repaired = await repairMissingFinalAnswer(model, input, finalReasoning);
      finalText = isReasoningLeak(repaired.content) ? '' : repaired.content;
      finalText ||= buildGroundedFallbackAnswer(input);
      finalReasoning = joinReasoning(finalReasoning, repaired.reasoning);
    }

    return {
      content: finalText || buildGroundedFallbackAnswer(input) || 'I could not generate a useful local answer for that message.',
      citations: combinedCitations,
      reasoning: finalReasoning || undefined,
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
      maxResponseTokens: ANSWER_MAX_OUTPUT_TOKENS,
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

async function repairMissingFinalAnswer(
  model: LlamaLanguageModel,
  input: AiAdapterSendInput,
  reasoning: string
) {
  let rawText = '';
  let sdkReasoning = '';
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort(new Error('Local model final-answer repair timed out.'));
  }, 60_000);

  try {
    const result = streamText({
      model,
      system: buildSystemPrompt(),
      messages: [
        ...buildMessages(input),
        {
          role: 'assistant',
          content: [
            'I have enough information to answer.',
            'Next I will provide only the final user-facing answer, without analysis, scratchpad, hidden reasoning, or a thinking process.',
            `Relevant internal summary:\n${reasoning.slice(0, 1800)}`,
          ].join('\n\n'),
        },
        {
          role: 'user',
          content: `Answer this now, directly and concisely:\n${input.content}`,
        },
      ],
      maxOutputTokens: REPAIR_MAX_OUTPUT_TOKENS,
      temperature: 0.1,
      abortSignal: abortController.signal,
    });

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        rawText += getTextDelta(part);
      } else if (part.type === 'reasoning-delta') {
        sdkReasoning += getTextDelta(part);
      }
    }
  } catch {
    return { content: '', reasoning: '' };
  } finally {
    clearTimeout(timeoutHandle);
  }

  const normalizedText = normalizeReasoningOutput(rawText, {
    recoverFinalFromUnclosedReasoning: true,
  });
  const normalizedReasoning = normalizeReasoningOutput(sdkReasoning, {
    recoverFinalFromUnclosedReasoning: true,
  });

  return {
    content: normalizedText.content || recoverExplicitFinalFromReasoning(sdkReasoning),
    reasoning: joinReasoning(normalizedText.reasoning, normalizedReasoning.reasoning || sdkReasoning),
  };
}

function buildGroundedFallbackAnswer(input: AiAdapterSendInput) {
  const sourceFacts = [
    ...(input.sourceContext ?? []).flatMap((source, index) =>
      source.content
        .split(/\n+/)
        .map((line) => cleanSourceFact(line))
        .filter(Boolean)
        .slice(0, 3)
        .map((line) => ({ text: line, citation: `[${index + 1}]` }))
    ),
    ...input.citations
      .map((citation, index) => cleanSourceFact(citation.snippet))
      .filter(Boolean)
      .map((line, index) => ({ text: line, citation: `[${index + 1}]` })),
  ];
  const uniqueFacts = dedupeFacts(sourceFacts).slice(0, 5);
  if (!uniqueFacts.length) return '';

  const lead = answerLeadForQuestion(input.content);
  const body = uniqueFacts
    .map(({ text, citation }) => `- ${ensureSentence(text)} ${citation}`)
    .join('\n');
  return `${lead}\n\n${body}`;
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

function recoverFinalText(rawText: string[], visibleText: string[], sdkReasoning: string) {
  const direct = latestNonEmpty(visibleText);
  if (direct) return direct;

  for (const raw of rawText.slice().reverse()) {
    const normalizedRaw = normalizeReasoningOutput(raw, {
      recoverFinalFromUnclosedReasoning: true,
    });
    if (normalizedRaw.content) return normalizedRaw.content;
  }

  return recoverExplicitFinalFromReasoning(sdkReasoning);
}

function recoverReasoningText(rawText: string[], sdkReasoning: string, channelReasoning: string[]) {
  const normalizedReasoning = normalizeReasoningOutput(sdkReasoning, {
    recoverFinalFromUnclosedReasoning: true,
  });
  let recoveredChannelReasoning = latestNonEmpty(channelReasoning);
  for (const raw of rawText.slice().reverse()) {
    const normalizedRaw = normalizeReasoningOutput(raw, {
      recoverFinalFromUnclosedReasoning: true,
    });
    if (normalizedRaw.content && normalizedRaw.reasoning) {
      recoveredChannelReasoning = normalizedRaw.reasoning;
      break;
    }
  }
  return joinReasoning(normalizedReasoning.reasoning || sdkReasoning, recoveredChannelReasoning);
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

function latestNonEmpty(parts: string[]) {
  for (const part of parts.slice().reverse()) {
    const trimmed = part.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function getTextDelta(part: { text?: string; delta?: string; textDelta?: string }) {
  return part.text ?? part.delta ?? part.textDelta ?? '';
}

function isReasoningLeak(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith('thinking process') ||
    normalized.startsWith('analysis:') ||
    normalized.includes('analyze the request') ||
    normalized.includes('consult available tools') ||
    normalized.includes('synthesize the answer') ||
    normalized.includes('final output generation') ||
    normalized.includes('review constraints')
  );
}

function cleanSourceFact(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[-*\d.)\s]+/, '')
    .trim();
}

function dedupeFacts(facts: Array<{ text: string; citation: string }>) {
  const seen = new Set<string>();
  const result: Array<{ text: string; citation: string }> = [];
  for (const fact of facts) {
    const key = fact.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(fact);
  }
  return result;
}

function answerLeadForQuestion(question: string) {
  const normalized = question.trim().toLowerCase();
  if (/^how\b| how do | how can | how should /.test(normalized)) {
    return 'Do this:';
  }
  if (/^what\b| what is | what are /.test(normalized)) {
    return 'The answer:';
  }
  return 'Here is the useful answer:';
}

function ensureSentence(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function recoverExplicitFinalFromReasoning(reasoning: string) {
  const finalMarker =
    /(?:^|\n)\s*(?:final|final answer|answer|assistant)\s*[:\n-]\s*([\s\S]+)$/i;
  const match = reasoning.match(finalMarker);
  return match?.[1]?.trim() ?? '';
}

function contextTokensForModel(sizeBytes: number | null) {
  if (!sizeBytes) return 4096;
  if (sizeBytes > 3.5 * 1024 * 1024 * 1024) return 3072;
  return 4096;
}
