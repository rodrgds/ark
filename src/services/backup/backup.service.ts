import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync, type ScryptOpts } from '@noble/hashes/scrypt.js';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { DatabaseClient } from '@/services/db/client';
import { FileSystemService } from '@/services/files/filesystem.service';
import { parseOrThrow, vaultPasswordSchema } from '@/lib/validation';
import type {
  ArkBackupDocument,
  ArkBackupEnvelope,
  ArkBackupManifest,
  ArkBackupNote,
  ArkBackupRssFeed,
  ArkBackupSetting,
} from '@/types/backup';
import type { ArkDocument } from '@/types/db';
import type { MapMarker, SavedRoute } from '@/types/maps';

const BACKUP_VERSION = 1;
const BACKUP_AAD = strToU8('ark-backup-v1');
const BACKUP_FILE_PREFIX = 'Ark backup';
const DEFAULT_KDF: Required<Pick<ScryptOpts, 'N' | 'r' | 'p' | 'dkLen'>> = {
  N: 2 ** 15,
  r: 8,
  p: 1,
  dkLen: 32,
};

export const BACKUP_SETTING_KEYS = [
  'theme.preference',
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

export class BackupService {
  static async createEncryptedBackup(passphrase: string, options: BackupOptions = {}) {
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const { manifest, zipBytes } = await this.createZipPayload();
    const envelope = await encryptZip(zipBytes, backupPassphrase, options.kdf ?? DEFAULT_KDF);
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
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return this.importEncryptedBackup(base64ToBytes(base64), passphrase);
  }

  static async importEncryptedBackup(bytes: Uint8Array, passphrase: string) {
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const envelope = parseEnvelope(strFromU8(bytes));
    const zipBytes = await decryptZip(envelope, backupPassphrase);
    const zip = unzipSync(zipBytes);
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
        rssFeeds: manifest.rssFeeds.length,
        settings: manifest.settings.length,
      },
    };
  }

  static async inspectEncryptedBackup(bytes: Uint8Array, passphrase: string) {
    const backupPassphrase = parseOrThrow(vaultPasswordSchema, passphrase);
    const envelope = parseEnvelope(strFromU8(bytes));
    const zip = unzipSync(await decryptZip(envelope, backupPassphrase));
    const manifestBytes = zip['manifest.json'];
    if (!manifestBytes) throw new Error('Backup manifest is missing.');
    return { manifest: parseManifest(strFromU8(manifestBytes)), entries: Object.keys(zip).sort() };
  }

  private static async createZipPayload() {
    const db = await DatabaseClient.getDb();
    const [settings, notes, documents, mapMarkers, routes, rssFeeds] = await Promise.all([
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
        mapMarkers: true,
        routes: true,
        readinessChecklist: true,
        rssSubscriptions: true,
        selectedSettings: true,
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
      mapMarkers: mapMarkers.map(mapMarkerBackup),
      routes: routes.map(mapRouteBackup),
      rssFeeds: rssFeeds.map(mapRssFeedBackup),
    };

    zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest));
    return {
      manifest,
      zipBytes: zipSync(zipEntries, { level: 6, mtime: new Date('1980-01-01T00:00:00Z') }),
    };
  }

  private static async restoreManifest(
    manifest: ArkBackupManifest,
    zip: Record<string, Uint8Array>
  ) {
    await FileSystemService.ensureAppDirectories();
    const restoredDocuments = await restoreDocumentFiles(manifest.documents, zip);
    const db = await DatabaseClient.getDb();

    await db.withTransactionAsync(async () => {
      for (const setting of manifest.settings) {
        await db.runAsync(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [setting.key, setting.value, setting.updatedAt]
        );
      }

      for (const note of manifest.notes) {
        await db.runAsync(
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
        await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', [note.id]);
        await db.runAsync(
          'INSERT INTO notes_fts (note_id, title, body, tags) VALUES (?, ?, ?, ?)',
          [note.id, note.title || 'Untitled note', note.body, note.tags.join(' ')]
        );
      }

      for (const document of restoredDocuments) {
        await db.runAsync('DELETE FROM document_pages_fts WHERE document_id = ?', [document.id]);
        await db.runAsync('DELETE FROM document_pages WHERE document_id = ?', [document.id]);
        await db.runAsync(
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
        await db.runAsync(
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
        await db.runAsync(
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
        await db.runAsync(
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
    });
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
  const fileName = FileSystemService.safeFileName(document.title || `${document.id}.document`);
  const path = `documents/${document.id}/${fileName}`;
  const base64 = await FileSystem.readAsStringAsync(document.local_uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  zipEntries[path] = base64ToBytes(base64);
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
    isFavorite: !!row.is_favorite,
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
    isEmergencyPin: !!row.is_emergency,
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
    enabled: !!row.enabled,
    lastFetchedAt: row.last_fetched_at,
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
    !parsed.payload
  ) {
    throw new Error('This is not a supported Ark backup file.');
  }
  return parsed;
}

function parseManifest(value: string): ArkBackupManifest {
  const parsed = JSON.parse(value) as ArkBackupManifest;
  if (parsed.format !== 'ark-backup' || parsed.version !== BACKUP_VERSION) {
    throw new Error('Backup manifest version is not supported.');
  }
  return parsed;
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
