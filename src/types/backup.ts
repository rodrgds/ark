import type { NoteContentFormat } from '@/constants/note-content';
import type { NoteThemeId } from '@/constants/note-themes';
import type { ArkDocument } from '@/types/db';
import type { MapMarker, SavedRoute } from '@/types/maps';

export type ArkBackupSetting = {
  key: string;
  value: string;
  updatedAt: number;
};

export type ArkBackupNote = {
  id: string;
  title: string;
  body: string;
  contentHtml: string | null;
  contentJson: string | null;
  contentFormat: NoteContentFormat;
  tags: string[];
  themeId: NoteThemeId;
  sortOrder: number;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ArkBackupDocument = Omit<
  ArkDocument,
  'localUri' | 'extractedText' | 'ocrText' | 'ocrStatus' | 'ocrError' | 'indexedAt'
> & {
  backupPath: string | null;
};

export type ArkBackupRssFeed = {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ArkBackupManifest = {
  format: 'ark-backup';
  version: 1;
  exportedAt: number;
  app: {
    name: 'Ark';
    backupSchema: 1;
  };
  includes: {
    notes: true;
    richNoteContent: true;
    noteThemes: true;
    labels: true;
    importedDocuments: true;
    mapMarkers: true;
    routes: true;
    readinessChecklist: true;
    rssSubscriptions: true;
    selectedSettings: true;
  };
  excludes: string[];
  settings: ArkBackupSetting[];
  notes: ArkBackupNote[];
  documents: ArkBackupDocument[];
  mapMarkers: MapMarker[];
  routes: SavedRoute[];
  rssFeeds: ArkBackupRssFeed[];
};

export type ArkBackupEnvelope = {
  format: 'ark-backup-envelope';
  version: 1;
  crypto: {
    algorithm: 'AES-256-GCM';
    kdf: 'scrypt';
    salt: string;
    nonce: string;
    N: number;
    r: number;
    p: number;
    dkLen: 32;
  };
  payload: string;
};
