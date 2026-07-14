import * as FileSystem from 'expo-file-system/legacy';
import { NAV_COLORS, type EffectiveTheme } from '@/constants/theme';
import type { ContentPack } from '@/types/content';
import type { GuideSection } from '@/services/content/guide.service';
import { Platform } from 'react-native';
import { marked } from 'marked';

export type ReaderContent = {
  html?: string;
  markdown?: string;
  uri?: string;
  format: 'pdf' | 'html' | 'markdown' | 'text';
  title: string;
  sectionTitle?: string;
  sectionTargets?: string[];
  page?: number;
  allowReadAccessToURL?: string;
  allowsActiveContent?: boolean;
};

function getReaderThemeCss(theme: EffectiveTheme) {
  const colors = NAV_COLORS[theme];
  const selection = theme === 'light' ? 'rgba(74, 87, 66, 0.18)' : 'rgba(149, 167, 139, 0.28)';

  return `
  :root {
    --bg: ${colors.background};
    --fg: ${colors.foreground};
    --fg-muted: ${colors.mutedForeground};
    --accent: ${colors.primary};
    --card-bg: ${colors.card};
    --border: ${colors.border};
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
  ::selection { background: ${selection}; }
`;
}

import { escapeHtml } from '@/lib/format';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}

function wrapInHtmlShell(body: string, title: string, theme: EffectiveTheme) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
  <title>${escapeHtml(title)}</title>
  <style>${getReaderThemeCss(theme)}</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export class GuideReaderService {
  /**
   * Prepares content for the full-screen reader.
   */
  static async prepareContent(
    pack: ContentPack,
    section?: GuideSection | null,
    theme: EffectiveTheme = 'oled'
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
      return {
        uri: pack.localUri,
        format: 'pdf',
        title: pack.title,
        sectionTitle: section?.title,
        sectionTargets: sectionTargets(section),
        page: section?.page,
      };
    }

    if (format === 'markdown') {
      const content = await FileSystem.readAsStringAsync(pack.localUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Configure marked to add IDs to headers
      const renderer = new marked.Renderer();
      renderer.heading = function ({ text, depth }) {
        const id = slugify(text);
        return `<h${depth} id="${id}">${text}</h${depth}>`;
      };

      const bodyHtml = await marked.parse(content, { renderer });

      return {
        html: wrapInHtmlShell(
          `<article style="padding: 16px;">${bodyHtml}</article>`,
          pack.title,
          theme
        ),
        format: 'html',
        title: pack.title,
        sectionTitle: section?.title,
        sectionTargets: sectionTargets(section),
      };
    }

    if (format === 'html') {
      if (pack.downloadStrategy === 'html_snapshot') {
        return {
          uri: pack.localUri,
          allowReadAccessToURL: parentDirectory(pack.localUri),
          allowsActiveContent: false,
          format: 'html',
          title: pack.title,
          sectionTitle: section?.title,
          sectionTargets: sectionTargets(section),
        };
      }

      const content = await FileSystem.readAsStringAsync(pack.localUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let html = content;
      // Inject theme if not present
      if (!content.includes('id="ark-theme"')) {
        const themeStyle = `<style id="ark-theme">${getReaderThemeCss(theme)} body { padding: 16px !important; }</style>`;
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
        sectionTargets: sectionTargets(section),
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
        pack.title,
        theme
      ),
      format: 'text',
      title: pack.title,
    };
  }

  private static detectFormat(pack: ContentPack): 'pdf' | 'html' | 'markdown' | 'text' {
    if (pack.format === 'pdf') return 'pdf';
    if (pack.format === 'html') return 'html';
    if (pack.format === 'markdown') return 'markdown';
    const uri = pack.localUri?.toLowerCase() ?? '';
    if (uri.endsWith('.pdf')) return 'pdf';
    if (uri.endsWith('.html') || uri.endsWith('.htm')) return 'html';
    if (uri.endsWith('.md') || uri.endsWith('.markdown')) return 'markdown';
    return 'text';
  }
}

function parentDirectory(uri: string) {
  const separatorIndex = uri.lastIndexOf('/');
  return separatorIndex === -1 ? uri : uri.slice(0, separatorIndex + 1);
}

function sectionTargets(section?: GuideSection | null) {
  return section?.htmlTargets ?? [];
}
