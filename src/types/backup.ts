import type { NoteContentFormat } from '@/constants/note-content';
import type { NoteThemeId } from '@/constants/note-themes';
import type { AiCitation } from '@/types/ai';
import type { ArkDocument } from '@/types/db';
import type { MapMarker, SavedRoute } from '@/types/maps';
import type { Track, TrackMarker, TrackPoint } from '@/types/tracks';

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

export type ArkBackupDocumentPage = {
  id: string;
  documentId: string;
  pageNumber: number;
  text: string;
  extractionMethod: 'text_layer' | 'ocr' | 'manual' | 'metadata';
  confidence: number | null;
  indexedAt: number | null;
  createdAt: number;
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

export type ArkBackupChatThread = {
  id: string;
  title: string;
  selectedModelId: string | null;
  chatModelDisabled: boolean | null;
  createdAt: number;
  updatedAt: number;
};

export type ArkBackupChatMessage = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  citations: AiCitation[];
  reasoning: string | null;
  metadata: Record<string, unknown> | null;
  deletedAt: number | null;
  createdAt: number;
};

export type ArkBackupTrack = Track;
export type ArkBackupTrackPoint = TrackPoint;
export type ArkBackupTrackMarker = TrackMarker & {
  backupPath: string | null;
};

export type ArkBackupManifest = {
  format: 'ark-backup';
  version: 3;
  exportedAt: number;
  app: {
    name: 'Ark';
    backupSchema: 3;
  };
  includes: {
    notes: true;
    richNoteContent: true;
    noteThemes: true;
    labels: true;
    importedDocuments: true;
    importedDocumentPages: true;
    mapMarkers: true;
    routes: true;
    readinessChecklist: true;
    rssSubscriptions: true;
    selectedSettings: true;
    chatThreads: true;
    chatMessages: true;
    tracks: true;
    trackPoints: true;
    trackMarkers: true;
  };
  excludes: string[];
  settings: ArkBackupSetting[];
  notes: ArkBackupNote[];
  documents: ArkBackupDocument[];
  documentPages: ArkBackupDocumentPage[];
  mapMarkers: MapMarker[];
  routes: SavedRoute[];
  rssFeeds: ArkBackupRssFeed[];
  chatThreads: ArkBackupChatThread[];
  chatMessages: ArkBackupChatMessage[];
  tracks: ArkBackupTrack[];
  trackPoints: ArkBackupTrackPoint[];
  trackMarkers: ArkBackupTrackMarker[];
};

export type ArkBackupEnvelope = {
  format: 'ark-backup-envelope';
  version: 3;
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
