import { NativeModule, requireNativeModule } from 'expo-modules-core';

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

declare class ArkZimModule extends NativeModule {
  openArchive(path: string): Promise<ZimMetadata>;
  getArticle(path: string): Promise<ZimArticle>;
  search(query: string, limit?: number): Promise<ZimSearchResult[]>;
  suggest(prefix: string, limit?: number): Promise<ZimSearchResult[]>;
}

export default requireNativeModule<ArkZimModule>('ArkZim');
