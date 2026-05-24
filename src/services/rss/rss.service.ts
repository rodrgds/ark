import * as Crypto from 'expo-crypto';
import { XMLParser } from 'fast-xml-parser';
import { RssRepository } from '@/services/db/repositories/rss.repo';

const DEFAULT_FEEDS = [
  {
    title: 'FEMA Disaster Declarations',
    url: 'https://www.fema.gov/feeds/disasters.rss',
  },
  {
    title: 'NHC Atlantic Tropical Cyclones',
    url: 'https://www.nhc.noaa.gov/index-at.xml',
  },
  {
    title: 'USGS Significant Earthquakes',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom',
  },
];

export class RssService {
  static parse(xml: string) {
    const parser = new XMLParser({ ignoreAttributes: false });
    return parser.parse(xml);
  }

  static async seedDefaultFeeds() {
    await RssRepository.seedFeeds(DEFAULT_FEEDS);
  }

  static async addFeed(title: string, url: string) {
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle) throw new Error('Feed name is required.');
    if (!/^https?:\/\//i.test(trimmedUrl)) throw new Error('Use a full http or https URL.');
    await RssRepository.addFeed(trimmedTitle, trimmedUrl);
  }

  static async getOverview(limit = 25) {
    await this.seedDefaultFeeds();
    const [feeds, items, unreadCount, unreadCountsByFeed] = await Promise.all([
      RssRepository.listFeeds(),
      RssRepository.listRecentItems(limit),
      RssRepository.countUnreadItems(),
      RssRepository.listUnreadCountsByFeed(),
    ]);
    const lastFetchedAt = feeds
      .map((feed) => feed.last_fetched_at ?? 0)
      .reduce((latest, value) => Math.max(latest, value), 0);
    return {
      feeds,
      recentItems: items,
      lastFetchedAt: lastFetchedAt || null,
      unreadCount,
      unreadByFeed: Object.fromEntries(
        unreadCountsByFeed.map((row) => [row.feed_id, row.count])
      ) as Record<string, number>,
    };
  }

  static async getItem(id: string) {
    return RssRepository.getItem(id);
  }

  static async refreshIfStale(maxAgeMs = 30 * 60 * 1000) {
    const overview = await this.getOverview();
    if (overview.lastFetchedAt && Date.now() - overview.lastFetchedAt < maxAgeMs) {
      return { imported: 0, errors: [], overview, skipped: true };
    }
    return { ...(await this.refreshAll()), skipped: false };
  }

  static async refreshAll() {
    await this.seedDefaultFeeds();
    const feeds = await RssRepository.listEnabledFeeds();
    let imported = 0;
    const errors: string[] = [];

    for (const feed of feeds) {
      try {
        const response = await fetch(feed.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = await response.text();
        const parsed = this.parse(xml);
        const items = await normalizeItems(feed.id, parsed);
        await RssRepository.upsertItems(items);
        await RssRepository.updateFeedFetchedAt(feed.id, Date.now());
        imported += items.length;
      } catch (error) {
        errors.push(`${feed.title}: ${error instanceof Error ? error.message : 'failed'}`);
      }
    }

    return {
      imported,
      errors,
      overview: await this.getOverview(),
    };
  }

  static getStatus() {
    return 'News feeds are saved for offline reading after each refresh.';
  }

  static async setFeedEnabled(id: string, enabled: boolean) {
    await RssRepository.setFeedEnabled(id, enabled);
  }

  static async removeFeed(id: string) {
    await RssRepository.removeFeed(id);
  }

  static async markItemRead(id: string, read: boolean) {
    await RssRepository.markItemRead(id, read);
  }

  static async markAllRead() {
    await RssRepository.markAllRead();
  }
}

async function normalizeItems(feedId: string, parsed: unknown) {
  const root = parsed as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
  };
  const rssItems = toArray(root.rss?.channel?.item).map((item) => normalizeRssItem(feedId, item));
  const atomItems = toArray(root.feed?.entry).map((item) => normalizeAtomItem(feedId, item));
  return Promise.all([...rssItems, ...atomItems]);
}

async function normalizeRssItem(feedId: string, rawItem: unknown) {
  const item = rawItem as Record<string, unknown>;
  const title = extractText(item.title) || 'Untitled';
  const url = extractText(item.link) || extractText(item.guid) || null;
  const publishedAt = parseDate(extractText(item.pubDate) || extractText(item['dc:date']));
  return {
    id: await itemId(feedId, title, url, publishedAt),
    feedId,
    title,
    url,
    author: extractText(item.author) || extractText(item['dc:creator']) || null,
    summary: stripHtml(extractText(item.description)) || null,
    content:
      stripHtml(extractText(item['content:encoded']) || extractText(item.description)) || null,
    publishedAt,
  };
}

async function normalizeAtomItem(feedId: string, rawItem: unknown) {
  const item = rawItem as Record<string, unknown>;
  const title = extractText(item.title) || 'Untitled';
  const url = atomLink(item.link);
  const publishedAt = parseDate(extractText(item.updated) || extractText(item.published));
  return {
    id: await itemId(feedId, title, url, publishedAt),
    feedId,
    title,
    url,
    author: extractText(item.author) || null,
    summary: stripHtml(extractText(item.summary)) || null,
    content: stripHtml(extractText(item.content) || extractText(item.summary)) || null,
    publishedAt,
  };
}

function toArray(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return extractText(record['#text'] ?? record['@_href'] ?? record.href ?? record.name ?? '');
  }
  return '';
}

function atomLink(value: unknown) {
  const links = toArray(value) as Array<Record<string, unknown>>;
  const alternate = links.find((link) => link['@_rel'] === 'alternate') ?? links[0];
  return extractText(alternate?.['@_href'] ?? alternate?.href ?? alternate) || null;
}

function parseDate(value: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function itemId(
  feedId: string,
  title: string,
  url: string | null,
  publishedAt: number | null
) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${feedId}:${url ?? title}:${publishedAt ?? ''}`
  );
}
