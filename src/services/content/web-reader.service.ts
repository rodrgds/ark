import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { withDefuddleDomGlobals } from '@/services/content/defuddle-runtime';

export type WebArticle = {
  title: string;
  content: string; // Markdown
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
   * Returns Markdown content and metadata.
   */
  static async fetchAndParse(url: string): Promise<WebArticle> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
        markdown: true,
        standardize: true,
        removeHiddenElements: true,
        removeLowScoring: true,
      });

      if (!result || !result.content) {
        throw new Error('Unable to extract content from this page.');
      }

      return {
        title: result.title || 'Untitled',
        content: result.content,
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
