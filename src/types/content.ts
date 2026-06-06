export type ContentCategory =
  | 'Survival'
  | 'Medical'
  | 'Maps'
  | 'Wiki'
  | 'RSS'
  | 'AI Models'
  | 'Preparedness'
  | 'Personal Documents'
  | 'Disasters'
  | 'Food'
  | 'Comms'
  | 'Safety'
  | 'Health';

export type ContentFormat = 'pdf' | 'markdown' | 'zim' | 'html' | 'txt' | 'bundle' | 'gguf';
export type ContentModelRole = 'embedding' | 'chat' | 'voice' | 'voiceProjector';
type ContentDownloadStrategy = 'file' | 'html_snapshot';

export type ContentPackManifest = {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  format: ContentFormat;
  modelRole?: ContentModelRole;
  downloadStrategy?: ContentDownloadStrategy;
  estimatedSize: string;
  sizeBytes?: number | null;
  sourceUrl?: string;
  sourceLabel?: string;
  fileName?: string;
  checksumMd5?: string | null;
  checksumSha256?: string | null;
  checksumSha256Url?: string | null;
  installed: boolean;
  testOnly?: boolean;
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
