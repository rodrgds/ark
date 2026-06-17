import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { SAFETY_COPY } from '@/constants/app';
import { createArkAiSdkTools } from '@/services/ai/ai-sdk-tools';
import { isEmbeddingModelPack } from '@/services/ai/embedding-models';
import { normalizeReasoningOutput } from '@/services/ai/reasoning-normalizer';
import { getVisionProjectorId, isVisionCapableChatModel } from '@/services/ai/vision-models';
import { ContentPackService } from '@/services/content/content-pack.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import type { ContentPack } from '@/types/content';
import type { AiAdapterResponse, AiAdapterSendInput, AiCitation } from '@/types/ai';
import type { NativeCompletionResult, RNLlamaOAICompatibleMessage, TokenData } from 'llama.rn';

type ReactNativeAiLlamaModule = typeof import('@react-native-ai/llama');
type LlamaLanguageModel = ReturnType<ReactNativeAiLlamaModule['llama']['languageModel']>;

let llamaModulePromise: Promise<ReactNativeAiLlamaModule | null> | null = null;
let modelPromise: Promise<LlamaRuntime | null> | null = null;
let modelPromiseKey: string | null = null;
let activeAbortController: AbortController | null = null;
let activeModel: LlamaRuntime | null = null;

const COMPLETION_TIMEOUT_MS = 120_000;
const ANSWER_MAX_OUTPUT_TOKENS = 2048;
const GEMMA_MAX_OUTPUT_TOKENS = 896;
const STREAM_UPDATE_INTERVAL_MS = 110;
const LARGE_MODEL_UNLOAD_BYTES = 2.5 * 1024 * 1024 * 1024;
const MODEL_HISTORY_MESSAGE_LIMIT = 4;
const MODEL_HISTORY_MESSAGE_CHARS = 900;
const MODEL_USER_CONTENT_CHARS = 2200;
const MODEL_CITATION_LIMIT = 4;
const MODEL_CITATION_SNIPPET_CHARS = 420;
const MODEL_SOURCE_CONTEXT_LIMIT = 2;
const MODEL_SOURCE_CONTEXT_CHARS = 900;
const MODEL_ATTACHMENT_CHARS = 700;
const MODEL_ATTACHMENT_TOTAL_CHARS = 1400;
const GEMMA_ATTACHMENT_TOTAL_CHARS = 900;

