import type { ContentPack } from '@/types/content';

export type ZimMetadata = {
  id: string;
  title: string;
  description?: string;
  language?: string;
  articleCount?: number;
  mainPath?: string;
};

export type ZimArticle = {
  html: string;
  mimeType: string;
  finalPath: string;
  title: string;
};

export type ZimSearchResult = {
  path: string;
  title: string;
  snippet?: string;
};

type ArkZimNativeModule = {
  openArchive(path: string): Promise<ZimMetadata>;
  getArticle(path: string): Promise<ZimArticle>;
  search(query: string, limit?: number): Promise<ZimSearchResult[]>;
  suggest(prefix: string, limit?: number): Promise<ZimSearchResult[]>;
};

export class ZimService {
  private static nativeModuleOverride: ArkZimNativeModule | null | undefined;

  static getReaderPlan(pack?: ContentPack | null) {
    const installed = !!pack?.installed && !!pack.localUri;
    return {
      installed,
      embeddedReaderAvailable: false,
      inAppReaderCandidate: installed,
      handoffAvailable: installed,
      status: this.getReaderStatus(pack),
      kiwixJsUrl: this.getKiwixJsUrl(),
      limitations: this.getLimitations(),
      nextStep: installed
        ? 'Ark will try the in-app reader first. Open File is available as a fallback.'
        : 'Download the archive first. Ark will keep it in app storage for offline use.',
    };
  }

  static getReaderStatus(pack?: ContentPack | null) {
    if (!pack) return 'Select a ZIM archive to inspect it.';
    if (!pack.installed) return 'Download this archive before opening it offline.';
    return 'ZIM archive is stored locally for offline reading.';
  }

  static getKiwixJsUrl() {
    return 'https://pwa.kiwix.org';
  }

  static getLimitations() {
    return [
      'In-app reading needs the ArkZim native module in a development build.',
      'Expo Go and builds without ArkZim can still open the archive in Kiwix or another ZIM reader.',
    ];
  }

  static async openArchive(pack: ContentPack) {
    const module = await this.requireNativeReader();
    if (!module) {
      throw new Error('In-app ZIM reader is not available in this build.');
    }
    if (!pack.installed || !pack.localUri) {
      throw new Error('Download this archive before opening it offline.');
    }
    return module.openArchive(pack.localUri);
  }

  static async search(pack: ContentPack, query: string, limit = 8) {
    const module = await this.openForQuery(pack);
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    return module.search(normalized, limit);
  }

  static async suggest(pack: ContentPack, prefix: string, limit = 8) {
    const module = await this.openForQuery(pack);
    const normalized = prefix.trim();
    if (normalized.length < 2) return [];
    return module.suggest(normalized, limit);
  }

  static async getArticle(pack: ContentPack, path: string) {
    const module = await this.openForQuery(pack);
    return module.getArticle(path);
  }

  static articleHtml(article: ZimArticle) {
    return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      background: #0a0a0a;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
      margin: 0;
      padding: 18px;
    }
    img, video { max-width: 100%; height: auto; }
    a { color: #f2b84b; }
    table { max-width: 100%; overflow-x: auto; display: block; }
  </style>
</head>
<body>
  ${article.html}
</body>
</html>`;
  }

  static setNativeModuleForTests(module: ArkZimNativeModule | null | undefined) {
    this.nativeModuleOverride = module;
  }

  private static async openForQuery(pack: ContentPack) {
    const module = await this.requireNativeReader();
    if (!module) {
      throw new Error('In-app ZIM reader is not available in this build.');
    }
    if (!pack.installed || !pack.localUri) {
      throw new Error('Download this archive before opening it offline.');
    }
    await module.openArchive(pack.localUri);
    return module;
  }

  private static async requireNativeReader() {
    if (this.nativeModuleOverride !== undefined) return this.nativeModuleOverride;
    try {
      const { requireOptionalNativeModule } = await import('expo-modules-core');
      return requireOptionalNativeModule<ArkZimNativeModule>('ArkZim');
    } catch {
      return null;
    }
  }
}
