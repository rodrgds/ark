import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';

export class RssRepository {
  static async addFeed(title: string, url: string) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO rss_feeds (id, title, url, enabled, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [randomUUID(), title, url, timestamp, timestamp]
    );
  }

  static async listFeeds() {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<{ id: string; title: string; url: string; enabled: number }>(
      'SELECT id, title, url, enabled FROM rss_feeds ORDER BY title'
    );
  }
}
