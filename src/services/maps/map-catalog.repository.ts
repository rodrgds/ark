import type { MapCatalog, MapPreset } from '@/constants/map-presets';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

type RawMapPreset = Partial<Omit<MapPreset, 'bounds' | 'bbox' | 'center' | 'tags'>> & {
  bounds?: Partial<MapPreset['bounds']>;
  bbox?: unknown;
  center?: unknown;
  tags?: unknown;
};

type RawMapCatalog = Partial<Omit<MapCatalog, 'regions'>> & {
  baseUrl?: unknown;
  regions?: RawMapPreset[];
};

type CatalogNormalizeContext = {
  sourceUrl?: string;
  fetchedAt?: string;
  verifiedSha256?: string;
};

const bundledCatalog = require('../../../assets/map-catalog.json') as RawMapCatalog;
const CATALOG_TIMEOUT_MS = 5000;
const CACHED_CATALOG_KEY = 'maps.catalog.cached';
const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina',
  AU: 'Australia',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  IE: 'Ireland',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  MA: 'Morocco',
  MX: 'Mexico',
  NZ: 'New Zealand',
  PT: 'Portugal',
  TR: 'Turkey',
  US: 'United States',
};

export class MapCatalogRepository {
  static getBundledCatalog() {
    return normalizeCatalog(bundledCatalog);
  }

  static async fetchCatalog() {
    const cachedCatalog = await this.getCachedCatalog();
    const url = process.env.EXPO_PUBLIC_ARK_MAP_CATALOG_URL;
    if (!url) return cachedCatalog ?? this.getBundledCatalog();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return cachedCatalog ?? this.getBundledCatalog();
      const body = await response.text();
      const verifiedSha256 = await verifyCatalogIntegrity(body);
      if (verifiedSha256 === false) return cachedCatalog ?? this.getBundledCatalog();
      const catalog = normalizeCatalog(JSON.parse(body) as RawMapCatalog, {
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        verifiedSha256,
      });
      if (!isUsableCatalog(catalog) || isExpiredCatalog(catalog)) {
        return cachedCatalog ?? this.getBundledCatalog();
      }
      if (cachedCatalog && cachedCatalog.version > catalog.version) return cachedCatalog;
      await cacheCatalog(catalog);
      return catalog;
    } catch {
      return cachedCatalog ?? this.getBundledCatalog();
    } finally {
      clearTimeout(timeout);
    }
  }

  static async getCachedCatalog() {
    try {
      const value = await SettingsRepository.get(CACHED_CATALOG_KEY);
      if (!value) return null;
      const catalog = normalizeCatalog(JSON.parse(value) as RawMapCatalog);
      return isUsableCatalog(catalog) ? catalog : null;
    } catch {
      return null;
    }
  }
}

function normalizeCatalog(
  catalog: RawMapCatalog | null | undefined,
  context: CatalogNormalizeContext = {}
): MapCatalog {
  const source = catalog && typeof catalog === 'object' ? catalog : {};
  const sourceUrl = typeof source.sourceUrl === 'string' ? source.sourceUrl : context.sourceUrl;
  const baseUrl = getCatalogBaseUrl(source, sourceUrl);
  const regions = Array.isArray(source.regions)
    ? source.regions.filter(isValidPreset).map((preset) => normalizePreset(preset, source, baseUrl))
    : [];
  return {
    version: Number.isFinite(source.version) ? source.version! : 1,
    schemaVersion: normalizePositiveInteger(source.schemaVersion),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    generatedAt: normalizeDateString(source.generatedAt),
    expiresAt: normalizeDateString(source.expiresAt),
    source: typeof source.source === 'string' ? source.source : 'unknown',
    sourceUrl,
    fetchedAt: normalizeDateString(source.fetchedAt) ?? context.fetchedAt,
    verifiedSha256: normalizeSha256(source.verifiedSha256) ?? context.verifiedSha256,
    regions: dedupeById(regions),
  };
}

function isValidPreset(preset: RawMapPreset) {
  return (
    typeof preset?.id === 'string' &&
    typeof preset.name === 'string' &&
    getPresetBbox(preset) !== null &&
    Number.isFinite(preset.minZoom) &&
    Number.isFinite(preset.maxZoom) &&
    preset.maxZoom! >= preset.minZoom!
  );
}

