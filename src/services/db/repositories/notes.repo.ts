import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseClient } from '@/services/db/client';
import { sqliteBoolean } from '@/services/db/sqlite-values';
import { RagCleanupService } from '@/services/ai/rag-cleanup.service';
import { toFtsPrefixQuery } from '@/services/db/fts';
import { HapticsService } from '@/services/device/haptics.service';
import { noteInputSchema, notePatchSchema, parseOrThrow } from '@/lib/validation';
import { DEFAULT_NOTE_CONTENT_FORMAT, normalizeNoteContentFormat } from '@/constants/note-content';
import { DEFAULT_NOTE_SORT_MODE, type NoteSortMode } from '@/constants/note-sort';
import { normalizeNoteThemeId } from '@/constants/note-themes';
import { getNotePlainText } from '@/lib/note-text';
import type { Note } from '@/types/db';

type NotePatch = Partial<
  Pick<
    Note,
    | 'title'
    | 'body'
    | 'contentHtml'
    | 'contentJson'
    | 'contentFormat'
    | 'tags'
    | 'themeId'
    | 'isFavorite'
  >
>;

function mapNote(row: {
  id: string;
  title: string;
  body: string;
  content_html: string | null;
  content_json: string | null;
  content_format: string | null;
  tags_json: string | null;
  theme_id: string | null;
  sort_order: number | null;
  is_favorite: number | string | boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    contentHtml: row.content_html,
    contentJson: row.content_json,
    contentFormat: normalizeNoteContentFormat(row.content_format),
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    themeId: normalizeNoteThemeId(row.theme_id),
    sortOrder: row.sort_order ?? row.updated_at,
    isFavorite: sqliteBoolean(row.is_favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function uniqueNoteIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function normalizeLabels(labels: string[]) {
  return Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function patchAffectsFts(patch: NotePatch) {
  return 'title' in patch || 'body' in patch || 'tags' in patch;
}

function normalizeRichBody(input: {
  body: string;
  contentHtml?: string | null;
  contentJson?: string | null;
}) {
  return getNotePlainText(input);
}

function normalizeNotePatchBody(current: Note, patch: NotePatch): NotePatch {
  const hasBodyField = 'body' in patch;
  const hasRichField = 'contentHtml' in patch || 'contentJson' in patch;
  if (!hasBodyField && !hasRichField) return patch;

  if (hasBodyField && !hasRichField) {
    return {
      ...patch,
      body: typeof patch.body === 'string' ? patch.body : current.body,
    };
  }

  if (!hasBodyField && hasRichField) {
    return {
      ...patch,
      body: normalizeRichBody({
        body: current.body,
        contentHtml: patch.contentHtml === undefined ? current.contentHtml : patch.contentHtml,
        contentJson: patch.contentJson === undefined ? current.contentJson : patch.contentJson,
      }),
    };
  }

  return {
    ...patch,
    body: typeof patch.body === 'string' ? patch.body : current.body,
  };
}

function getOrderBy(sortMode: NoteSortMode) {
  switch (sortMode) {
    case 'manual':
      return 'n.sort_order ASC, n.updated_at DESC';
    case 'updated_asc':
      return 'n.is_favorite DESC, n.updated_at ASC';
    case 'title':
      return 'n.is_favorite DESC, LOWER(n.title) ASC, n.updated_at DESC';
    case 'updated_desc':
    default:
      return 'n.is_favorite DESC, n.updated_at DESC';
  }
}

const changeListeners = new Set<() => void>();

export class NotesRepository {
  /**
   * Subscribe to changes in the notes repository.
   * Useful for keeping UI lists in sync.
   */
  static subscribe(callback: () => void) {
    changeListeners.add(callback);
    return () => changeListeners.delete(callback);
  }

  private static notify() {
    for (const listener of changeListeners) {
      try {
        listener();
      } catch {
        // Ignore errors in listeners
      }
    }
  }

  static async list(query?: string, sortMode: NoteSortMode = DEFAULT_NOTE_SORT_MODE) {
    const db = await DatabaseClient.getDb();
    const fts = query ? toFtsPrefixQuery(query) : '';
    const orderBy = getOrderBy(sortMode);
    if (fts) {
      const rows = await db.getAllAsync<Parameters<typeof mapNote>[0]>(
        `SELECT n.* FROM notes n
         JOIN notes_fts f ON f.note_id = n.id
         WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
         ORDER BY ${orderBy}`,
        [fts]
      );
      return rows.map(mapNote);
    }
    const rows = await db.getAllAsync<Parameters<typeof mapNote>[0]>(
      `SELECT * FROM notes n WHERE n.deleted_at IS NULL ORDER BY ${orderBy}`
    );
    return rows.map(mapNote);
  }

  static async get(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<Parameters<typeof mapNote>[0]>(
      'SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? mapNote(row) : null;
  }

  static async getMany(ids: string[]) {
    const noteIds = uniqueNoteIds(ids);
    if (!noteIds.length) return [];

    const db = await DatabaseClient.getDb();
    const placeholders = noteIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<Parameters<typeof mapNote>[0]>(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND id IN (${placeholders})`,
      noteIds
    );
    const order = new Map(noteIds.map((id, index) => [id, index]));
    return rows.map(mapNote).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  static async create(input: {
    title: string;
    body: string;
    contentHtml?: string | null;
    contentJson?: string | null;
    contentFormat?: string;
    tags?: string[];
    themeId?: string;
  }) {
    const validated = parseOrThrow(noteInputSchema, input);
    const db = await DatabaseClient.getDb();
    const now = Date.now();
    const body = normalizeRichBody({
      body: validated.body,
      contentHtml: validated.contentHtml,
      contentJson: validated.contentJson,
    });
    const note: Note = {
      id: randomUUID(),
      title: validated.title || 'Untitled note',
      body,
      contentHtml: validated.contentHtml,
      contentJson: validated.contentJson,
      contentFormat: validated.contentFormat,
      tags: validated.tags,
      themeId: validated.themeId,
      sortOrder: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.withTransactionAsync(async (tx) => {
      note.sortOrder = await this.getNextSortOrder(tx);
      await tx.runAsync(
        `INSERT INTO notes
          (id, title, body, content_html, content_json, content_format, tags_json, theme_id, sort_order, is_favorite, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
        [
          note.id,
          note.title,
          note.body,
          note.contentHtml,
          note.contentJson,
          note.contentFormat,
          JSON.stringify(note.tags),
          note.themeId,
          note.sortOrder,
          now,
          now,
        ]
      );
      await this.syncFtsInDb(tx, note);
    });
    void HapticsService.success();
    this.notify();
    return note;
  }

  static async update(id: string, patch: NotePatch) {
    const validatedPatch = parseOrThrow(notePatchSchema, patch);
    const current = await this.get(id);
    if (!current) return null;
    const normalizedPatch = normalizeNotePatchBody(current, validatedPatch);
    const next: Note = {
      ...current,
      ...normalizedPatch,
      title: normalizedPatch.title || current.title,
      contentFormat:
        normalizedPatch.contentFormat ??
        (normalizedPatch.contentHtml || normalizedPatch.contentJson
          ? current.contentFormat === DEFAULT_NOTE_CONTENT_FORMAT
            ? 'tiptap-json-v1'
            : current.contentFormat
          : current.contentFormat),
      updatedAt: Date.now(),
    };
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE notes SET title = ?, body = ?, content_html = ?, content_json = ?, content_format = ?, tags_json = ?, theme_id = ?, is_favorite = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.title,
          next.body,
          next.contentHtml,
          next.contentJson,
          next.contentFormat,
          JSON.stringify(next.tags),
          next.themeId,
          next.isFavorite ? 1 : 0,
          next.updatedAt,
          id,
        ]
      );
      if (patchAffectsFts(normalizedPatch)) {
        await this.syncFtsInDb(tx, next);
      }
    });
    void HapticsService.selection();
    this.notify();
    return next;
  }

  static async updateMany(ids: string[], patch: NotePatch) {
    const validatedPatch = parseOrThrow(notePatchSchema, patch);
    const currentNotes = await this.getMany(ids);
    if (!currentNotes.length) return [];

    const now = Date.now();
    const normalizedPatches = new Map(
      currentNotes.map((note) => [note.id, normalizeNotePatchBody(note, validatedPatch)])
    );
    const nextNotes = currentNotes.map((note) => {
      const normalizedPatch = normalizedPatches.get(note.id) ?? validatedPatch;
      return {
        ...note,
        ...normalizedPatch,
        title: normalizedPatch.title || note.title,
        contentFormat:
          normalizedPatch.contentFormat ??
          (normalizedPatch.contentHtml || normalizedPatch.contentJson
            ? note.contentFormat === DEFAULT_NOTE_CONTENT_FORMAT
              ? 'tiptap-json-v1'
              : note.contentFormat
            : note.contentFormat),
        updatedAt: now,
      };
    });
    const shouldSyncFts = Array.from(normalizedPatches.values()).some(patchAffectsFts);
    const db = await DatabaseClient.getDb();

    await db.withTransactionAsync(async (tx) => {
      for (const note of nextNotes) {
        await tx.runAsync(
          `UPDATE notes SET title = ?, body = ?, content_html = ?, content_json = ?, content_format = ?, tags_json = ?, theme_id = ?, is_favorite = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [
            note.title,
            note.body,
            note.contentHtml,
            note.contentJson,
            note.contentFormat,
            JSON.stringify(note.tags),
            note.themeId,
            note.isFavorite ? 1 : 0,
            note.updatedAt,
            note.id,
          ]
        );
        if (shouldSyncFts) {
          await this.syncFtsInDb(tx, note);
        }
      }
    });

    void HapticsService.selection();
    this.notify();
    return nextNotes;
  }

  static async applyLabels(ids: string[], labels: string[]) {
    const noteIds = uniqueNoteIds(ids);
    const labelsToApply = normalizeLabels(labels);
    if (!noteIds.length || !labelsToApply.length) return [];

    const currentNotes = await this.getMany(noteIds);
    if (!currentNotes.length) return [];

    const now = Date.now();
    const nextNotes = currentNotes.map((note) => ({
      ...note,
      tags: normalizeLabels([...note.tags, ...labelsToApply]),
      updatedAt: now,
    }));
    const db = await DatabaseClient.getDb();

    await db.withTransactionAsync(async (tx) => {
      for (const note of nextNotes) {
        await tx.runAsync('UPDATE notes SET tags_json = ?, updated_at = ? WHERE id = ?', [
          JSON.stringify(note.tags),
          note.updatedAt,
          note.id,
        ]);
        await this.syncFtsInDb(tx, note);
      }
    });

    void HapticsService.selection();
    this.notify();
    return nextNotes;
  }

  static async removeLabels(ids: string[], labels: string[]) {
    const noteIds = uniqueNoteIds(ids);
    const labelsToRemove = new Set(normalizeLabels(labels));
    if (!noteIds.length || !labelsToRemove.size) return [];

    const currentNotes = await this.getMany(noteIds);
    if (!currentNotes.length) return [];

    const now = Date.now();
    const nextNotes = currentNotes
      .map((note) => {
        const filtered = note.tags.filter((tag) => !labelsToRemove.has(tag));
        if (filtered.length === note.tags.length) return null;
        return { ...note, tags: normalizeLabels(filtered), updatedAt: now };
      })
      .filter((note): note is NonNullable<typeof note> => note !== null);

    if (!nextNotes.length) return [];

    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async (tx) => {
      for (const note of nextNotes) {
        await tx.runAsync('UPDATE notes SET tags_json = ?, updated_at = ? WHERE id = ?', [
          JSON.stringify(note.tags),
          note.updatedAt,
          note.id,
        ]);
        await this.syncFtsInDb(tx, note);
      }
    });

    void HapticsService.selection();
    this.notify();
    return nextNotes;
  }

  static async softDelete(id: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async (tx) => {
      await tx.runAsync('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?', [
        Date.now(),
        Date.now(),
        id,
      ]);
      await tx.runAsync('DELETE FROM notes_fts WHERE note_id = ?', [id]);
    });
    await RagCleanupService.removeSource(`note:${id}`);
    this.notify();
  }

  static async softDeleteMany(ids: string[]) {
    const noteIds = uniqueNoteIds(ids);
    if (!noteIds.length) return;

    const db = await DatabaseClient.getDb();
    const now = Date.now();
    const placeholders = noteIds.map(() => '?').join(', ');
    await db.withTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE notes SET deleted_at = ?, updated_at = ?
         WHERE deleted_at IS NULL AND id IN (${placeholders})`,
        [now, now, ...noteIds]
      );
      await tx.runAsync(`DELETE FROM notes_fts WHERE note_id IN (${placeholders})`, noteIds);
    });

    for (const id of noteIds) {
      await RagCleanupService.removeSource(`note:${id}`);
    }
    this.notify();
  }

  static async reorder(noteIds: string[]) {
    const orderedIds = uniqueNoteIds(noteIds);
    if (!orderedIds.length) return [];

    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async (tx) => {
      for (const [index, id] of orderedIds.entries()) {
        await tx.runAsync('UPDATE notes SET sort_order = ? WHERE id = ? AND deleted_at IS NULL', [
          (index + 1) * 1000,
          id,
        ]);
      }
    });

    void HapticsService.selection();
    this.notify();
    return this.getMany(orderedIds);
  }

  static async syncFts(note: Note) {
    const db = await DatabaseClient.getDb();
    await this.syncFtsInDb(db, note);
  }

  private static async syncFtsInDb(db: SQLiteDatabase, note: Note) {
    await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', [note.id]);
    if (!note.deletedAt) {
      await db.runAsync('INSERT INTO notes_fts (note_id, title, body, tags) VALUES (?, ?, ?, ?)', [
        note.id,
        note.title,
        note.body,
        note.tags.join(' '),
      ]);
    }
  }

  private static async getNextSortOrder(db: SQLiteDatabase) {
    const row = await db.getFirstAsync<{ min_sort_order: number | null }>(
      'SELECT MIN(sort_order) AS min_sort_order FROM notes WHERE deleted_at IS NULL'
    );
    return (row?.min_sort_order ?? 1000) - 1000;
  }
}
