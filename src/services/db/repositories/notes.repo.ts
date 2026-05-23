import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { HapticsService } from '@/services/device/haptics.service';
import { noteInputSchema, notePatchSchema, parseOrThrow } from '@/lib/validation';
import type { Note } from '@/types/db';

function mapNote(row: {
  id: string;
  title: string;
  body: string;
  tags_json: string | null;
  is_favorite: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    isFavorite: !!row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toFtsQuery(query: string) {
  return query
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9_'-]/g, '').trim())
    .filter(Boolean)
    .map((part) => `${part}*`)
    .join(' ');
}

export class NotesRepository {
  static async list(query?: string) {
    const db = await DatabaseClient.getDb();
    const fts = query ? toFtsQuery(query) : '';
    if (fts) {
      const rows = await db.getAllAsync<Parameters<typeof mapNote>[0]>(
        `SELECT n.* FROM notes n
         JOIN notes_fts f ON f.note_id = n.id
         WHERE notes_fts MATCH ? AND n.deleted_at IS NULL
         ORDER BY n.is_favorite DESC, n.updated_at DESC`,
        [fts]
      );
      return rows.map(mapNote);
    }
    const rows = await db.getAllAsync<Parameters<typeof mapNote>[0]>(
      'SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY is_favorite DESC, updated_at DESC'
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

  static async create(input: { title: string; body: string; tags?: string[] }) {
    const validated = parseOrThrow(noteInputSchema, input);
    const db = await DatabaseClient.getDb();
    const now = Date.now();
    const note: Note = {
      id: randomUUID(),
      title: validated.title || 'Untitled note',
      body: validated.body,
      tags: validated.tags,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO notes (id, title, body, tags_json, is_favorite, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, NULL)`,
        [note.id, note.title, note.body, JSON.stringify(note.tags), now, now]
      );
      await this.syncFts(note);
    });
    void HapticsService.success();
    return note;
  }

  static async update(
    id: string,
    patch: Partial<Pick<Note, 'title' | 'body' | 'tags' | 'isFavorite'>>
  ) {
    const validatedPatch = parseOrThrow(notePatchSchema, patch);
    const current = await this.get(id);
    if (!current) return null;
    const next: Note = {
      ...current,
      ...validatedPatch,
      title: validatedPatch.title || current.title,
      updatedAt: Date.now(),
    };
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE notes SET title = ?, body = ?, tags_json = ?, is_favorite = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.title,
          next.body,
          JSON.stringify(next.tags),
          next.isFavorite ? 1 : 0,
          next.updatedAt,
          id,
        ]
      );
      await this.syncFts(next);
    });
    void HapticsService.selection();
    return next;
  }

  static async softDelete(id: string) {
    const db = await DatabaseClient.getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?', [
        Date.now(),
        Date.now(),
        id,
      ]);
      await db.runAsync('DELETE FROM notes_fts WHERE note_id = ?', [id]);
    });
  }

  static async syncFts(note: Note) {
    const db = await DatabaseClient.getDb();
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
}
