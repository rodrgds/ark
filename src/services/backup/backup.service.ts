import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync, type ScryptOpts } from '@noble/hashes/scrypt.js';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DatabaseClient } from '@/services/db/client';
import { sqliteBoolean } from '@/services/db/sqlite-values';
import { FileSystemService } from '@/services/files/filesystem.service';
import { logger as log } from '@/lib/logger';
import { parseOrThrow, vaultPasswordSchema } from '@/lib/validation';
import type {
  ArkBackupChatMessage,
  ArkBackupChatThread,
  ArkBackupDocument,
  ArkBackupDocumentPage,
  ArkBackupEnvelope,
  ArkBackupManifest,
  ArkBackupNote,
  ArkBackupRssFeed,
  ArkBackupSetting,
  ArkBackupTrack,
  ArkBackupTrackMarker,
  ArkBackupTrackPoint,
} from '@/types/backup';
import type { ArkDocument } from '@/types/db';
import type { MapMarker, SavedRoute } from '@/types/maps';
import type { Track, TrackMarker, TrackPoint } from '@/types/tracks';

const BACKUP_VERSION = 3;
const BACKUP_AAD = strToU8('ark-backup-v3');
const BACKUP_FILE_PREFIX = 'Ark backup';
const MAX_BACKUP_ENVELOPE_BYTES = 96 * 1024 * 1024;
const MAX_BACKUP_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_BACKUP_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_BACKUP_RECORDS = 200_000;
const MAX_SCRYPT_N = 2 ** 16;
const MAX_SCRYPT_R = 8;
const MAX_SCRYPT_P = 2;
const SAFE_BACKUP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const DEFAULT_KDF: Required<Pick<ScryptOpts, 'N' | 'r' | 'p' | 'dkLen'>> = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  dkLen: 32,
};

export const BACKUP_SETTING_KEYS = [
  'theme.preference',
  'theme.accentPreference',
  'label.registry',
  'label.colors',
  'notes.sortMode',
  'tools.readiness-checklist',
  'battery.reduceModeEnabled',
  'downloads.wifiOnly',
  'ai.modelPickerEnabled',
  'ai.selectedModelId',
  'ai.selectedEmbeddingModelId',
  'ai.selectedVoiceModelId',
  'ai.chatModelDisabled',
  'field.unitSystem',
  'field.rateMode',
  'field.defaultTrackActivity',
  'field.recordingProfile',
] as const;

type BackupOptions = {
  kdf?: Required<Pick<ScryptOpts, 'N' | 'r' | 'p' | 'dkLen'>>;
};

type NoteRow = {
  id: string;
  title: string;
  body: string;
  content_html: string | null;
  content_json: string | null;
  content_format: ArkBackupNote['contentFormat'];
  tags_json: string | null;
  theme_id: ArkBackupNote['themeId'];
  sort_order: number | null;
  is_favorite: number;
  created_at: number;
  updated_at: number;
};

type DocumentRow = {
  id: string;
  title: string;
  mime_type: string | null;
  local_uri: string | null;
  size_bytes: number | null;
  sha256: string | null;
  source: string | null;
  is_personal: number;
  encryption_status: ArkDocument['encryptionStatus'];
  created_at: number;
  updated_at: number;
};

type MarkerRow = {
  id: string;
  title: string;
  description: string | null;
  pin_type: MapMarker['pinType'];
  is_emergency: number;
  latitude: number;
  longitude: number;
  photo_uri: string | null;
  icon: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
};

type RouteRow = {
  id: string;
  title: string;
  points_json: string;
  distance_meters: number | null;
  created_at: number;
  updated_at: number;
};

type RssFeedRow = {
  id: string;
  title: string;
  url: string;
  enabled: number;
  last_fetched_at: number | null;
  created_at: number;
  updated_at: number;
};

type ChatThreadRow = {
  id: string;
  title: string;
  selected_model_id: string | null;
  chat_model_disabled: number | null;
  created_at: number;
  updated_at: number;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  citations_json: string | null;
  reasoning: string | null;
  metadata_json: string | null;
  deleted_at: number | null;
  created_at: number;
};

type DocumentPageRow = {
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  extraction_method: ArkBackupDocumentPage['extractionMethod'];
  confidence: number | null;
  indexed_at: number | null;
  created_at: number;
};

