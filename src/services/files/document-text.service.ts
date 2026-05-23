import * as FileSystem from 'expo-file-system/legacy';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { RagService } from '@/services/ai/rag.service';
import { OcrService } from '@/services/ocr/ocr.service';
import type { ArkDocument } from '@/types/db';

const MAX_INLINE_TEXT_BYTES = 2 * 1024 * 1024;

export class DocumentTextService {
  static async processDocument(documentId: string) {
    const document = await DocumentsRepository.get(documentId);
    if (!document) return null;

    if (!document.localUri) {
      const updated = await DocumentsRepository.updateText(document.id, {
        ocrStatus: 'unavailable',
        ocrError: 'No local file is available to inspect.',
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    if (isTextDocument(document)) {
      const text = await readTextFile(document);
      const updated = await DocumentsRepository.updateText(document.id, {
        extractedText: text,
        ocrText: null,
        ocrStatus: 'not_needed',
        ocrError: null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    if (isImageDocument(document)) {
      await DocumentsRepository.updateText(document.id, {
        ocrStatus: 'processing',
        ocrError: null,
        indexedAt: null,
      });
      const result = await OcrService.recognizeImage(document.localUri);
      const updated = await DocumentsRepository.updateText(document.id, {
        ocrText: result.text,
        ocrStatus: result.status,
        ocrError: 'error' in result ? result.error : null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    const updated = await DocumentsRepository.updateText(document.id, {
      ocrStatus: 'not_needed',
      ocrError: null,
      indexedAt: null,
    });
    await RagService.indexDocument(document.id);
    return updated;
  }

  static async reprocessDocument(documentId: string) {
    await DocumentsRepository.updateText(documentId, {
      extractedText: null,
      ocrText: null,
      ocrStatus: 'pending',
      ocrError: null,
      indexedAt: null,
    });
    return this.processDocument(documentId);
  }
}

export function isImageDocument(document: Pick<ArkDocument, 'mimeType' | 'title'>) {
  return (
    document.mimeType?.startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(document.title)
  );
}

export function isTextDocument(document: Pick<ArkDocument, 'mimeType' | 'title'>) {
  const title = document.title.toLowerCase();
  return (
    document.mimeType?.startsWith('text/') ||
    document.mimeType === 'application/json' ||
    document.mimeType === 'application/xml' ||
    title.endsWith('.md') ||
    title.endsWith('.json') ||
    title.endsWith('.csv') ||
    title.endsWith('.log') ||
    title.endsWith('.txt') ||
    title.endsWith('.xml')
  );
}

async function readTextFile(document: ArkDocument) {
  if ((document.sizeBytes ?? 0) > MAX_INLINE_TEXT_BYTES) {
    return `${document.title}\nText file is stored offline but is too large for automatic inline indexing.`;
  }
  if (!document.localUri) return document.title;
  return FileSystem.readAsStringAsync(document.localUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
