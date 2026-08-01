import { OcrService } from '@/services/ocr/ocr.service';

export type ArkDistribution = 'standard' | 'fdroid';

export type ArkCapabilities = {
  distribution: ArkDistribution;
  imageOcr: boolean;
  pdfOcr: boolean;
  localLlm: boolean;
  embeddings: boolean;
  offlineRouting: boolean;
  zimArchives: boolean;
};

let cached: ArkCapabilities | null = null;

export function resetArkCapabilitiesCache() {
  cached = null;
}

/**
 * Build-time capabilities for the installed APK. The values come from the
 * native build (the OCR module reports its per-flavor distribution and OCR
 * support). Other capability slots are currently always available and are
 * extended when a future flavor gates AI or routing features.
 */
export async function getArkCapabilities(): Promise<ArkCapabilities> {
  if (cached) return cached;
  const ocr = await OcrService.getCapabilities();
  cached = {
    distribution: ocr.distribution === 'fdroid' ? 'fdroid' : 'standard',
    imageOcr: ocr.imageOcr,
    pdfOcr: ocr.pdfOcr,
    // The fdroid distribution ships without the local LLM and ExecuTorch
    // runtimes, so those capabilities follow the distribution.
    localLlm: ocr.distribution === 'standard',
    embeddings: ocr.distribution === 'standard',
    offlineRouting: true,
    zimArchives: true,
  };
  return cached;
}

export async function isFdroidBuild(): Promise<boolean> {
  return (await getArkCapabilities()).distribution === 'fdroid';
}
