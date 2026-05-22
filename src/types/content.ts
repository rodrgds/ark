export type ContentCategory =
  | 'Survival'
  | 'Medical'
  | 'Maps'
  | 'Wiki'
  | 'RSS'
  | 'AI Models'
  | 'Personal Documents';

export type ContentFormat = 'pdf' | 'markdown' | 'zim' | 'html' | 'txt' | 'bundle';

export type ContentPackManifest = {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  format: ContentFormat;
  estimatedSize: string;
  sourceUrl?: string;
  installed: boolean;
  disclaimer?: string;
};

export type ContentPack = ContentPackManifest & {
  localUri?: string | null;
  sizeBytes?: number | null;
  installStatus: 'not_installed' | 'queued' | 'downloading' | 'installed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
};