function normalizePreset(
  preset: RawMapPreset,
  catalog: RawMapCatalog,
  baseUrl?: string
): MapPreset {
  const bbox = getPresetBbox(preset) ?? [0, 0, 0, 0];
  const bounds = bboxToBounds(bbox);
  const center = getPresetCenter(preset.center, bbox);
  const explicitTags = normalizeTags(preset.tags);
  const countryCode =
    normalizeCountryCode(preset.countryCode) ?? inferCountryCode(preset.id!, explicitTags);
  const tags = normalizeTags(explicitTags, countryCode);
  const estimatedSizeMb =
    normalizePositiveNumber(preset.estimatedSizeMb) ?? parseEstimatedSizeMb(preset.estimatedSize);
  const level =
    normalizeLevel(preset.level) ?? inferLevel({ bounds, minZoom: preset.minZoom!, tags });
  const packUrl = normalizeUrl(preset.packUrl, baseUrl);
  const routingPackUrl = normalizeUrl(preset.routingPackUrl, baseUrl);

  return {
    ...preset,
    id: preset.id!,
    name: preset.name!,
    description: normalizeDescription(preset.description, preset.name!),
    bounds,
    bbox,
    center,
    countryCode,
    level,
    minZoom: preset.minZoom!,
    maxZoom: preset.maxZoom!,
    estimatedSizeMb,
    estimatedSize: normalizeEstimatedSize(preset.estimatedSize, estimatedSizeMb),
    packUrl,
    routingPackUrl,
    routingDataVersion: preset.routingDataVersion ?? preset.dataVersion ?? preset.updatedAt,
    routingChecksumSha256: normalizeSha256(preset.routingChecksumSha256),
    routingSizeMb: normalizePositiveNumber(preset.routingSizeMb),
    checksumSha256: normalizeSha256(preset.checksumSha256),
    checksumSha256Url: normalizeUrl(preset.checksumSha256Url, baseUrl),
    packFormat: normalizePackFormat(preset.packFormat, packUrl),
    dataVersion: preset.dataVersion ?? preset.updatedAt ?? catalog.updatedAt,
    tags,
  };
}

