import { SAFETY_COPY } from '@/constants/app';
import { ContentPackService } from '@/services/content/content-pack.service';
import type { AiAdapterResponse } from '@/types/ai';
import type { AiAdapterSendInput } from '@/types/ai';

type LlamaModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaModule['initLlama']>>;

let llamaModulePromise: Promise<LlamaModule | null> | null = null;
let contextPromise: Promise<LlamaContext | null> | null = null;
let activeCompletionContext: LlamaContext | null = null;

export function resetLlamaAdapterForTests() {
  llamaModulePromise = null;
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
          'llama.rn is installed, but no native runtime/model is available in this build. Download an AI model and use a development build to enable on-device inference.',
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
    let streamedText = '';
    activeCompletionContext = context;
    const result = (await context.completion(
      {
        messages: [
          {
            role: 'system',
            content: `You are Ark, an offline survival-grade assistant. Be concise, cite retrieved local sources when relevant, and include this safety rule: ${SAFETY_COPY.ai}`,
          },
          {
            role: 'user',
            content: `Retrieved local sources:\n${sourceText}\n\nUser question:\n${input.content}`,
          },
        ],
        n_predict: 384,
        temperature: 0.2,
      },
      (data) => {
        streamedText = data.accumulated_text ?? `${streamedText}${data.token ?? ''}`;
        if (streamedText) input.onToken?.(streamedText);
      }
    ).finally(() => {
      if (activeCompletionContext === context) activeCompletionContext = null;
    })) as { text?: string; content?: string };

    return {
      content:
        result.text ??
        result.content ??
        streamedText ??
        'The local model returned an empty response.',
      citations: input.citations,
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
      maxResponseTokens: 384,
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
  const models = (await ContentPackService.listPacks()).filter(
    (pack) => pack.category === 'AI Models' && pack.installed && pack.localUri
  );
  return models[0] ?? null;
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

function contextTokensForModel(sizeBytes: number | null) {
  if (!sizeBytes) return 2048;
  if (sizeBytes > 2.5 * 1024 * 1024 * 1024) return 1024;
  if (sizeBytes > 1.4 * 1024 * 1024 * 1024) return 1536;
  return 2048;
}