type LlamaRuntime = {
  model: LlamaLanguageModel;
  pack: ContentPack;
  projector: ContentPack | null;
  cacheKey: string;
};

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
    const [module, model] = await Promise.all([
      loadLlamaModule(),
      getInstalledModel(selectedModelId),
    ]);
    return !!module && !!model?.localUri;
  }

  async sendMessage(input: AiAdapterSendInput): Promise<AiAdapterResponse> {
    const runtime = await getLanguageRuntime(input.selectedModelId, {
      requiresVision: hasImageAttachments(input),
    });
    if (!runtime) {
      return {
        content:
          'No on-device AI runtime is available in this build. Download an answer model and use a build with local AI enabled.',
        citations: input.citations,
      };
    }

    const abortController = new AbortController();
    activeAbortController = abortController;
    activeModel = runtime;
    const model = runtime.model;
    const isGemma = isGemmaModel(runtime.pack);
    const modelInput = prepareInputForModel(input, runtime.pack);
    const useTools = !isGemma && !hasImageAttachments(input);
    const maxOutputTokens = isGemma ? GEMMA_MAX_OUTPUT_TOKENS : ANSWER_MAX_OUTPUT_TOKENS;
    const combinedCitations = [...input.citations];
    const tokenEmitter = createThrottledEmitter(input.onToken, STREAM_UPDATE_INTERVAL_MS);
    const reasoningEmitter = createThrottledEmitter(input.onReasoning, STREAM_UPDATE_INTERVAL_MS);

    const timeoutHandle = setTimeout(() => {
      abortController.abort(new Error('Local model completion timed out.'));
    }, COMPLETION_TIMEOUT_MS);

    let finalText = '';
    let finalReasoning = '';

    try {
      const completion =
        isGemma && !hasImageAttachments(modelInput)
          ? await completeGemmaDirectly(
              runtime,
              modelInput,
              abortController,
              tokenEmitter,
              reasoningEmitter
            )
          : await completeWithAiSdk({
              runtime,
              input: modelInput,
              useTools,
              maxOutputTokens,
              combinedCitations,
              abortController,
              tokenEmitter,
              reasoningEmitter,
            });
      finalText = completion.content;
      finalReasoning = completion.reasoning;
    } catch (error) {
      const reason = abortController.signal.reason;
      const message = reason instanceof Error ? reason.message : 'Local model completion failed.';
      throw new Error(message, { cause: error });
    } finally {
      clearTimeout(timeoutHandle);
      tokenEmitter.flush();
      reasoningEmitter.flush();
      if (activeAbortController === abortController) activeAbortController = null;
      if (activeModel === runtime) activeModel = null;
    }

    if (isReasoningLeak(finalText)) {
      finalReasoning = joinReasoning(finalReasoning, finalText);
      finalText = '';
    }

    if (shouldUnloadRuntimeAfterRun(runtime)) {
      await unloadRuntime(runtime);
    }

    return {
      content: finalText || 'I could not generate a useful local answer for that message.',
      citations: combinedCitations,
      reasoning: finalReasoning || undefined,
    };
  }

  async cancelActiveCompletion() {
    activeAbortController?.abort();
    await activeModel?.model
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
      maxResponseTokens: isGemmaModel(model) ? GEMMA_MAX_OUTPUT_TOKENS : ANSWER_MAX_OUTPUT_TOKENS,
      visionReady: !!(await getInstalledVisionProjector(model?.id)),
    };
  }
}

async function loadLlamaModule() {
  if (!llamaModulePromise) {
    llamaModulePromise = import('@react-native-ai/llama').catch(() => null);
  }
  return llamaModulePromise;
}

