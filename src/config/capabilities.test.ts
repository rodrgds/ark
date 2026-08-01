import { describe, expect, test } from 'bun:test';
import { OcrService, type ArkOcrCapabilities } from '@/services/ocr/ocr.service';
import {
  getArkCapabilities,
  isFdroidBuild,
  resetArkCapabilitiesCache,
} from '@/config/capabilities';

const standardCapabilities: ArkOcrCapabilities = {
  distribution: 'standard',
  imageOcr: true,
  pdfOcr: true,
};

const fdroidCapabilities: ArkOcrCapabilities = {
  distribution: 'fdroid',
  imageOcr: false,
  pdfOcr: false,
};

describe('Ark F-Droid capabilities', () => {
  test('standard builds keep image and scanned-PDF OCR', async () => {
    resetArkCapabilitiesCache();
    OcrService.setCapabilitiesForTests(standardCapabilities);
    expect((await getArkCapabilities()).distribution).toBe('standard');
    expect((await getArkCapabilities()).imageOcr).toBe(true);
    expect((await getArkCapabilities()).pdfOcr).toBe(true);
    expect((await getArkCapabilities()).localLlm).toBe(true);
    expect((await getArkCapabilities()).embeddings).toBe(true);
    expect(await isFdroidBuild()).toBe(false);
    const result = await OcrService.recognizeImage('file:///x.png');
    expect(result.status).not.toBe('ready');
    expect('error' in result && result.error).toContain('native OCR module');
  });

  test('fdroid builds report OCR unavailable before touching the native module', async () => {
    resetArkCapabilitiesCache();
    OcrService.setCapabilitiesForTests(fdroidCapabilities);
    const image = await OcrService.recognizeImage('file:///scan.png');
    const pdf = await OcrService.recognizePdf('file:///scan.pdf');

    expect((await getArkCapabilities()).distribution).toBe('fdroid');
    expect(await isFdroidBuild()).toBe(true);
    expect((await getArkCapabilities()).localLlm).toBe(false);
    expect((await getArkCapabilities()).embeddings).toBe(false);
    expect(image.status).toBe('unavailable');
    expect('error' in image && image.error).toContain('not available in this build');
    expect(pdf.status).toBe('unavailable');
    expect('error' in pdf && pdf.error).toContain('Google ML Kit');
  });

  test('capabilities default to standard when the native module is absent', async () => {
    resetArkCapabilitiesCache();
    OcrService.setCapabilitiesForTests(null);
    OcrService.setNativeModuleForTests(null);
    const capabilities = await getArkCapabilities();
    expect(capabilities.distribution).toBe('standard');
    expect(capabilities.imageOcr).toBe(true);
    expect((await OcrService.recognizeImage('file:///x.png')).status).toBe('unavailable');
  });
});