type TrackRow = {
  id: string;
  title: string;
  description: string | null;
  activity_type: Track['activityType'];
  status: Track['status'];
  started_at: number;
  ended_at: number | null;
  timezone_offset_minutes: number;
  distance_meters: number;
  total_time_seconds: number;
  moving_time_seconds: number;
  average_speed_mps: number | null;
  average_moving_speed_mps: number | null;
  max_speed_mps: number | null;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  min_elevation_meters: number | null;
  max_elevation_meters: number | null;
  sample_count: number;
  marker_count: number;
  recording_gap_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type TrackPointRow = {
  id: string;
  track_id: string;
  segment_index: number;
  point_index: number;
  kind: TrackPoint['kind'];
  latitude: number | null;
  longitude: number | null;
  altitude_meters: number | null;
  altitude_source: TrackPoint['altitudeSource'];
  pressure_hpa: number | null;
  horizontal_accuracy_meters: number | null;
  vertical_accuracy_meters: number | null;
  speed_mps: number | null;
  bearing_degrees: number | null;
  distance_from_previous_meters: number;
  elapsed_seconds: number;
  moving_elapsed_seconds: number;
  recorded_at: number;
  created_at: number;
};

type TrackMarkerRow = {
  id: string;
  track_id: string;
  map_marker_id: string | null;
  title: string;
  description: string | null;
  marker_type: TrackMarker['markerType'];
  latitude: number;
  longitude: number;
  altitude_meters: number | null;
  recorded_at: number;
  elapsed_seconds: number;
  distance_meters: number;
  photo_uri: string | null;
  created_at: number;
  updated_at: number;
};

export class BackupService {
  static async createEncryptedBackup(passphrase: string, options: BackupOptions = {}) {
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const { manifest, zipBytes } = await this.createZipPayload();
    const kdf = options.kdf ?? DEFAULT_KDF;
    assertSafeKdf(kdf);
    const envelope = await encryptZip(zipBytes, backupPassphrase, kdf);
    const bytes = strToU8(JSON.stringify(envelope));
    return {
      bytes,
      manifest,
      fileName: backupFileName(manifest.exportedAt),
    };
  }

  static async exportToFile(passphrase: string, options: BackupOptions = {}) {
    const backup = await this.createEncryptedBackup(passphrase, options);
    await FileSystemService.ensureAppDirectories();
    const uri = `${FileSystemService.dir('backups')}${backup.fileName}`;
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(backup.bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ...backup, uri };
  }

  static async shareBackup(uri: string) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Share Ark backup',
      UTI: 'public.data',
    });
  }

  static async pickBackupFile() {
    return DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
  }

  static async importFromPicker(passphrase: string) {
    const result = await this.pickBackupFile();
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    return this.importFromFile(asset.uri, passphrase);
  }

  static async importFromFile(uri: string, passphrase: string) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && (info.size ?? 0) > MAX_BACKUP_ENVELOPE_BYTES) {
      throw new Error('Backup is too large to import safely on this device.');
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return this.importEncryptedBackup(base64ToBytes(base64), passphrase);
  }

  static async importEncryptedBackup(bytes: Uint8Array, passphrase: string) {
    assertSafeEnvelopeSize(bytes);
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const envelope = parseEnvelope(strFromU8(bytes));
    const zipBytes = await decryptZip(envelope, backupPassphrase);
    const zip = unzipBackup(zipBytes);
    const manifestBytes = zip['manifest.json'];
    if (!manifestBytes) throw new Error('Backup manifest is missing.');
    const manifest = parseManifest(strFromU8(manifestBytes));

    await this.restoreManifest(manifest, zip);
    return {
      manifest,
      restored: {
        notes: manifest.notes.length,
        documents: manifest.documents.length,
        mapMarkers: manifest.mapMarkers.length,
        routes: manifest.routes.length,
        tracks: manifest.tracks.length,
        rssFeeds: manifest.rssFeeds.length,
        settings: manifest.settings.length,
      },
    };
  }

  static async inspectEncryptedBackup(bytes: Uint8Array, passphrase: string) {
    assertSafeEnvelopeSize(bytes);
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const envelope = parseEnvelope(strFromU8(bytes));
    const zip = unzipBackup(await decryptZip(envelope, backupPassphrase));
    const manifestBytes = zip['manifest.json'];
    if (!manifestBytes) throw new Error('Backup manifest is missing.');
    return { manifest: parseManifest(strFromU8(manifestBytes)), entries: Object.keys(zip).sort() };
  }

  private static async createZipPayload() {
    const db = await DatabaseClient.getDb();
    const [
      settings,
      notes,
      documents,
      documentPages,
      mapMarkers,
      routes,
      rssFeeds,
      chatThreads,
      chatMessages,
      tracks,
      trackPoints,
      trackMarkers,
    ] = await Promise.all([
      exportSettings(),
      db.getAllAsync<NoteRow>(
        `SELECT id, title, body, content_html, content_json, content_format, tags_json, theme_id,
                sort_order, is_favorite, created_at, updated_at
         FROM notes
         WHERE deleted_at IS NULL
         ORDER BY sort_order ASC, updated_at DESC`
      ),
      db.getAllAsync<DocumentRow>(
        `SELECT id, title, mime_type, local_uri, size_bytes, sha256, source, is_personal,
                encryption_status, created_at, updated_at
         FROM documents
         ORDER BY updated_at DESC`
      ),
      db.getAllAsync<DocumentPageRow>(
        `SELECT id, document_id, page_number, text, extraction_method, confidence, indexed_at,
                created_at
         FROM document_pages
         ORDER BY document_id, page_number ASC`
      ),
      db.getAllAsync<MarkerRow>(
        `SELECT id, title, description, pin_type, is_emergency, latitude, longitude, photo_uri,
                icon, color, created_at, updated_at
         FROM map_markers
         ORDER BY updated_at DESC`
      ),
      db.getAllAsync<RouteRow>(
        `SELECT id, title, points_json, distance_meters, created_at, updated_at
         FROM routes
         ORDER BY updated_at DESC`
      ),
      db.getAllAsync<RssFeedRow>(
        `SELECT id, title, url, enabled, last_fetched_at, created_at, updated_at
         FROM rss_feeds
         ORDER BY title`
      ),
      db.getAllAsync<ChatThreadRow>(
        `SELECT id, title, selected_model_id, chat_model_disabled, created_at, updated_at
         FROM chat_threads
         ORDER BY updated_at DESC`
      ),
      db.getAllAsync<ChatMessageRow>(
        `SELECT id, thread_id, role, content, citations_json, reasoning, metadata_json,
                deleted_at, created_at
         FROM chat_messages
         ORDER BY thread_id, created_at ASC`
      ),
      db.getAllAsync<TrackRow>(
        `SELECT * FROM tracks
         WHERE deleted_at IS NULL AND status != 'discarded'
         ORDER BY started_at DESC`
      ),
      db.getAllAsync<TrackPointRow>(
        `SELECT * FROM track_points
         WHERE track_id IN (SELECT id FROM tracks WHERE deleted_at IS NULL AND status != 'discarded')
         ORDER BY track_id, point_index ASC`
      ),
      db.getAllAsync<TrackMarkerRow>(
        `SELECT * FROM track_markers
         WHERE track_id IN (SELECT id FROM tracks WHERE deleted_at IS NULL AND status != 'discarded')
         ORDER BY track_id, recorded_at ASC`
      ),
    ]);

    const zipEntries: Record<string, Uint8Array> = {};
    const backupDocuments: ArkBackupDocument[] = [];
    for (const document of documents) {
      const backupPath = await addDocumentToZip(zipEntries, document);
      backupDocuments.push({
        id: document.id,
        title: document.title,
        mimeType: document.mime_type,
        sizeBytes: document.size_bytes,
        sha256: document.sha256,
        source: document.source,
        isPersonal: !!document.is_personal,
        encryptionStatus: document.encryption_status,
        backupPath,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      });
    }
    const backupTrackMarkers: ArkBackupTrackMarker[] = [];
    for (const marker of trackMarkers) {
      const backupPath = await addTrackMarkerPhotoToZip(zipEntries, marker);
      backupTrackMarkers.push({ ...mapTrackMarkerBackup(marker), backupPath });
    }

    const manifest: ArkBackupManifest = {
      format: 'ark-backup',
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      app: {
        name: 'Ark',
        backupSchema: BACKUP_VERSION,
      },
      includes: {
        notes: true,
        richNoteContent: true,
        noteThemes: true,
        labels: true,
        importedDocuments: true,
        importedDocumentPages: true,
        mapMarkers: true,
        routes: true,
        readinessChecklist: true,
        rssSubscriptions: true,
        selectedSettings: true,
        chatThreads: true,
        chatMessages: true,
        tracks: true,
        trackPoints: true,
        trackMarkers: true,
      },
      excludes: [
        'models',
        'offline maps',
        'guide packs',
        'ZIM archives',
        'embeddings',
        'OCR indexes',
        'RAG indexes',
        'RSS item cache',
        'download queues',
      ],
      settings,
      notes: notes.map(mapNoteBackup),
      documents: backupDocuments,
      documentPages: documentPages.map(mapDocumentPageBackup),
      mapMarkers: mapMarkers.map(mapMarkerBackup),
      routes: routes.map(mapRouteBackup),
      rssFeeds: rssFeeds.map(mapRssFeedBackup),
      chatThreads: chatThreads.map(mapChatThreadBackup),
      chatMessages: chatMessages.map(mapChatMessageBackup),
      tracks: tracks.map(mapTrackBackup),
      trackPoints: trackPoints.map(mapTrackPointBackup),
      trackMarkers: backupTrackMarkers,
    };

    zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest));
    assertSafeZipEntriesSize(zipEntries);
    const zipBytes = zipSync(zipEntries, { level: 6, mtime: new Date('1980-01-01T00:00:00Z') });
    if (zipBytes.byteLength > MAX_BACKUP_UNCOMPRESSED_BYTES) {
      throw new Error('Backup is too large to create safely on this device.');
    }
    return {
      manifest,
      zipBytes,
    };
  }

  private static async restoreManifest(
    manifest: ArkBackupManifest,
    zip: Record<string, Uint8Array>
  ) {
    await FileSystemService.ensureAppDirectories();
    const restoredDocuments = await restoreDocumentFiles(manifest.documents, zip);
    const restoredTrackMarkers = await restoreTrackMarkerPhotos(manifest.trackMarkers, zip);
    const db = await DatabaseClient.getDb();

    await db.withTransactionAsync(async (tx) => {
      for (const setting of manifest.settings) {
        await tx.runAsync(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [setting.key, setting.value, setting.updatedAt]
        );
      }

      for (const note of manifest.notes) {
        await tx.runAsync(
          `INSERT INTO notes
            (id, title, body, content_html, content_json, content_format, tags_json, theme_id,
             sort_order, is_favorite, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             body = excluded.body,
             content_html = excluded.content_html,
             content_json = excluded.content_json,
             content_format = excluded.content_format,
             tags_json = excluded.tags_json,
             theme_id = excluded.theme_id,
             sort_order = excluded.sort_order,
             is_favorite = excluded.is_favorite,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             deleted_at = NULL`,
          [
            note.id,
            note.title || 'Untitled note',
            note.body,
            note.contentHtml,
            note.contentJson,
            note.contentFormat,
            JSON.stringify(note.tags),
            note.themeId,
            note.sortOrder,
            note.isFavorite ? 1 : 0,
            note.createdAt,
            note.updatedAt,
          ]
        );
        await tx.runAsync('DELETE FROM notes_fts WHERE note_id = ?', [note.id]);
        await tx.runAsync(
          'INSERT INTO notes_fts (note_id, title, body, tags) VALUES (?, ?, ?, ?)',
          [note.id, note.title || 'Untitled note', note.body, note.tags.join(' ')]
        );
      }

      for (const document of restoredDocuments) {
        await tx.runAsync('DELETE FROM document_pages_fts WHERE document_id = ?', [document.id]);
        await tx.runAsync('DELETE FROM document_pages WHERE document_id = ?', [document.id]);
        await tx.runAsync(
          `INSERT INTO documents
            (id, title, mime_type, local_uri, size_bytes, sha256, source, is_personal,
             encryption_status, extracted_text, ocr_text, ocr_status, ocr_error, indexed_at,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             mime_type = excluded.mime_type,
             local_uri = excluded.local_uri,
             size_bytes = excluded.size_bytes,
             sha256 = excluded.sha256,
             source = excluded.source,
             is_personal = excluded.is_personal,
             encryption_status = excluded.encryption_status,
             extracted_text = NULL,
             ocr_text = NULL,
             ocr_status = excluded.ocr_status,
             ocr_error = NULL,
             indexed_at = NULL,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            document.id,
            document.title,
            document.mimeType,
            document.localUri,
            document.sizeBytes,
            document.sha256,
            document.source,
            document.isPersonal ? 1 : 0,
            document.encryptionStatus,
            getRestoredDocumentOcrStatus(document),
            document.createdAt,
            document.updatedAt,
          ]
        );
      }

      for (const marker of manifest.mapMarkers) {
        await tx.runAsync(
          `INSERT INTO map_markers
            (id, title, description, pin_type, is_emergency, latitude, longitude, photo_uri, icon,
             color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             pin_type = excluded.pin_type,
             is_emergency = excluded.is_emergency,
             latitude = excluded.latitude,
             longitude = excluded.longitude,
             photo_uri = excluded.photo_uri,
             icon = excluded.icon,
             color = excluded.color,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            marker.id,
            marker.title,
            marker.description,
            marker.pinType,
            marker.isEmergencyPin ? 1 : 0,
            marker.latitude,
            marker.longitude,
            marker.photoUri,
            marker.icon,
            marker.color,
            marker.createdAt,
            marker.updatedAt,
          ]
        );
      }

      for (const route of manifest.routes) {
        await tx.runAsync(
          `INSERT INTO routes
            (id, title, points_json, distance_meters, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             points_json = excluded.points_json,
             distance_meters = excluded.distance_meters,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            route.id,
            route.title,
            JSON.stringify(route.points),
            route.distanceMeters,
            route.createdAt,
            route.updatedAt,
          ]
        );
      }

      for (const feed of manifest.rssFeeds) {
        await tx.runAsync(
          `INSERT INTO rss_feeds
            (id, title, url, enabled, last_fetched_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET
             id = excluded.id,
             title = excluded.title,
             enabled = excluded.enabled,
             last_fetched_at = excluded.last_fetched_at,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            feed.id,
            feed.title,
            feed.url,
            feed.enabled ? 1 : 0,
            feed.lastFetchedAt,
            feed.createdAt,
            feed.updatedAt,
          ]
        );
      }

      const restoredPageDocumentIds = new Set<string>();
      for (const page of manifest.documentPages ?? []) {
        await tx.runAsync(
          `INSERT INTO document_pages
            (id, document_id, page_number, text, extraction_method, confidence, indexed_at,
             created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(document_id, page_number) DO UPDATE SET
             id = excluded.id,
             text = excluded.text,
             extraction_method = excluded.extraction_method,
             confidence = excluded.confidence,
             indexed_at = excluded.indexed_at`,
          [
            page.id,
            page.documentId,
            page.pageNumber,
            page.text,
            page.extractionMethod,
            page.confidence,
            page.indexedAt,
            page.createdAt,
          ]
        );
        restoredPageDocumentIds.add(page.documentId);
      }

      for (const page of manifest.documentPages ?? []) {
        await tx.runAsync('DELETE FROM document_pages_fts WHERE page_id = ?', [page.id]);
        await tx.runAsync(
          `INSERT INTO document_pages_fts (page_id, document_id, text, title)
           VALUES (?, ?, ?, ?)`,
          [page.id, page.documentId, page.text, '']
        );
      }

      for (const thread of manifest.chatThreads ?? []) {
        await tx.runAsync(
          `INSERT INTO chat_threads
            (id, title, selected_model_id, chat_model_disabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             selected_model_id = excluded.selected_model_id,
             chat_model_disabled = excluded.chat_model_disabled,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            thread.id,
            thread.title,
            thread.selectedModelId,
            thread.chatModelDisabled == null ? null : thread.chatModelDisabled ? 1 : 0,
            thread.createdAt,
            thread.updatedAt,
          ]
        );
      }

      for (const message of manifest.chatMessages ?? []) {
        await tx.runAsync(
          `INSERT INTO chat_messages
            (id, thread_id, role, content, citations_json, reasoning, metadata_json,
             deleted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             thread_id = excluded.thread_id,
             role = excluded.role,
             content = excluded.content,
             citations_json = excluded.citations_json,
             reasoning = excluded.reasoning,
             metadata_json = excluded.metadata_json,
             deleted_at = excluded.deleted_at,
             created_at = excluded.created_at`,
          [
            message.id,
            message.threadId,
            message.role,
            message.content,
            JSON.stringify(message.citations),
            message.reasoning,
            message.metadata ? JSON.stringify(message.metadata) : null,
            message.deletedAt,
            message.createdAt,
          ]
        );
      }

      for (const track of manifest.tracks) {
        await tx.runAsync('DELETE FROM track_markers WHERE track_id = ?', [track.id]);
        await tx.runAsync('DELETE FROM track_points WHERE track_id = ?', [track.id]);
        await tx.runAsync(
          `INSERT INTO tracks
            (id, title, description, activity_type, status, started_at, ended_at,
             timezone_offset_minutes, distance_meters, total_time_seconds, moving_time_seconds,
             average_speed_mps, average_moving_speed_mps, max_speed_mps, elevation_gain_meters,
             elevation_loss_meters, min_elevation_meters, max_elevation_meters, sample_count,
             marker_count, recording_gap_count, last_error, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             activity_type = excluded.activity_type,
             status = excluded.status,
             started_at = excluded.started_at,
             ended_at = excluded.ended_at,
             timezone_offset_minutes = excluded.timezone_offset_minutes,
             distance_meters = excluded.distance_meters,
             total_time_seconds = excluded.total_time_seconds,
             moving_time_seconds = excluded.moving_time_seconds,
             average_speed_mps = excluded.average_speed_mps,
             average_moving_speed_mps = excluded.average_moving_speed_mps,
             max_speed_mps = excluded.max_speed_mps,
             elevation_gain_meters = excluded.elevation_gain_meters,
             elevation_loss_meters = excluded.elevation_loss_meters,
             min_elevation_meters = excluded.min_elevation_meters,
             max_elevation_meters = excluded.max_elevation_meters,
             sample_count = excluded.sample_count,
             marker_count = excluded.marker_count,
             recording_gap_count = excluded.recording_gap_count,
             last_error = excluded.last_error,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             deleted_at = NULL`,
          [
            track.id,
            track.title,
            track.description,
            track.activityType,
            track.status,
            track.startedAt,
            track.endedAt,
            track.timezoneOffsetMinutes,
            track.distanceMeters,
            track.totalTimeSeconds,
            track.movingTimeSeconds,
            track.averageSpeedMps,
            track.averageMovingSpeedMps,
            track.maxSpeedMps,
            track.elevationGainMeters,
            track.elevationLossMeters,
            track.minElevationMeters,
            track.maxElevationMeters,
            track.sampleCount,
            track.markerCount,
            track.recordingGapCount,
            track.lastError,
            track.createdAt,
            track.updatedAt,
          ]
        );
      }

      for (const point of manifest.trackPoints) {
        await tx.runAsync(
          `INSERT INTO track_points
            (id, track_id, segment_index, point_index, kind, latitude, longitude, altitude_meters,
             altitude_source, pressure_hpa, horizontal_accuracy_meters, vertical_accuracy_meters,
             speed_mps, bearing_degrees, distance_from_previous_meters, elapsed_seconds,
             moving_elapsed_seconds, recorded_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            point.id,
            point.trackId,
            point.segmentIndex,
            point.pointIndex,
            point.kind,
            point.latitude,
            point.longitude,
            point.altitudeMeters,
            point.altitudeSource,
            point.pressureHpa,
            point.horizontalAccuracyMeters,
            point.verticalAccuracyMeters,
            point.speedMps,
            point.bearingDegrees,
            point.distanceFromPreviousMeters,
            point.elapsedSeconds,
            point.movingElapsedSeconds,
            point.recordedAt,
            point.createdAt,
          ]
        );
      }

      for (const marker of restoredTrackMarkers) {
        await tx.runAsync(
          `INSERT INTO track_markers
            (id, track_id, map_marker_id, title, description, marker_type, latitude, longitude,
             altitude_meters, recorded_at, elapsed_seconds, distance_meters, photo_uri, created_at,
             updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            marker.id,
            marker.trackId,
            marker.mapMarkerId,
            marker.title,
            marker.description,
            marker.markerType,
            marker.latitude,
            marker.longitude,
            marker.altitudeMeters,
            marker.recordedAt,
            marker.elapsedSeconds,
            marker.distanceMeters,
            marker.photoUri,
            marker.createdAt,
            marker.updatedAt,
          ]
        );
      }
    });

    await reindexFts(manifest);
  }
}

async function exportSettings(): Promise<ArkBackupSetting[]> {
  const db = await DatabaseClient.getDb();
  const placeholders = BACKUP_SETTING_KEYS.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string; updated_at: number }>(
    `SELECT key, value, updated_at FROM app_settings WHERE key IN (${placeholders}) ORDER BY key`,
    [...BACKUP_SETTING_KEYS]
  );
  return rows.map((row) => ({ key: row.key, value: row.value, updatedAt: row.updated_at }));
}

async function addDocumentToZip(zipEntries: Record<string, Uint8Array>, document: DocumentRow) {
  if (!document.local_uri) return null;
  const info = await FileSystem.getInfoAsync(document.local_uri).catch(() => null);
  if (!info?.exists) return null;
  assertSafeExportEntrySize('document', document.title, 'size' in info ? info.size : null);
  const fileName = FileSystemService.safeFileName(document.title || `${document.id}.document`);
  const path = `documents/${document.id}/${fileName}`;
  const base64 = await FileSystem.readAsStringAsync(document.local_uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  zipEntries[path] = base64ToBytes(base64);
  assertSafeZipEntriesSize(zipEntries);
  return path;
}

async function addTrackMarkerPhotoToZip(
  zipEntries: Record<string, Uint8Array>,
  marker: TrackMarkerRow
) {
  if (!marker.photo_uri) return null;
  const info = await FileSystem.getInfoAsync(marker.photo_uri).catch(() => null);
  if (!info?.exists) return null;
  assertSafeExportEntrySize('track photo', marker.title, 'size' in info ? info.size : null);
  const fileName = FileSystemService.safeFileName(marker.title || `${marker.id}.jpg`);
  const path = `track-markers/${marker.id}/${fileName}`;
  const base64 = await FileSystem.readAsStringAsync(marker.photo_uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  zipEntries[path] = base64ToBytes(base64);
  assertSafeZipEntriesSize(zipEntries);
  return path;
}

async function restoreDocumentFiles(
  documents: ArkBackupDocument[],
  zip: Record<string, Uint8Array>
) {
  const restored: Array<ArkBackupDocument & { localUri: string | null }> = [];
  for (const document of documents) {
    let localUri: string | null = null;
    if (document.backupPath) {
      const bytes = zip[document.backupPath];
      if (!bytes) throw new Error(`Backup document payload is missing: ${document.title}`);
      const safeName = FileSystemService.safeFileName(document.title || `${document.id}.document`);
      localUri = `${FileSystemService.dir('imports')}${document.id}-${safeName}`;
      await FileSystem.writeAsStringAsync(localUri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    restored.push({ ...document, localUri });
  }
  return restored;
}

async function restoreTrackMarkerPhotos(
  markers: ArkBackupTrackMarker[],
  zip: Record<string, Uint8Array>
) {
  const restored: TrackMarker[] = [];
  for (const marker of markers) {
    let photoUri: string | null = null;
    if (marker.backupPath) {
      const bytes = zip[marker.backupPath];
      if (!bytes) throw new Error(`Backup track photo is missing: ${marker.title}`);
      const safeName = FileSystemService.safeFileName(marker.title || `${marker.id}.jpg`);
      photoUri = `${FileSystemService.dir('tracks')}${marker.id}-${safeName}`;
      await FileSystem.writeAsStringAsync(photoUri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    restored.push({ ...marker, photoUri });
  }
  return restored;
}

function mapNoteBackup(row: NoteRow): ArkBackupNote {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    contentHtml: row.content_html,
    contentJson: row.content_json,
    contentFormat: row.content_format,
    tags: parseJsonArray(row.tags_json),
    themeId: row.theme_id,
    sortOrder: row.sort_order ?? row.updated_at,
    isFavorite: sqliteBoolean(row.is_favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMarkerBackup(row: MarkerRow): MapMarker {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pinType: row.pin_type,
    isEmergencyPin: sqliteBoolean(row.is_emergency),
    latitude: row.latitude,
    longitude: row.longitude,
    photoUri: row.photo_uri,
    icon: row.icon,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRouteBackup(row: RouteRow): SavedRoute {
  return {
    id: row.id,
    title: row.title,
    points: parseRoutePoints(row.points_json),
    distanceMeters: row.distance_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRssFeedBackup(row: RssFeedRow): ArkBackupRssFeed {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    enabled: sqliteBoolean(row.enabled),
    lastFetchedAt: row.last_fetched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentPageBackup(row: DocumentPageRow): ArkBackupDocumentPage {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    text: row.text,
    extractionMethod: row.extraction_method,
    confidence: row.confidence,
    indexedAt: row.indexed_at,
    createdAt: row.created_at,
  };
}

function mapChatThreadBackup(row: ChatThreadRow): ArkBackupChatThread {
  return {
    id: row.id,
    title: row.title,
    selectedModelId: row.selected_model_id,
    chatModelDisabled: row.chat_model_disabled == null ? null : !!row.chat_model_disabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChatMessageBackup(row: ChatMessageRow): ArkBackupChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    citations: parseJsonCitations(row.citations_json),
    reasoning: row.reasoning,
    metadata: parseJsonObject(row.metadata_json),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

function mapTrackBackup(row: TrackRow): ArkBackupTrack {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    activityType: row.activity_type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    timezoneOffsetMinutes: row.timezone_offset_minutes,
    distanceMeters: row.distance_meters,
    totalTimeSeconds: row.total_time_seconds,
    movingTimeSeconds: row.moving_time_seconds,
    averageSpeedMps: row.average_speed_mps,
    averageMovingSpeedMps: row.average_moving_speed_mps,
    maxSpeedMps: row.max_speed_mps,
    elevationGainMeters: row.elevation_gain_meters,
    elevationLossMeters: row.elevation_loss_meters,
    minElevationMeters: row.min_elevation_meters,
    maxElevationMeters: row.max_elevation_meters,
    sampleCount: row.sample_count,
    markerCount: row.marker_count,
    recordingGapCount: row.recording_gap_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapTrackPointBackup(row: TrackPointRow): ArkBackupTrackPoint {
  return {
    id: row.id,
    trackId: row.track_id,
    segmentIndex: row.segment_index,
    pointIndex: row.point_index,
    kind: row.kind,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitude_meters,
    altitudeSource: row.altitude_source,
    pressureHpa: row.pressure_hpa,
    horizontalAccuracyMeters: row.horizontal_accuracy_meters,
    verticalAccuracyMeters: row.vertical_accuracy_meters,
    speedMps: row.speed_mps,
    bearingDegrees: row.bearing_degrees,
    distanceFromPreviousMeters: row.distance_from_previous_meters,
    elapsedSeconds: row.elapsed_seconds,
    movingElapsedSeconds: row.moving_elapsed_seconds,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function mapTrackMarkerBackup(row: TrackMarkerRow): TrackMarker {
  return {
    id: row.id,
    trackId: row.track_id,
    mapMarkerId: row.map_marker_id,
    title: row.title,
    description: row.description,
    markerType: row.marker_type,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitude_meters,
    recordedAt: row.recorded_at,
    elapsedSeconds: row.elapsed_seconds,
    distanceMeters: row.distance_meters,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function encryptZip(
  zipBytes: Uint8Array,
  passphrase: string,
  kdf: Required<Pick<ScryptOpts, 'N' | 'r' | 'p' | 'dkLen'>>
): Promise<ArkBackupEnvelope> {
  const [salt, nonce] = await Promise.all([
    Crypto.getRandomBytesAsync(16),
    Crypto.getRandomBytesAsync(12),
  ]);
  const key = await scryptAsync(passphrase, salt, {
    ...kdf,
    asyncTick: 10,
  });
  const payload = gcm(key, nonce, BACKUP_AAD).encrypt(zipBytes);
  return {
    format: 'ark-backup-envelope',
    version: BACKUP_VERSION,
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'scrypt',
      salt: bytesToBase64(salt),
      nonce: bytesToBase64(nonce),
      N: kdf.N,
      r: kdf.r,
      p: kdf.p,
      dkLen: 32,
    },
    payload: bytesToBase64(payload),
  };
}

async function decryptZip(envelope: ArkBackupEnvelope, passphrase: string) {
  const key = await scryptAsync(passphrase, base64ToBytes(envelope.crypto.salt), {
    N: envelope.crypto.N,
    r: envelope.crypto.r,
    p: envelope.crypto.p,
    dkLen: envelope.crypto.dkLen,
    asyncTick: 10,
  });
  try {
    return gcm(key, base64ToBytes(envelope.crypto.nonce), BACKUP_AAD).decrypt(
      base64ToBytes(envelope.payload)
    );
  } catch {
    throw new Error('Backup passphrase did not match or the file is damaged.');
  }
}

function parseEnvelope(value: string): ArkBackupEnvelope {
  const parsed = JSON.parse(value) as ArkBackupEnvelope;
  if (
    parsed.format !== 'ark-backup-envelope' ||
    parsed.version !== BACKUP_VERSION ||
    parsed.crypto?.algorithm !== 'AES-256-GCM' ||
    parsed.crypto?.kdf !== 'scrypt' ||
    typeof parsed.crypto.salt !== 'string' ||
    typeof parsed.crypto.nonce !== 'string' ||
    typeof parsed.payload !== 'string'
  ) {
    throw new Error('This is not a supported Ark backup file.');
  }
  assertSafeKdf(parsed.crypto);
  if (
    !isCanonicalBase64(parsed.crypto.salt, 16) ||
    !isCanonicalBase64(parsed.crypto.nonce, 12) ||
    !isCanonicalBase64(parsed.payload)
  ) {
    throw new Error('This is not a supported Ark backup file.');
  }
  return parsed;
}

function parseManifest(value: string): ArkBackupManifest {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed) || parsed.format !== 'ark-backup') {
    throw new Error('Backup manifest format is not supported.');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup manifest version ${parsed.version} is not supported. Re-export the backup from this app version.`
    );
  }
  validateManifestShape(parsed);
  return sanitizeManifestUris(parsed as ArkBackupManifest);
}

function assertSafeEnvelopeSize(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_BACKUP_ENVELOPE_BYTES) {
    throw new Error('Backup is too large to import safely on this device.');
  }
}

function assertSafeKdf(kdf: Required<Pick<ScryptOpts, 'N' | 'r' | 'p' | 'dkLen'>>) {
  if (
    !Number.isInteger(kdf.N) ||
    kdf.N < 2 ** 10 ||
    kdf.N > MAX_SCRYPT_N ||
    (kdf.N & (kdf.N - 1)) !== 0 ||
    !Number.isInteger(kdf.r) ||
    kdf.r < 1 ||
    kdf.r > MAX_SCRYPT_R ||
    !Number.isInteger(kdf.p) ||
    kdf.p < 1 ||
    kdf.p > MAX_SCRYPT_P ||
    kdf.dkLen !== 32
  ) {
    throw new Error('Backup encryption parameters are outside Ark safety limits.');
  }
}

function unzipBackup(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error('Backup archive is too large to expand safely.');
  }
  let expandedBytes = 0;
  return unzipSync(bytes, {
    filter(file) {
      if (!isSafeBackupPath(file.name) || file.originalSize > MAX_BACKUP_ENTRY_BYTES) {
        throw new Error('Backup contains an unsafe archive entry.');
      }
      expandedBytes += file.originalSize;
      if (expandedBytes > MAX_BACKUP_UNCOMPRESSED_BYTES) {
        throw new Error('Backup expands beyond the safe import limit.');
      }
      return true;
    },
  });
}

function assertSafeExportEntrySize(kind: string, title: string, size: number | null | undefined) {
  if (size != null && size > MAX_BACKUP_ENTRY_BYTES) {
    throw new Error(`${kind} is too large to back up safely: ${title}`);
  }
}

function assertSafeZipEntriesSize(entries: Record<string, Uint8Array>) {
  const total = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0);
  if (total > MAX_BACKUP_UNCOMPRESSED_BYTES) {
    throw new Error('Backup contents are too large to process safely on this device.');
  }
}

function isSafeBackupPath(path: string) {
  return (
    path === 'manifest.json' ||
    (/^(documents|track-markers)\/[^/]+\/[^/]+$/.test(path) &&
      !path.includes('..') &&
      !path.includes('\\') &&
      !path.includes('\0'))
  );
}

function isCanonicalBase64(value: string, expectedBytes?: number) {
  if (
    !value ||
    value.length > MAX_BACKUP_ENVELOPE_BYTES * 2 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    return false;
  }
  try {
    const bytes = base64ToBytes(value);
    return expectedBytes == null || bytes.byteLength === expectedBytes;
  } catch {
    return false;
  }
}

function validateManifestShape(manifest: Record<string, unknown>) {
  const collectionKeys = [
    'settings',
    'notes',
    'documents',
    'documentPages',
    'mapMarkers',
    'routes',
    'rssFeeds',
    'chatThreads',
    'chatMessages',
    'tracks',
    'trackPoints',
    'trackMarkers',
  ] as const;
  let recordCount = 0;
  for (const key of collectionKeys) {
    if (!Array.isArray(manifest[key])) throw new Error(`Backup manifest ${key} is invalid.`);
    recordCount += manifest[key].length;
  }
  if (recordCount > MAX_BACKUP_RECORDS) throw new Error('Backup contains too many records.');

  const idsByCollection = new Map<string, Set<string>>();
  for (const key of [
    'notes',
    'documents',
    'documentPages',
    'mapMarkers',
    'routes',
    'rssFeeds',
    'chatThreads',
    'chatMessages',
    'tracks',
    'trackPoints',
    'trackMarkers',
  ] as const) {
    const ids = new Set<string>();
    for (const item of manifest[key] as unknown[]) {
      if (!isRecord(item) || typeof item.id !== 'string' || !SAFE_BACKUP_ID.test(item.id)) {
        throw new Error(`Backup manifest ${key} contains an invalid identifier.`);
      }
      if (ids.has(item.id))
        throw new Error(`Backup manifest ${key} contains duplicate identifiers.`);
      ids.add(item.id);
    }
    idsByCollection.set(key, ids);
  }

  validateReferences(manifest, idsByCollection);
  validatePayloadPaths(manifest.documents as unknown[], 'documents');
  validatePayloadPaths(manifest.trackMarkers as unknown[], 'track-markers');
}

function validateReferences(manifest: Record<string, unknown>, ids: Map<string, Set<string>>) {
  const checks = [
    ['documentPages', 'documentId', 'documents'],
    ['chatMessages', 'threadId', 'chatThreads'],
    ['trackPoints', 'trackId', 'tracks'],
    ['trackMarkers', 'trackId', 'tracks'],
  ] as const;
  for (const [collection, foreignKey, parentCollection] of checks) {
    for (const item of manifest[collection] as unknown[]) {
      if (
        !isRecord(item) ||
        typeof item[foreignKey] !== 'string' ||
        !ids.get(parentCollection)?.has(item[foreignKey] as string)
      ) {
        throw new Error(`Backup manifest ${collection} contains an invalid reference.`);
      }
    }
  }
}

function validatePayloadPaths(items: unknown[], root: 'documents' | 'track-markers') {
  for (const item of items) {
    if (!isRecord(item)) throw new Error(`Backup manifest ${root} is invalid.`);
    const backupPath = item.backupPath;
    if (backupPath == null) continue;
    if (
      typeof backupPath !== 'string' ||
      !isSafeBackupPath(backupPath) ||
      !backupPath.startsWith(`${root}/${item.id as string}/`)
    ) {
      throw new Error(`Backup manifest ${root} contains an unsafe payload path.`);
    }
  }
}

function sanitizeManifestUris(manifest: ArkBackupManifest): ArkBackupManifest {
  return {
    ...manifest,
    mapMarkers: manifest.mapMarkers.map((marker) => ({ ...marker, photoUri: null })),
    trackMarkers: manifest.trackMarkers.map((marker) => ({
      ...marker,
      photoUri: null,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getRestoredDocumentOcrStatus(document: ArkBackupDocument): ArkDocument['ocrStatus'] {
  const title = document.title.toLowerCase();
  const mimeType = document.mimeType?.toLowerCase() ?? '';
  if (mimeType.includes('pdf') || title.endsWith('.pdf')) return 'pending';
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|heic|tiff?)$/.test(title)) {
    return 'pending';
  }
  return 'not_needed';
}

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function parseJsonCitations(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ArkBackupChatMessage['citations'][number] => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof (item as { sourceId?: unknown }).sourceId === 'string' &&
        typeof (item as { title?: unknown }).title === 'string' &&
        typeof (item as { snippet?: unknown }).snippet === 'string'
      );
    });
  } catch {
    return [];
  }
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

async function reindexFts(manifest: ArkBackupManifest) {
  const db = await DatabaseClient.getDb();
  try {
    if (manifest.notes.length > 0) {
      await db.execAsync(`INSERT INTO notes_fts(notes_fts) VALUES('rebuild')`);
    }
  } catch (error) {
    log.warn('Failed to rebuild notes_fts after restore', { error });
  }
  try {
    if ((manifest.documentPages?.length ?? 0) > 0) {
      await db.execAsync(`INSERT INTO document_pages_fts(document_pages_fts) VALUES('rebuild')`);
    }
  } catch (error) {
    log.warn('Failed to rebuild document_pages_fts after restore', { error });
  }
  try {
    await db.execAsync(`INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')`);
  } catch (error) {
    log.warn('Failed to rebuild rag_chunks_fts after restore', { error });
  }
}

function parseRoutePoints(value: string): SavedRoute['points'] {
  try {
    const parsed = JSON.parse(value) as SavedRoute['points'];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function backupFileName(timestamp: number) {
  return `${BACKUP_FILE_PREFIX}-${new Date(timestamp).toISOString().replace(/[:.]/g, '-')}.arkbackup`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
