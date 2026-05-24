import type { ContentPack } from '@/types/content';
import { ZimHeaderParser, type ZimHeaderInfo } from '@/services/content/zim-header';

export type ZimMetadata = {
  id: string;
  title: string;
  description?: string;
  language?: string;
  articleCount?: number;
  mainPath?: string;
  hasFulltextIndex?: boolean;
  hasTitleIndex?: boolean;
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

export type ZimReaderPlan = {
  installed: boolean;
  nativeReaderAvailable: boolean;
  nativeReaderError: string | null;
  jsHeaderAvailable: boolean;
  handoffAvailable: boolean;
  status: string;
  kiwixJsUrl: string;
  headerInfo: ZimHeaderInfo | null;
  capabilities: string[];
};

export class ZimService {
  private static nativeModuleOverride: ArkZimNativeModule | null | undefined;
  private static headerCache = new Map<string, ZimHeaderInfo>();
  private static activeArchivePath: string | null = null;
  private static activeArchiveMetadata: ZimMetadata | null = null;
  private static activeArchivePromise: Promise<ZimMetadata> | null = null;

  /**
   * Builds a comprehensive reader plan for a ZIM pack,
   * showing what capabilities are available in this build.
   */
  static async getReaderPlan(pack?: ContentPack | null): Promise<ZimReaderPlan> {
    const installed = !!pack?.installed && !!pack.localUri;
    const nativeModule = await this.requireNativeReader();
    let nativeReaderAvailable = !!nativeModule;
    let nativeReaderError: string | null = null;

    let headerInfo: ZimHeaderInfo | null = null;
    if (installed && pack?.localUri) {
      headerInfo = await this.parseHeader(pack.localUri);
    }

    const capabilities: string[] = [];
    if (installed) {
      capabilities.push('Stored offline for reading');
      capabilities.push('Open in another reader');
      if (headerInfo?.valid) {
        capabilities.push('Article list detected');
      }
    }
    if (nativeReaderAvailable) {
      capabilities.push('Search inside Ark');
    }

    return {
      installed,
      nativeReaderAvailable,
      nativeReaderError,
      jsHeaderAvailable: headerInfo?.valid ?? false,
      handoffAvailable: installed,
      status: this.getReaderStatus(pack, nativeReaderAvailable, headerInfo),
      kiwixJsUrl: 'https://pwa.kiwix.org',
      headerInfo,
      capabilities,
    };
  }

  private static getReaderStatus(
    pack?: ContentPack | null,
    nativeAvailable = false,
    headerInfo?: ZimHeaderInfo | null
  ): string {
    if (!pack) return 'Select a ZIM archive to inspect it.';
    if (!pack.installed) return 'Download this archive to read it offline.';
    if (nativeAvailable) return 'Ready for search and reading in Ark.';
    if (headerInfo?.valid) {
      return `${headerInfo.articleCount.toLocaleString()} entries stored locally. Open in another reader to browse.`;
    }
    return 'Archive stored locally. Open in another reader to browse articles.';
  }

  static getKiwixJsUrl() {
    return 'https://pwa.kiwix.org';
  }

  /**
   * Parse ZIM header using pure JavaScript. Works without the native module.
   */
  static async parseHeader(fileUri: string): Promise<ZimHeaderInfo> {
    const cached = this.headerCache.get(fileUri);
    if (cached) return cached;

    const info = await ZimHeaderParser.parse(fileUri);
    if (info.valid) {
      this.headerCache.set(fileUri, info);
    }
    return info;
  }

  /**
   * Get a formatted description of the archive for display.
   */
  static describeHeader(header: ZimHeaderInfo): string {
    return ZimHeaderParser.describe(header);
  }

  // --- Native module methods (require dev build with ArkZim) ---

  static async openArchive(pack: ContentPack) {
    const module = await this.requireNativeReader();
    if (!module) {
      throw new Error('Archive search is not available in this build.');
    }
    if (!pack.installed || !pack.localUri) {
      throw new Error('Download this archive before opening it offline.');
    }
    return this.ensureArchiveOpened(module, pack.localUri);
  }

  static async search(pack: ContentPack, query: string, limit = 8) {
    const module = await this.openForQuery(pack);
    const normalized = query.trim();
    if (normalized.length < 1) return [];
    return withTimeout(module.search(normalized, limit), 4500, async () =>
      module.suggest(normalized, limit)
    );
  }

  static async suggest(pack: ContentPack, prefix: string, limit = 8) {
    const module = await this.openForQuery(pack);
    const normalized = prefix.trim();
    if (normalized.length < 1) return [];
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
    this.activeArchivePath = null;
    this.activeArchiveMetadata = null;
    this.activeArchivePromise = null;
  }

  private static async openForQuery(pack: ContentPack) {
    const module = await this.requireNativeReader();
    if (!module) {
      throw new Error('Archive search is not available in this build.');
    }
    if (!pack.installed || !pack.localUri) {
      throw new Error('Download this archive before opening it offline.');
    }
    await this.ensureArchiveOpened(module, pack.localUri);
    return module;
  }

  private static async ensureArchiveOpened(module: ArkZimNativeModule, localUri: string) {
    if (this.activeArchivePath === localUri && this.activeArchiveMetadata) {
      return this.activeArchiveMetadata;
    }
    if (this.activeArchivePath === localUri && this.activeArchivePromise) {
      return this.activeArchivePromise;
    }
    this.activeArchivePath = localUri;
    this.activeArchivePromise = module
      .openArchive(localUri)
      .then((metadata) => {
        this.activeArchiveMetadata = metadata;
        return metadata;
      })
      .catch((error) => {
        this.activeArchivePath = null;
        this.activeArchiveMetadata = null;
        throw error;
      })
      .finally(() => {
        this.activeArchivePromise = null;
      });
    return this.activeArchivePromise;
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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Promise<T>
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      void onTimeout().then(resolve);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