async function getLanguageRuntime(
  selectedModelId?: string | null,
  options: { requiresVision?: boolean } = {}
) {
  const selectedModel = await getInstalledModel(selectedModelId);
  const projector = options.requiresVision
    ? await getInstalledVisionProjector(selectedModel?.id)
    : null;
  if (options.requiresVision && selectedModel && !projector) {
    throw new Error('This image-capable model needs its matching vision projector downloaded.');
  }
  const key = [
    selectedModel?.id ?? selectedModelId ?? '__default__',
    selectedModel?.localUri ?? 'missing',
    projector?.localUri ?? 'text',
  ].join('|');
  if (!modelPromise || modelPromiseKey !== key) {
    modelPromiseKey = key;
    modelPromise = (async () => {
      const module = await loadLlamaModule();
      const model = selectedModel;
      if (!module || !model?.localUri) return null;
      const languageModel = module.llama.languageModel(model.localUri, {
        ...(projector?.localUri
          ? {
              projectorPath: projector.localUri,
              projectorUseGpu: true,
            }
          : {}),
        contextParams: {
          n_ctx: contextTokensForModel(model.sizeBytes ?? null, !!projector),
          n_gpu_layers: 0,
        },
      });
      await languageModel.prepare();
      return {
        model: languageModel,
        pack: model,
        projector,
        cacheKey: key,
      };
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

async function getInstalledVisionProjector(modelId: string | null | undefined) {
  const projectorId = getVisionProjectorId(modelId);
  if (!projectorId) return null;
  const projector = (await ContentPackService.listPacks()).find((pack) => pack.id === projectorId);
  return projector?.installed && projector.localUri ? projector : null;
}

function buildSystemPrompt(model?: ContentPack | null) {
  const gemmaInstruction = isGemmaModel(model)
    ? [
        'For Gemma hybrid-thinking models: keep any internal thinking brief and always write the final user-facing answer.',
        'If a thought/final channel format is used, emit the final channel immediately after the thought channel.',
      ].join('\n')
    : '';
  return [
    'You are Arky, an offline survival-grade assistant for practical emergency, field, and self-reliance questions.',
    'Answer the user directly and keep continuity with the conversation history. Resolve short follow-ups such as "why not?" against the previous user and assistant turns.',
    'Use local tool results and opened source context when they are relevant. If retrieved sources are weak, irrelevant, or incomplete, say that briefly and answer from general survival knowledge instead of pretending the sources answer the question.',
    'When using retrieved local sources, cite them inline with their source number like [1] or [2]. Cite only the specific source that supports that sentence.',
    'Do not include hidden reasoning, analysis channels, or scratchpad text in the final answer. If the model has a separate final channel, move to it promptly.',
    gemmaInstruction,
    'Do not refuse ordinary survival skills such as making fishing hooks, knots, shelter, fire, water storage, food procurement, navigation, tool repair, or improvised non-weapon field gear. Include practical cautions, local-law reminders, and safer alternatives where useful.',
    'Refuse instructions for harming people, traps intended for people, explosives, poisons, or evading law enforcement.',
    `Safety note to include when advice is high-stakes: ${SAFETY_COPY.ai}`,
  ].join('\n');
}

function prepareInputForModel(
  input: AiAdapterSendInput,
  model?: ContentPack | null
): AiAdapterSendInput {
  const attachmentTotalLimit = isGemmaModel(model)
    ? GEMMA_ATTACHMENT_TOTAL_CHARS
    : MODEL_ATTACHMENT_TOTAL_CHARS;
  let remainingAttachmentChars = attachmentTotalLimit;

  return {
    ...input,
    content: truncateText(input.content, MODEL_USER_CONTENT_CHARS),
    history: (input.history ?? []).slice(-MODEL_HISTORY_MESSAGE_LIMIT).map((message) => ({
      role: message.role,
      content: truncateText(message.content, MODEL_HISTORY_MESSAGE_CHARS),
    })),
    citations: input.citations.slice(0, MODEL_CITATION_LIMIT).map((citation) => ({
      ...citation,
      snippet: truncateText(citation.snippet, MODEL_CITATION_SNIPPET_CHARS),
    })),
    sourceContext: (input.sourceContext ?? [])
      .slice(0, MODEL_SOURCE_CONTEXT_LIMIT)
      .map((source) => ({
        ...source,
        content: truncateText(source.content, MODEL_SOURCE_CONTEXT_CHARS),
      })),
    attachments: (input.attachments ?? []).map((attachment) => {
      if (attachment.type === 'image') return attachment;
      const nextLimit = Math.max(0, Math.min(MODEL_ATTACHMENT_CHARS, remainingAttachmentChars));
      remainingAttachmentChars = Math.max(0, remainingAttachmentChars - nextLimit);
      return {
        ...attachment,
        content: truncateText(attachment.content, nextLimit),
      };
    }),
  };
}

function buildMessages(input: AiAdapterSendInput): ModelMessage[] {
  const userText = buildUserText(input);
  const images = input.attachments?.filter((attachment) => attachment.type === 'image') ?? [];

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
      content: images.length
        ? [
            { type: 'text', text: userText },
            ...images.map((attachment) => ({
              type: 'file' as const,
              data: attachment.uri,
              filename: attachment.title,
              mediaType: attachment.mimeType,
            })),
          ]
        : userText,
    },
  ];
}

type CompletionText = {
  content: string;
  reasoning: string;
};

async function completeWithAiSdk({
  runtime,
  input,
  useTools,
  maxOutputTokens,
  combinedCitations,
  abortController,
  tokenEmitter,
  reasoningEmitter,
}: {
  runtime: LlamaRuntime;
  input: AiAdapterSendInput;
  useTools: boolean;
  maxOutputTokens: number;
  combinedCitations: AiCitation[];
  abortController: AbortController;
  tokenEmitter: { emit: (value: string) => void };
  reasoningEmitter: { emit: (value: string) => void };
}): Promise<CompletionText> {
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

  try {
    const result = streamText({
      model: runtime.model,
      system: buildSystemPrompt(runtime.pack),
      messages: buildMessages(input),
      ...(useTools
        ? {
            tools: createArkAiSdkTools({
              onRun: (run) => {
                mergeCitations(combinedCitations, run.citations);
              },
            }),
            toolChoice: 'auto' as const,
            stopWhen: stepCountIs(3),
          }
        : {}),
      maxOutputTokens,
      ...generationSettingsForModel(runtime.pack),
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
        if (streamingText) tokenEmitter.emit(streamingText);
      } else if (part.type === 'reasoning-delta') {
        sdkReasoning += getTextDelta(part);
        const nextReasoning = joinReasoning(sdkReasoning, stepChannelReasoning);
        if (nextReasoning) reasoningEmitter.emit(nextReasoning);
      } else if (part.type === 'tool-result') {
        const output = part.output as unknown;
        if (isArkToolOutput(output)) mergeCitations(combinedCitations, output.citations);
      }
      const nextReasoning = joinReasoning(sdkReasoning, stepChannelReasoning);
      if (part.type === 'text-delta' && nextReasoning) reasoningEmitter.emit(nextReasoning);
    }
    finishCurrentStep();
  } catch (error) {
    throw error;
  }

  return {
    content: recoverFinalText(completedStepRawText, completedStepVisibleText, sdkReasoning),
    reasoning: recoverReasoningText(
      completedStepRawText,
      sdkReasoning,
      completedStepChannelReasoning
    ),
  };
}

async function completeGemmaDirectly(
  runtime: LlamaRuntime,
  input: AiAdapterSendInput,
  abortController: AbortController,
  tokenEmitter: { emit: (value: string) => void },
  reasoningEmitter: { emit: (value: string) => void }
): Promise<CompletionText> {
  const context = runtime.model.getContext() ?? (await runtime.model.prepare());
  let rawText = '';
  let parsedContent = '';
  let parsedReasoning = '';
  let stopReason: string | null = null;

  const stopNativeCompletion = (reason: string) => {
    stopReason = stopReason ?? reason;
    void context.stopCompletion().catch(() => undefined);
  };
  const handleAbort = () => {
    const reason = abortController.signal.reason;
    stopNativeCompletion(
      reason instanceof Error ? reason.message : 'Local model completion stopped.'
    );
  };
  abortController.signal.addEventListener('abort', handleAbort);

  try {
    const result: NativeCompletionResult = await context.completion(
      {
        messages: buildNativeMessages(input, runtime.pack),
        n_predict: GEMMA_MAX_OUTPUT_TOKENS,
        temperature: 0.35,
        top_p: 0.9,
        top_k: 40,
        enable_thinking: false,
        reasoning_format: 'auto',
        speculative: false,
      },
      (tokenData: TokenData) => {
        rawText = tokenData.content ?? tokenData.accumulated_text ?? `${rawText}${tokenData.token}`;
        parsedReasoning = tokenData.reasoning_content ?? parsedReasoning;
        const normalized = normalizeReasoningOutput(rawText);
        parsedContent = normalized.content || parsedContent;
        const reasoning = joinReasoning(parsedReasoning, normalized.reasoning);
        if (parsedContent) tokenEmitter.emit(parsedContent);
        if (reasoning) reasoningEmitter.emit(reasoning);
      }
    );

    const finalRaw = result.content || result.text || rawText;
    const normalized = normalizeReasoningOutput(finalRaw, {
      recoverFinalFromUnclosedReasoning: true,
    });
    const reasoning = joinReasoning(
      result.reasoning_content,
      parsedReasoning,
      normalized.reasoning
    );

    if (stopReason && !normalized.content && !recoverExplicitFinalFromReasoning(reasoning)) {
      throw new Error(stopReason);
    }

    return {
      content: normalized.content || recoverExplicitFinalFromReasoning(reasoning),
      reasoning,
    };
  } finally {
    abortController.signal.removeEventListener('abort', handleAbort);
  }
}

function buildNativeMessages(
  input: AiAdapterSendInput,
  model?: ContentPack | null
): RNLlamaOAICompatibleMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(model) },
    ...(input.history ?? []).flatMap((message): RNLlamaOAICompatibleMessage[] =>
      message.role === 'user' || message.role === 'assistant'
        ? [{ role: message.role, content: message.content }]
        : []
    ),
    { role: 'user', content: buildUserText(input) },
  ];
}

