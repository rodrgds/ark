import { XMLParser } from 'fast-xml-parser';

export class RssService {
  static parse(xml: string) {
    const parser = new XMLParser({ ignoreAttributes: false });
    return parser.parse(xml);
  }

  static getStatus() {
    return 'RSS cache schema and parser are ready; feed fetching is deferred until URLs are configured.';
  }
}
