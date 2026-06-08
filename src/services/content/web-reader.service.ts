import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';

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

    // Polyfill essential globals for Turndown/Defuddle internal Markdown conversion
    // This is needed because some dependencies might look for global document/Node
    const g = global as any;
    const oldDocument = g.document;
    const oldNode = g.Node;
    const oldHTMLElement = g.HTMLElement;
    const oldDOMParser = g.DOMParser;

    try {
      g.document = document;
      g.Node = dom.Node;
      g.HTMLElement = dom.HTMLElement;
      g.DOMParser = dom.DOMParser;

      // Use Defuddle to extract content as Markdown
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
    } finally {
      // Restore globals
      g.document = oldDocument;
      g.Node = oldNode;
      g.HTMLElement = oldHTMLElement;
      g.DOMParser = oldDOMParser;
    }
  }
}
