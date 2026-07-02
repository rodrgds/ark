import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { withDefuddleDomGlobals } from '@/services/content/defuddle-runtime';
import { arkUserAgent } from '@/services/files/http-headers';

export type WebArticle = {
  title: string;
  content: string;
  url: string;
  excerpt?: string;
  author?: string;
  siteName?: string;
  published?: string;
  image?: string;
  wordCount?: number;
};

export class WebReaderService {
  /**
   * Fetches a remote URL and extracts its content using Defuddle.
   * Returns readable content and metadata.
   */
  static async fetchAndParse(url: string): Promise<WebArticle> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': arkUserAgent(),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML using linkedom
    const dom = parseHTML(html);
    const { document } = dom;

    return withDefuddleDomGlobals(dom, async () => {
      const result = await Defuddle(document, url, {
        markdown: false,
        standardize: true,
        removeHiddenElements: true,
        removeLowScoring: true,
      });

      if (!result || !result.content) {
        throw new Error('Unable to extract content from this page.');
      }

      return {
        title: result.title || 'Untitled',
        content: htmlToReadableText(result.content),
        url: url,
        excerpt: result.description,
        author: result.author,
        siteName: result.site || result.domain,
        published: result.published,
        image: result.image,
        wordCount: result.wordCount,
      };
    });
  }
}

function htmlToReadableText(value: string) {
  const html = value.trim();
  if (!html) return '';
  const parsed = parseHTML(html);
  return (parsed.document.body?.textContent ?? parsed.document.documentElement?.textContent ?? html)
    .replace(/\s+/g, ' ')
    .trim();
}
