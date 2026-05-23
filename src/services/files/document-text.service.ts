import * as FileSystem from 'expo-file-system/legacy';
import { DocumentsRepository } from '@/services/db/repositories/documents.repo';
import { DocumentPagesRepository } from '@/services/db/repositories/document-pages.repo';
import { RagService } from '@/services/ai/rag.service';
import { OcrService } from '@/services/ocr/ocr.service';
import type { ArkDocument } from '@/types/db';

const MAX_INLINE_TEXT_BYTES = 2 * 1024 * 1024;
const PDF_TEXT_MAX_PAGES = 300;
const PDF_AUTO_OCR_MAX_PAGES = 20;
const PDF_OCR_RENDER_DPI = 180;

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
      await DocumentPagesRepository.replaceForDocument(document.id, document.title, [
        { pageNumber: 1, text, extractionMethod: 'text_layer' },
      ]);
      const updated = await DocumentsRepository.updateText(document.id, {
        extractedText: text,
        ocrText: null,
        ocrStatus: 'searchable',
        ocrError: null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    if (isPdfDocument(document)) {
      return this.processPdfDocument(document);
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

  static async deleteDocumentIndex(documentId: string) {
    await DocumentPagesRepository.deleteForDocument(documentId);
  }

  static async runPdfOcr(documentId: string, maxPages = 100) {
    const document = await DocumentsRepository.get(documentId);
    if (!document?.localUri || !isPdfDocument(document)) return document;
    await DocumentsRepository.updateText(document.id, {
      ocrStatus: 'ocr_running',
      ocrError: null,
      indexedAt: null,
    });
    const ocr = await OcrService.recognizePdf(document.localUri, {
      maxPages,
      renderDpi: PDF_OCR_RENDER_DPI,
    });
    if (ocr.status !== 'ready') {
      const updated = await DocumentsRepository.updateText(document.id, {
        ocrStatus: ocr.status,
        ocrError: 'error' in ocr ? ocr.error : null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    await DocumentPagesRepository.replaceForDocument(
      document.id,
      document.title,
      ocr.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        extractionMethod: 'ocr',
        confidence: page.confidence,
      }))
    );
    const updated = await DocumentsRepository.updateText(document.id, {
      ocrText: joinPageText(ocr.pages),
      ocrStatus: 'searchable',
      ocrError: ocr.truncated ? `OCR indexed the first ${maxPages} pages.` : null,
      indexedAt: null,
    });
    await RagService.indexDocument(document.id);
    return updated;
  }

  private static async processPdfDocument(document: ArkDocument) {
    if (!document.localUri) return null;
    await DocumentsRepository.updateText(document.id, {
      ocrStatus: 'extracting_text',
      ocrError: null,
      indexedAt: null,
    });

    const textLayer = await OcrService.extractPdfText(document.localUri, PDF_TEXT_MAX_PAGES);
    if (textLayer.status !== 'ready') {
      const updated = await DocumentsRepository.updateText(document.id, {
        ocrStatus: textLayer.status,
        ocrError: 'error' in textLayer ? textLayer.error : null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    const searchableText = joinPageText(textLayer.pages);
    if (!needsPdfOcr(textLayer.pages)) {
      await DocumentPagesRepository.replaceForDocument(
        document.id,
        document.title,
        textLayer.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          extractionMethod: 'text_layer',
          confidence: page.confidence,
        }))
      );
      const updated = await DocumentsRepository.updateText(document.id, {
        extractedText: searchableText,
        ocrText: null,
        ocrStatus: 'searchable',
        ocrError: textLayer.truncated
          ? `Indexed the first ${PDF_TEXT_MAX_PAGES} pages. Open the PDF for the rest.`
          : null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    if (textLayer.pageCount > PDF_AUTO_OCR_MAX_PAGES) {
      await DocumentPagesRepository.replaceForDocument(
        document.id,
        document.title,
        textLayer.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          extractionMethod: 'text_layer',
          confidence: page.confidence,
        }))
      );
      const updated = await DocumentsRepository.updateText(document.id, {
        extractedText: searchableText,
        ocrText: null,
        ocrStatus: 'ocr_needed',
        ocrError: `This looks like a scanned PDF. OCR is available from the document screen; automatic OCR is capped at ${PDF_AUTO_OCR_MAX_PAGES} pages.`,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    await DocumentsRepository.updateText(document.id, {
      ocrStatus: 'ocr_running',
      ocrError: null,
      indexedAt: null,
    });
    const ocr = await OcrService.recognizePdf(document.localUri, {
      maxPages: PDF_AUTO_OCR_MAX_PAGES,
      renderDpi: PDF_OCR_RENDER_DPI,
    });
    if (ocr.status !== 'ready') {
      const updated = await DocumentsRepository.updateText(document.id, {
        extractedText: searchableText,
        ocrText: null,
        ocrStatus: ocr.status,
        ocrError: 'error' in ocr ? ocr.error : null,
        indexedAt: null,
      });
      await RagService.indexDocument(document.id);
      return updated;
    }

    await DocumentPagesRepository.replaceForDocument(
      document.id,
      document.title,
      ocr.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        extractionMethod: 'ocr',
        confidence: page.confidence,
      }))
    );
    const ocrText = joinPageText(ocr.pages);
    const updated = await DocumentsRepository.updateText(document.id, {
      extractedText: searchableText || null,
      ocrText,
      ocrStatus: 'searchable',
      ocrError: ocr.truncated
        ? `OCR indexed the first ${PDF_AUTO_OCR_MAX_PAGES} pages. Run manual OCR for more.`
        : null,
      indexedAt: null,
    });
    await RagService.indexDocument(document.id);
    return updated;
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

export function isPdfDocument(document: Pick<ArkDocument, 'mimeType' | 'title'>) {
  return document.mimeType === 'application/pdf' || /\.pdf$/i.test(document.title);
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

function needsPdfOcr(pages: Array<{ text: string }>) {
  const sampledPages = pages.slice(0, Math.min(5, pages.length));
  if (!sampledPages.length) return true;
  const averageChars =
    sampledPages.reduce((sum, page) => sum + page.text.trim().length, 0) / sampledPages.length;
  return averageChars < 80;
}

function joinPageText(pages: Array<{ pageNumber: number; text: string }>) {
  return pages
    .filter((page) => page.text.trim())
    .map((page) => `Page ${page.pageNumber}\n${page.text.trim()}`)
    .join('\n\n');
}
