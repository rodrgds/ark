import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { FileSystemService } from '@/services/files/filesystem.service';
import type { Note } from '@/types/db';
import { marked } from 'marked';

/**
 * High-quality print theme for documents and notes.
 */
const PRINT_THEME_CSS = `
  @page {
    margin: 20mm;
  }
  :root {
    --bg: #ffffff;
    --fg: #000000;
    --fg-muted: #52525b;
    --accent: #d97706;
    --border: #e4e4e7;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  h1 {
    font-size: 24pt;
    font-weight: 800;
    margin: 0 0 0.5em;
    line-height: 1.1;
    color: var(--fg);
  }
  h2 {
    font-size: 18pt;
    font-weight: 700;
    margin: 1.5em 0 0.5em;
    line-height: 1.2;
  }
  h3 {
    font-size: 14pt;
    font-weight: 600;
    margin: 1.2em 0 0.5em;
  }
  p { margin: 0 0 1em; }
  ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
  li { margin: 0.3em 0; }
  blockquote {
    margin: 1.5em 0;
    padding: 0.5em 1.5em;
    border-left: 4px solid var(--accent);
    color: var(--fg-muted);
    background: #fafafa;
  }
  pre, code {
    font-family: "SF Mono", Menlo, monospace;
    font-size: 9.5pt;
    background: #f4f4f5;
    border-radius: 4px;
  }
  pre {
    padding: 12pt;
    overflow: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    border: 1px solid var(--border);
  }
  code { padding: 2pt 4pt; }
  pre code { padding: 0; background: none; border: none; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5em 0;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 8pt 10pt;
    text-align: left;
  }
  th { background: #f8fafc; font-weight: 600; }
  .metadata {
    font-size: 9pt;
    color: var(--fg-muted);
    margin-bottom: 3em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1em;
  }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  
  /* Task lists */
  ul[data-type="taskList"] {
    list-style: none;
    padding-left: 0;
  }
  ul[data-type="taskList"] li {
    display: flex;
    align-items: flex-start;
    gap: 8pt;
    margin-bottom: 4pt;
  }
`;

function wrapInPrintShell(content: string, title: string, metadata?: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${PRINT_THEME_CSS}</style>
</head>
<body>
  <h1>${title}</h1>
  ${metadata ? `<div class="metadata">${metadata}</div>` : ''}
  <main>${content}</main>
</body>
</html>`;
}

export class TextPdfService {
  static async export(input: { title: string; body: string; fallbackFileName?: string }) {
    await FileSystemService.ensureAppDirectories();
    const title = input.title.trim() || input.fallbackFileName || 'Document';
    
    // For raw text, we wrap it in a pre tag or simple paragraphs
    const htmlContent = input.body.includes('<') && input.body.includes('>') 
      ? input.body 
      : `<div style="white-space: pre-wrap;">${input.body}</div>`;

    const fullHtml = wrapInPrintShell(htmlContent, title);

    const { uri } = await Print.printToFileAsync({
      html: fullHtml,
      base64: false,
    });

    const safeName = FileSystemService.safeFileName(title);
    const destinationUri = `${FileSystemService.dir('cache')}${safeName}.pdf`;
    
    await FileSystem.moveAsync({
      from: uri,
      to: destinationUri,
    });

    return { uri: destinationUri, fileName: `${safeName}.pdf` };
  }
}

export class NotePdfService {
  static async export(note: Note) {
    await FileSystemService.ensureAppDirectories();
    
    const title = note.title.trim() || 'Untitled Note';
    const dateStr = new Date(note.updatedAt).toLocaleDateString(undefined, {
      dateStyle: 'long',
    });
    const metadata = `Last updated: ${dateStr}`;

    let htmlContent = '';

    if (note.contentHtml) {
      htmlContent = note.contentHtml;
    } else {
      htmlContent = await marked.parse(note.body || '');
    }

    const fullHtml = wrapInPrintShell(htmlContent, title, metadata);

    const { uri } = await Print.printToFileAsync({
      html: fullHtml,
      base64: false,
    });

    const safeName = FileSystemService.safeFileName(title);
    const destinationUri = `${FileSystemService.dir('cache')}${safeName}.pdf`;
    
    await FileSystem.moveAsync({
      from: uri,
      to: destinationUri,
    });

    return { uri: destinationUri, fileName: `${safeName}.pdf` };
  }
}