async function cacheCatalog(catalog: MapCatalog) {
  try {
    await SettingsRepository.set(CACHED_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    // Cache writes are best-effort; the bundled catalog remains the hard offline fallback.
  }
}

function isUsableCatalog(catalog: MapCatalog) {
  return catalog.regions.length > 0;
}

function isExpiredCatalog(catalog: MapCatalog) {
  if (!catalog.expiresAt) return false;
  const expiresAt = Date.parse(catalog.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function isFiniteBounds(bounds: RawMapPreset['bounds']) {
  if (!bounds) return false;
  const { north, south, east, west } = bounds;
  return (
    Number.isFinite(north) &&
    Number.isFinite(south) &&
    Number.isFinite(east) &&
    Number.isFinite(west) &&
    north! > south! &&
    east! > west!
  );
}

function isFiniteBbox(bbox: unknown): bbox is MapPreset['bbox'] {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  const [west, south, east, north] = bbox;
  return (
    Number.isFinite(west) &&
    Number.isFinite(south) &&
    Number.isFinite(east) &&
    Number.isFinite(north) &&
    north > south &&
    east > west
  );
}

function getPresetBbox(preset: RawMapPreset) {
  if (isFiniteBbox(preset.bbox)) return preset.bbox;
  if (!isFiniteBounds(preset.bounds)) return null;
  return [
    preset.bounds!.west!,
    preset.bounds!.south!,
    preset.bounds!.east!,
    preset.bounds!.north!,
  ] satisfies MapPreset['bbox'];
}

function bboxToBounds(bbox: MapPreset['bbox']): MapPreset['bounds'] {
  const [west, south, east, north] = bbox;
  return { north, south, east, west };
}

function getPresetCenter(center: unknown, bbox: MapPreset['bbox']): MapPreset['center'] {
  if (
    Array.isArray(center) &&
    center.length === 2 &&
    Number.isFinite(center[0]) &&
    Number.isFinite(center[1])
  ) {
    return [center[0], center[1]];
  }
  const [west, south, east, north] = bbox;
  return [(west + east) / 2, (south + north) / 2];
}

function dedupeById(regions: MapPreset[]) {
  const seen = new Set<string>();
  return regions.filter((region) => {
    if (seen.has(region.id)) return false;
    seen.add(region.id);
    return true;
  });
}

function inferCountryCode(id: string, tags: string[]) {
  const idPrefix = id.split('-')[0]?.toUpperCase();
  if (idPrefix && idPrefix.length === 2) return idPrefix;
  if (tags.includes('Portugal')) return 'PT';
  if (tags.includes('Spain')) return 'ES';
  if (tags.includes('France')) return 'FR';
  if (tags.includes('United States')) return 'US';
  return undefined;
}

function inferLevel(preset: {
  bounds: MapPreset['bounds'];
  minZoom: number;
  tags: string[];
}): MapPreset['level'] {
  const span =
    (preset.bounds.north - preset.bounds.south) * (preset.bounds.east - preset.bounds.west);
  if (preset.tags.includes('overview') || preset.minZoom <= 4 || span > 120) return 'country';
  if (span < 2 || preset.tags.includes('urban')) return 'city';
  return 'region';
}

function parseEstimatedSizeMb(estimatedSize: unknown) {
  if (typeof estimatedSize !== 'string') return undefined;
  const numbers = estimatedSize
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite);
  if (!numbers?.length) return undefined;
  return Math.max(...numbers);
}

function normalizePositiveNumber(value: unknown) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function normalizeEstimatedSize(estimatedSize: unknown, estimatedSizeMb?: number) {
  if (typeof estimatedSize === 'string' && estimatedSize.trim()) return estimatedSize.trim();
  return estimatedSizeMb ? `${Math.round(estimatedSizeMb)} MB` : 'Size unavailable';
}

function normalizeDescription(description: unknown, name: string) {
  if (typeof description === 'string' && description.trim()) return description.trim();
  return `Offline map region for ${name}.`;
}

function normalizeTags(tags: unknown, countryCode?: string) {
  const normalized = Array.isArray(tags)
    ? tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
  const countryName = countryCode ? COUNTRY_NAMES[countryCode] : undefined;
  if (countryName && !normalized.includes(countryName)) normalized.push(countryName);
  return Array.from(new Set(normalized));
}

function normalizeCountryCode(countryCode: unknown) {
  if (typeof countryCode !== 'string') return undefined;
  const normalized = countryCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizeDateString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSha256(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : undefined;
}

function getCatalogBaseUrl(source: RawMapCatalog, sourceUrl?: string) {
  const rawBaseUrl = typeof source.baseUrl === 'string' ? source.baseUrl.trim() : '';
  if (!rawBaseUrl) return sourceUrl;
  return normalizeUrl(rawBaseUrl, sourceUrl) ?? sourceUrl;
}

function normalizeUrl(value: unknown, baseUrl?: string) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), baseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function verifyCatalogIntegrity(body: string) {
  const expectedSha256 = normalizeSha256(process.env.EXPO_PUBLIC_ARK_MAP_CATALOG_SHA256);
  if (!expectedSha256) return undefined;
  const actualSha256 = await sha256Text(body);
  return actualSha256 === expectedSha256 ? actualSha256 : false;
}

async function sha256Text(value: string) {
  const Crypto = await import('expo-crypto');
  const algorithm = Crypto.CryptoDigestAlgorithm.SHA256 ?? 'SHA-256';
  if (typeof Crypto.digestStringAsync === 'function') {
    return Crypto.digestStringAsync(algorithm, value);
  }
  const digest = await Crypto.digest(algorithm, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

function normalizeLevel(level: unknown): MapPreset['level'] | undefined {
  return level === 'world' || level === 'country' || level === 'region' || level === 'city'
    ? level
    : undefined;
}

function normalizePackFormat(
  format: MapPreset['packFormat'],
  packUrl?: string
): MapPreset['packFormat'] {
  if (
    format === 'pmtiles' ||
    format === 'mbtiles' ||
    format === 'vector_tiles' ||
    format === 'maplibre_offline_pack'
  ) {
    return format;
  }
  const lowerPackUrl = typeof packUrl === 'string' ? packUrl.split('?')[0]?.toLowerCase() : '';
  if (lowerPackUrl?.endsWith('.pmtiles')) return 'pmtiles';
  if (lowerPackUrl?.endsWith('.mbtiles')) return 'mbtiles';
  return 'maplibre_offline_pack';
}
