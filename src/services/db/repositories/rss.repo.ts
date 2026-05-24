import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';

export type RssFeedRow = {
  id: string;
  title: string;
  url: string;
  enabled: number;
  last_fetched_at: number | null;
  created_at: number;
  updated_at: number;
};

export type RssItemRow = {
  id: string;
  feed_id: string;
  title: string;
  url: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  published_at: number | null;
  saved_offline: number;
  read_at: number | null;
  created_at: number;
  feed_title: string;
};

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

  static async seedFeeds(feeds: Array<{ title: string; url: string }>) {
    for (const feed of feeds) {
      await this.addFeed(feed.title, feed.url);
    }
  }

  static async listFeeds() {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<RssFeedRow>('SELECT * FROM rss_feeds ORDER BY title');
  }

  static async listEnabledFeeds() {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<RssFeedRow>('SELECT * FROM rss_feeds WHERE enabled = 1 ORDER BY title');
  }

  static async setFeedEnabled(id: string, enabled: boolean) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rss_feeds SET enabled = ?, updated_at = ? WHERE id = ?', [
      enabled ? 1 : 0,
      Date.now(),
      id,
    ]);
  }

  static async removeFeed(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM rss_items WHERE feed_id = ?', [id]);
    await db.runAsync('DELETE FROM rss_feeds WHERE id = ?', [id]);
  }

  static async updateFeedFetchedAt(id: string, timestamp: number) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rss_feeds SET last_fetched_at = ?, updated_at = ? WHERE id = ?', [
      timestamp,
      timestamp,
      id,
    ]);
  }

  static async upsertItems(
    items: Array<{
      id: string;
      feedId: string;
      title: string;
      url?: string | null;
      author?: string | null;
      summary?: string | null;
      content?: string | null;
      publishedAt?: number | null;
    }>
  ) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    for (const item of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO rss_items
          (id, feed_id, title, url, author, summary, content, published_at, saved_offline, read_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, COALESCE((SELECT read_at FROM rss_items WHERE id = ?), NULL), COALESCE((SELECT created_at FROM rss_items WHERE id = ?), ?))`,
        [
          item.id,
          item.feedId,
          item.title,
          item.url ?? null,
          item.author ?? null,
          item.summary ?? null,
          item.content ?? null,
          item.publishedAt ?? null,
          item.id,
          item.id,
          timestamp,
        ]
      );
    }
  }

  static async listRecentItems(limit = 20) {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<RssItemRow>(
      `SELECT rss_items.*, rss_feeds.title AS feed_title
       FROM rss_items
       JOIN rss_feeds ON rss_feeds.id = rss_items.feed_id
       ORDER BY COALESCE(rss_items.published_at, rss_items.created_at) DESC
       LIMIT ?`,
      [limit]
    );
  }

  static async countUnreadItems() {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM rss_items WHERE read_at IS NULL'
    );
    return row?.count ?? 0;
  }

  static async listUnreadCountsByFeed() {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<{ feed_id: string; count: number }>(
      `SELECT feed_id, COUNT(*) AS count
       FROM rss_items
       WHERE read_at IS NULL
       GROUP BY feed_id`
    );
  }

  static async getItem(id: string) {
    const db = await DatabaseClient.getDb();
    return db.getFirstAsync<RssItemRow>(
      `SELECT rss_items.*, rss_feeds.title AS feed_title
       FROM rss_items
       JOIN rss_feeds ON rss_feeds.id = rss_items.feed_id
       WHERE rss_items.id = ?`,
      [id]
    );
  }

  static async markItemRead(id: string, read: boolean) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rss_items SET read_at = ? WHERE id = ?', [
      read ? Date.now() : null,
      id,
    ]);
  }

  static async markAllRead() {
    const db = await DatabaseClient.getDb();
    await db.runAsync('UPDATE rss_items SET read_at = ? WHERE read_at IS NULL', [Date.now()]);
  }
}
