export type ContentCategory =
  | 'Survival'
  | 'Medical'
  | 'Maps'
  | 'Wiki'
  | 'RSS'
  | 'AI Models'
  | 'Personal Documents';

export type ContentFormat = 'pdf' | 'markdown' | 'zim' | 'html' | 'txt' | 'bundle' | 'gguf';

export type ContentPackManifest = {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  format: ContentFormat;
  estimatedSize: string;
  sizeBytes?: number | null;
  sourceUrl?: string;
  sourceLabel?: string;
  fileName?: string;
  checksumMd5?: string | null;
  checksumSha256?: string | null;
  checksumSha256Url?: string | null;
  installed: boolean;
  disclaimer?: string;
};

export type ContentPack = ContentPackManifest & {
  localUri?: string | null;
  sizeBytes?: number | null;
  installStatus:
    | 'not_installed'
    | 'queued'
    | 'downloading'
    | 'verifying'
    | 'paused'
    | 'installed'
    | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
};
