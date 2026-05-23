import * as FileSystem from 'expo-file-system/legacy';
import type { ContentPack } from '@/types/content';
import type { GuideSection } from '@/services/content/guide.service';
import { Platform } from 'react-native';

export type ReaderContent = {
  html?: string;
  uri?: string;
  format: 'pdf' | 'html' | 'text';
  title: string;
  sectionTitle?: string;
  page?: number;
  allowReadAccessToURL?: string;
};

const OLED_THEME_CSS = `
  :root {
    --bg: #000000;
    --fg: #e4e4e7;
    --fg-muted: #a1a1aa;
    --accent: #f2b84b;
    --card-bg: #0a0a0a;
    --border: #27272a;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); text-decoration: none; }
  a:active { opacity: 0.7; }
  img, video, iframe, svg { max-width: 100%; height: auto; }
  table {
    max-width: 100%;
    overflow-x: auto;
    display: block;
    border-collapse: collapse;
    margin: 1em 0;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
  }
  th { background: var(--card-bg); font-weight: 600; }
  pre, code {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 14px;
  }
  pre { padding: 12px 16px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
  code { padding: 2px 6px; }
  pre code { border: none; padding: 0; background: none; }
  h1, h2, h3, h4, h5, h6 {
    color: var(--fg);
    margin: 1.5em 0 0.5em;
    line-height: 1.3;
  }
  h1 { font-size: 1.5em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.15em; }
  blockquote {
    border-left: 3px solid var(--accent);
    margin: 1em 0;
    padding: 8px 16px;
    color: var(--fg-muted);
    background: var(--card-bg);
    border-radius: 0 6px 6px 0;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.3em 0; }
  ::selection { background: rgba(242, 184, 75, 0.3); }
`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wrapInHtmlShell(body: string, title: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <title>${escapeHtml(title)}</title>
  <style>${OLED_THEME_CSS}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

function pdfWrapperHtml(pdfSrc: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    embed, iframe, object { position: fixed; top: 0; left: 0; width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <embed src="${pdfSrc}" type="application/pdf" />
</body>
</html>`;
}

export class GuideReaderService {
  /**
   * Prepares content for the full-screen reader.
   * For PDFs, we create a small HTML wrapper file on disk that embeds the PDF
   * via `<embed>` or base64 data URI. This is more reliable than passing
   * raw file:// URIs directly to the WebView, which often renders blank on iOS
   * and is unsupported on Android.
   */
  static async prepareContent(
    pack: ContentPack,
    section?: GuideSection | null
  ): Promise<ReaderContent> {
    if (!pack.localUri) {
      throw new Error('This guide has not been downloaded yet.');
    }

    const fileInfo = await FileSystem.getInfoAsync(pack.localUri);
    if (!fileInfo.exists) {
      throw new Error('Guide file not found. Try downloading it again.');
    }

    const format = this.detectFormat(pack);

    if (format === 'pdf') {
      const pageParam = section?.page ? `#page=${section.page}` : '';

      if (Platform.OS === 'ios') {
        // iOS: create an HTML wrapper in the SAME directory as the PDF.
        // The wrapper uses <embed src="filename.pdf"> so WKWebView's native
        // PDF viewer kicks in. allowingReadAccessToURL is set to the directory.
        const lastSlash = pack.localUri.lastIndexOf('/');
        const pdfDir = pack.localUri.substring(0, lastSlash);
        const pdfFileName = pack.localUri.substring(lastSlash + 1);
        const wrapperPath = `${pdfDir}/.ark-reader.html`;

        const embedSrc = `./${encodeURIComponent(pdfFileName)}${pageParam}`;
        const wrapperHtml = pdfWrapperHtml(embedSrc, pack.title);
        await FileSystem.writeAsStringAsync(wrapperPath, wrapperHtml);

        return {
          uri: wrapperPath,
          format: 'pdf',
          title: pack.title,
          sectionTitle: section?.title,
          page: section?.page,
          allowReadAccessToURL: pdfDir,
        };
      }

      // Android: read PDF as base64, write an HTML wrapper that embeds it
      // via data URI. The HTML file lives in the app cache directory.
      const base64 = await FileSystem.readAsStringAsync(pack.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const readerDir = `${FileSystem.cacheDirectory}ark-reader/`;
      await FileSystem.makeDirectoryAsync(readerDir, { intermediates: true });

      const wrapperPath = `${readerDir}${pack.id}.html`;
      const dataUri = `data:application/pdf;base64,${base64}${pageParam}`;
      const wrapperHtml = pdfWrapperHtml(dataUri, pack.title);
      await FileSystem.writeAsStringAsync(wrapperPath, wrapperHtml);

      return {
        uri: wrapperPath,
        format: 'pdf',
        title: pack.title,
        sectionTitle: section?.title,
        page: section?.page,
        allowReadAccessToURL: readerDir,
      };
    }

    if (format === 'html') {
      const content = await FileSystem.readAsStringAsync(pack.localUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let html = content;
      // Inject theme if not present
      if (!content.includes('id="ark-theme"')) {
        const themeStyle = `<style id="ark-theme">${OLED_THEME_CSS} body { padding: 16px !important; }</style>`;
        if (content.includes('</head>')) {
          html = content.replace('</head>', themeStyle + '</head>');
        } else if (content.includes('<body')) {
          html = content.replace('<body', themeStyle + '<body');
        } else {
          html = themeStyle + content;
        }
      }

      return {
        html,
        format: 'html',
        title: pack.title,
        sectionTitle: section?.title,
      };
    }

    // Default to text
    const textContent = await FileSystem.readAsStringAsync(pack.localUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      html: wrapInHtmlShell(
        `<article style="padding: 16px;">
          <h1 style="font-size: 1.3em; margin-bottom: 1em;">${escapeHtml(pack.title)}</h1>
          <pre style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; margin: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-size: 15px; line-height: 1.6;">${escapeHtml(textContent)}</pre>
        </article>`,
        pack.title
      ),
      format: 'text',
      title: pack.title,
    };
  }

  private static detectFormat(pack: ContentPack): 'pdf' | 'html' | 'text' {
    if (pack.format === 'pdf') return 'pdf';
    if (pack.format === 'html') return 'html';
    const uri = pack.localUri?.toLowerCase() ?? '';
    if (uri.endsWith('.pdf')) return 'pdf';
    if (uri.endsWith('.html') || uri.endsWith('.htm')) return 'html';
    return 'text';
  }
}
