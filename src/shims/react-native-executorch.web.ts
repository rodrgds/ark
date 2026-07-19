const WEB_UNAVAILABLE = 'On-device AI models are available in Ark mobile builds.';

function unavailable(): Promise<never> {
  return Promise.reject(new Error(WEB_UNAVAILABLE));
}

class UnavailableModule {
  static fromModelName() {
    return unavailable();
  }

  delete() {}
}

export class TextEmbeddingsModule extends UnavailableModule {}
export class TextToSpeechModule extends UnavailableModule {}
export class VADModule extends UnavailableModule {}
export class SpeechToTextModule extends UnavailableModule {}

export const MULTI_QA_MINILM_L6_COS_V1 = 'web-unavailable';
export const MULTI_QA_MPNET_BASE_DOT_V1 = 'web-unavailable';
export const FSMN_VAD = 'web-unavailable';
export const WHISPER_TINY_EN = {
  isMultilingual: false,
  modelName: 'web-unavailable',
  modelSource: '',
  tokenizerSource: '',
};
export const models = {
  text_to_speech: {
    kokoro: {
      en_us: {
        heart: () => 'web-unavailable',
      },
    },
  },
};

export function initExecutorch() {}
