import * as Crypto from 'expo-crypto';
import { XMLParser } from 'fast-xml-parser';
import { withDefuddleDomGlobals } from '@/services/content/defuddle-runtime';
import { RssRepository } from '@/services/db/repositories/rss.repo';
import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { isJsonObject, isJsonNumber, isJsonString, type Json } from '@/lib/decode';

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
      unreadByFeed: unreadCountsByFeed.reduce<{ [feedId: string]: number }>((byFeed, row) => {
        byFeed[row.feed_id] = row.count;
        return byFeed;
      }, {}),
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

async function normalizeItems(feedId: string, parsed: Json) {
  const root = isJsonObject(parsed) ? parsed : {};
  const channel = member(root.rss, 'channel');
  const rssItems = toArray(member(channel, 'item')).map((item) => normalizeRssItem(feedId, item));
  const atomItems = toArray(member(root.feed, 'entry')).map((item) =>
    normalizeAtomItem(feedId, item)
  );
  return Promise.all([...rssItems, ...atomItems]);
}

function member(container: Json, key: string): Json {
  if (!isJsonObject(container)) return null;
  return container[key] ?? null;
}

async function normalizeRssItem(feedId: string, rawItem: Json) {
  const item = isJsonObject(rawItem) ? rawItem : {};
  const title = extractText(item.title) || 'Untitled';
  const url = extractText(item.link) || extractText(item.guid) || null;
  const publishedAt = parseDate(extractText(item.pubDate) || extractText(item['dc:date']));

  const rawContent = extractText(item['content:encoded']) || extractText(item.description) || '';
  const { summary, content } = await defuddleContent(rawContent, url);

  return {
    id: await itemId(feedId, title, url, publishedAt),
    feedId,
    title,
    url,
    author: extractText(item.author) || extractText(item['dc:creator']) || null,
    summary,
    content,
    publishedAt,
  };
}

async function normalizeAtomItem(feedId: string, rawItem: Json) {
  const item = isJsonObject(rawItem) ? rawItem : {};
  const title = extractText(item.title) || 'Untitled';
  const url = atomLink(item.link);
  const publishedAt = parseDate(extractText(item.updated) || extractText(item.published));

  const rawContent = extractText(item.content) || extractText(item.summary) || '';
  const { summary, content } = await defuddleContent(rawContent, url);

  return {
    id: await itemId(feedId, title, url, publishedAt),
    feedId,
    title,
    url,
    author: extractText(item.author) || null,
    summary,
    content,
    publishedAt,
  };
}

async function defuddleContent(html: string, url: string | null) {
  const stripped = stripHtml(html);
  if (!stripped) return { summary: null, content: null };

  const dom = parseHTML(html);
  const { document } = dom;

  try {
    const result = await withDefuddleDomGlobals(dom, () =>
      Defuddle(document, url || '', {
        markdown: false,
        standardize: true,
      })
    );
    const content = stripHtml(result.content || html);

    return {
      summary: result.description || stripped.slice(0, 200),
      content: content || stripped,
    };
  } catch {
    return {
      summary: stripped.slice(0, 200),
      content: stripped,
    };
  }
}

function toArray(value: Json): Json[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractText(value: Json): string {
  if (!value) return '';
  if (isJsonString(value) || isJsonNumber(value)) return String(value).trim();
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(' ');
  if (isJsonObject(value)) {
    return extractText(value['#text'] ?? value['@_href'] ?? value.href ?? value.name ?? '');
  }
  return '';
}

function atomLink(value: Json) {
  const links = toArray(value);
  const alternate = links.find((link) => isJsonObject(link) && link['@_rel'] === 'alternate');
  const fallback = links[0] ?? '';
  const chosen = alternate ?? fallback;
  if (!chosen) return null;
  return extractText(chosen) || null;
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
  const value = `${feedId}:${url ?? title}:${publishedAt ?? ''}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
