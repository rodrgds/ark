import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type ArkOcrResult = {
  text: string;
  blocks: Array<{ text: string; confidence?: number | null }>;
};

export type ArkPdfPage = {
  pageNumber: number;
  text: string;
  extractionMethod: 'text_layer' | 'ocr';
  confidence?: number | null;
};

export type ArkPdfTextResult = {
  pageCount: number;
  pages: ArkPdfPage[];
  truncated?: boolean;
};

export type ArkOcrCapabilities = {
  distribution: 'standard' | 'fdroid';
  imageOcr: boolean;
  pdfOcr: boolean;
};

declare class ArkOcrModule extends NativeModule {
  getCapabilities(): Promise<ArkOcrCapabilities>;
  recognizeText(uri: string): Promise<ArkOcrResult>;
  extractPdfText(uri: string, maxPages: number): Promise<ArkPdfTextResult>;
  recognizePdf(uri: string, maxPages: number, renderDpi: number): Promise<ArkPdfTextResult>;
}

const ArkOcr = requireNativeModule<ArkOcrModule>('ArkOcr');

export async function getOcrCapabilities(): Promise<ArkOcrCapabilities> {
  return ArkOcr.getCapabilities();
}

export default ArkOcr;
