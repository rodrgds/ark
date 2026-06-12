type ArkOcrNativeModule = {
  recognizeText(uri: string): Promise<{
    text: string;
    blocks?: Array<{ text: string; confidence?: number | null }>;
  }>;
  extractPdfText(
    uri: string,
    maxPages: number
  ): Promise<{
    pageCount: number;
    pages: NativePdfPage[];
    truncated?: boolean;
  }>;
  recognizePdf(
    uri: string,
    maxPages: number,
    renderDpi: number
  ): Promise<{
    pageCount: number;
    pages: NativePdfPage[];
    truncated?: boolean;
  }>;
};

type NativePdfPage = {
  pageNumber: number;
  text: string;
  extractionMethod: 'text_layer' | 'ocr';
  confidence?: number | null;
};

type OcrRecognitionResult =
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
        error: 'Image text recognition needs an Ark development build with the native OCR module.',
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

  static async extractPdfText(uri: string, maxPages = 300) {
    const module = await this.requireNativeModule();
    if (!module) {
      return {
        status: 'unavailable' as const,
        error: 'PDF text extraction needs an Ark development build with the native OCR module.',
        pageCount: 0,
        pages: [],
        truncated: false,
      };
    }

    try {
      const result = await module.extractPdfText(uri, maxPages);
      return {
        status: 'ready' as const,
        pageCount: result.pageCount,
        pages: normalizePdfPages(result.pages),
        truncated: !!result.truncated,
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'PDF text extraction failed.',
        pageCount: 0,
        pages: [],
        truncated: false,
      };
    }
  }

  static async recognizePdf(uri: string, input: { maxPages?: number; renderDpi?: number } = {}) {
    const module = await this.requireNativeModule();
    if (!module) {
      return {
        status: 'unavailable' as const,
        error: 'PDF OCR needs an Ark development build with the native OCR module.',
        pageCount: 0,
        pages: [],
        truncated: false,
      };
    }

    try {
      const result = await module.recognizePdf(uri, input.maxPages ?? 20, input.renderDpi ?? 180);
      return {
        status: 'ready' as const,
        pageCount: result.pageCount,
        pages: normalizePdfPages(result.pages),
        truncated: !!result.truncated,
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'PDF OCR failed.',
        pageCount: 0,
        pages: [],
        truncated: false,
      };
    }
  }

  static setNativeModuleForTests(module: ArkOcrNativeModule | null | undefined) {
    this.nativeModuleOverride = module;
  }

  private static async requireNativeModule() {
    if (this.nativeModuleOverride !== undefined) return this.nativeModuleOverride;
    try {
      const { requireOptionalNativeModule } = await import('expo');
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

function normalizePdfPages(pages: NativePdfPage[]) {
  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: normalizeOcrText(page.text),
    extractionMethod: page.extractionMethod,
    confidence: page.confidence ?? null,
  }));
}
