import type { ContentPack } from '@/types/content';
import { ZimHeaderParser, type ZimHeaderInfo } from '@/services/content/zim-header';
import { buildZimArticleHtml } from '@/services/content/zim-article-html';

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
  metadata: ZimMetadata | null;
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
    let metadata: ZimMetadata | null = null;

    let headerInfo: ZimHeaderInfo | null = null;
    if (installed && pack?.localUri) {
      headerInfo = await this.parseHeader(pack.localUri);
      metadata = metadataFromHeader(pack, headerInfo, nativeReaderAvailable);
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
      metadata,
      jsHeaderAvailable: headerInfo?.valid ?? false,
      handoffAvailable: installed,
      status: this.getReaderStatus(pack, nativeReaderAvailable, headerInfo, nativeReaderError),
      kiwixJsUrl: 'https://pwa.kiwix.org',
      headerInfo,
      capabilities,
    };
  }

  private static getReaderStatus(
    pack?: ContentPack | null,
    nativeAvailable = false,
    headerInfo?: ZimHeaderInfo | null,
    nativeError?: string | null
  ): string {
    if (!pack) return 'Select a ZIM archive to inspect it.';
    if (!pack.installed) return 'Download this archive to read it offline.';
    if (nativeAvailable) return 'Ready for search and reading in Ark.';
    if (nativeError) return nativeError;
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
    return module.search(normalized, limit);
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
    return buildZimArticleHtml(article);
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
    const archivePath = localUri;
    if (this.activeArchivePath === archivePath && this.activeArchiveMetadata) {
      return this.activeArchiveMetadata;
    }
    if (this.activeArchivePath === archivePath && this.activeArchivePromise) {
      return this.activeArchivePromise;
    }
    this.activeArchivePath = archivePath;
    this.activeArchivePromise = module
      .openArchive(archivePath)
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

function metadataFromHeader(
  pack: ContentPack,
  header: ZimHeaderInfo | null,
  nativeReaderAvailable: boolean
): ZimMetadata | null {
  if (!header?.valid && !nativeReaderAvailable) return null;
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    articleCount: header?.valid ? header.articleCount : undefined,
    hasFulltextIndex: true,
    hasTitleIndex: true,
  };
}
