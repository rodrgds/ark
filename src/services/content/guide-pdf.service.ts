import * as FileSystem from 'expo-file-system/legacy';
import { TextPdfService } from '@/services/notes/note-pdf.service';
import type { ContentPack } from '@/types/content';
import { marked } from 'marked';

export class GuidePdfService {
  static async export(pack: ContentPack) {
    if (!pack.localUri) throw new Error('This guide is not available offline.');
    
    const content = await FileSystem.readAsStringAsync(pack.localUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    let body = content;

    // If it's markdown, convert it to HTML first for high-quality printing
    if (pack.format === 'markdown' || pack.localUri.toLowerCase().endsWith('.md')) {
      body = await marked.parse(content);
    }

    return TextPdfService.export({
      title: pack.title,
      body: body || 'No content found in this guide.',
      fallbackFileName: 'Guide',
    });
  }
}