function buildUserText(input: AiAdapterSendInput) {
  return [
    `Tools already used:\n${formatToolTrace(input)}`,
    `Retrieved local sources:\n${formatCitations(input.citations)}`,
    `Opened source context:\n${formatSourceContext(input)}`,
    `Attached context:\n${formatAttachments(input)}`,
    `User question:\n${input.content}`,
  ].join('\n\n');
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

function formatAttachments(input: AiAdapterSendInput) {
  if (!input.attachments?.length) return 'No explicit attachments.';
  return input.attachments
    .map((attachment, index) => {
      if (attachment.type === 'image') {
        return `${index + 1}. Image: ${attachment.title}`;
      }
      return `${index + 1}. ${attachment.type === 'note' ? 'Note' : attachment.type === 'document' ? 'Document' : 'Library'}: ${attachment.title}\n${attachment.content.slice(0, 1600)}`;
    })
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

function joinReasoning(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim() ?? '')
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

function truncateText(text: string, maxChars: number) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (maxChars <= 0) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 12)).trimEnd()}...`;
}

function recoverExplicitFinalFromReasoning(reasoning: string) {
  const finalMarker = /(?:^|\n)\s*(?:final|final answer|answer|assistant)\s*[:\n-]\s*([\s\S]+)$/i;
  const match = reasoning.match(finalMarker);
  return match?.[1]?.trim() ?? '';
}

function generationSettingsForModel(model?: ContentPack | null) {
  if (isGemmaModel(model)) {
    return {
      temperature: 0.7,
      topP: 0.95,
      topK: 64,
    };
  }
  return {
    temperature: 0.2,
  };
}

function contextTokensForModel(sizeBytes: number | null, multimodal = false) {
  if (multimodal) return 3072;
  if (!sizeBytes) return 4096;
  if (sizeBytes > 3.5 * 1024 * 1024 * 1024) return 3072;
  return 4096;
}

function isGemmaModel(model?: ContentPack | null) {
  return !!model && /\bgemma\b/i.test(`${model.id} ${model.title}`);
}

function hasImageAttachments(input: AiAdapterSendInput) {
  return input.attachments?.some((attachment) => attachment.type === 'image') ?? false;
}

function shouldUnloadRuntimeAfterRun(runtime: LlamaRuntime) {
  return (
    isGemmaModel(runtime.pack) ||
    isVisionCapableChatModel(runtime.pack) ||
    !!runtime.projector ||
    (runtime.pack.sizeBytes ?? 0) >= LARGE_MODEL_UNLOAD_BYTES
  );
}

async function unloadRuntime(runtime: LlamaRuntime) {
  await runtime.model.unload().catch(() => undefined);
  if (modelPromiseKey === runtime.cacheKey) {
    modelPromise = null;
    modelPromiseKey = null;
  }
}

function createThrottledEmitter<T>(callback: ((value: T) => void) | undefined, intervalMs: number) {
  let latest: T | undefined;
  let lastEmittedAt = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const emitNow = () => {
    if (latest === undefined) return;
    lastEmittedAt = Date.now();
    const value = latest;
    latest = undefined;
    callback?.(value);
  };

  return {
    emit(value: T) {
      if (!callback) return;
      latest = value;
      const elapsed = Date.now() - lastEmittedAt;
      if (elapsed >= intervalMs) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        emitNow();
        return;
      }
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          emitNow();
        }, intervalMs - elapsed);
      }
    },
    flush() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      emitNow();
    },
  };
}
