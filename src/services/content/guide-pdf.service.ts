import * as FileSystem from 'expo-file-system/legacy';
import { TextPdfService } from '@/services/notes/note-pdf.service';
import type { ContentPack } from '@/types/content';

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCharCode(value) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCharCode(value) : '';
    });
}

function htmlToPlainText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|header|footer|main|aside|blockquote|pre|table|tr|ul|ol)>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export class GuidePdfService {
  static async export(pack: ContentPack) {
    if (!pack.localUri) throw new Error('This guide is not available offline.');
    const raw = await FileSystem.readAsStringAsync(pack.localUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const body = htmlToPlainText(raw);
    return TextPdfService.export({
      title: pack.title,
      body: body || 'No readable text found in this guide.',
      fallbackFileName: 'Guide',
    });
  }
}
