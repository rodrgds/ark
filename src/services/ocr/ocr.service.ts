type ArkOcrNativeModule = {
  recognizeText(uri: string): Promise<{
    text: string;
    blocks?: Array<{ text: string; confidence?: number | null }>;
  }>;
};

export type OcrRecognitionResult =
  | { status: 'ready'; text: string }
  | { status: 'unavailable'; text: ''; error: string }
  | { status: 'failed'; text: ''; error: string };

export class OcrService {
  private static nativeModuleOverride: ArkOcrNativeModule | null | undefined;

  static async isAvailable() {
    return !!(await this.requireNativeModule());
  }

  static async recognizeImage(uri: string): Promise<OcrRecognitionResult> {
    const module = await this.requireNativeModule();
    if (!module) {
      return {
        status: 'unavailable',
        text: '',
        error: 'Image text recognition is available in the Android development build.',
      };
    }

    try {
      const result = await module.recognizeText(uri);
      return { status: 'ready', text: normalizeOcrText(result.text) };
    } catch (error) {
      return {
        status: 'failed',
        text: '',
        error: error instanceof Error ? error.message : 'Image text recognition failed.',
      };
    }
  }

  static setNativeModuleForTests(module: ArkOcrNativeModule | null | undefined) {
    this.nativeModuleOverride = module;
  }

  private static async requireNativeModule() {
    if (this.nativeModuleOverride !== undefined) return this.nativeModuleOverride;
    try {
      const { requireOptionalNativeModule } = await import('expo-modules-core');
      return requireOptionalNativeModule<ArkOcrNativeModule>('ArkOcr');
    } catch {
      return null;
    }
  }
}

function normalizeOcrText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
