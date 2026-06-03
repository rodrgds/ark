#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (!args.source || !args.out) {
  console.error(
    [
      'Usage: node scripts/build-map-catalog.mjs --source regions.json --out public/map-catalog.json',
      '',
      'Optional:',
      '  --base-url https://cdn.example.test/maps/',
      '  --source-name ark-pmtiles-openstreetmap',
      '  --version 20260601',
    ].join('\n')
  );
  process.exit(1);
}

const sourcePath = resolve(args.source);
const outPath = resolve(args.out);
const raw = JSON.parse(await readFile(sourcePath, 'utf8'));
const sourceRegions = Array.isArray(raw) ? raw : raw.regions;
if (!Array.isArray(sourceRegions) || sourceRegions.length === 0) {
  throw new Error('Catalog source must be a non-empty array or an object with a regions array.');
}

const now = new Date();
const catalog = {
  schemaVersion: 1,
  version: Number(args.version) || Number(formatDate(now).replaceAll('-', '')),
  generatedAt: now.toISOString(),
  updatedAt: formatDate(now),
  source: args.sourceName || raw.source || 'ark-generated-map-catalog',
  ...(args.baseUrl ? { baseUrl: args.baseUrl } : {}),
  regions: sourceRegions.map(normalizeRegion),
};

const body = `${JSON.stringify(catalog, null, 2)}\n`;
const sha256 = createHash('sha256').update(body).digest('hex');

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, body, 'utf8');
await writeFile(`${outPath}.sha256`, `${sha256}  ${outPath.split('/').at(-1)}\n`, 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`SHA-256 ${sha256}`);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key?.startsWith('--')) continue;
    const value = values[index + 1];
    if (!value || value.startsWith('--')) {
      parsed[key.slice(2)] = true;
      continue;
    }
    parsed[key.slice(2)] = value;
    index += 1;
  }
  return {
    source: parsed.source,
    out: parsed.out,
    baseUrl: parsed['base-url'],
    sourceName: parsed['source-name'],
    version: parsed.version,
  };
}

function normalizeRegion(region) {
  if (!region || typeof region !== 'object') throw new Error('Region entries must be objects.');
  const bbox = normalizeBbox(region);
  const minZoom = Number(region.minZoom ?? region.minSuggestZoom ?? region.minDownloadZoom);
  const maxZoom = Number(region.maxZoom ?? region.maxSuggestZoom ?? region.maxDownloadZoom);

  if (!region.id || !region.name || !bbox || !Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) {
    throw new Error(`Invalid map region: ${JSON.stringify(region)}`);
  }
  if (maxZoom < minZoom) throw new Error(`Invalid zoom range for ${region.id}.`);
  const center = normalizeCenter(region.center, bbox);

  return compact({
    id: String(region.id),
    name: String(region.name),
    countryCode: normalizeCountryCode(region.countryCode),
    parentId: optionalString(region.parentId),
    level: normalizeLevel(region.level, bbox, minZoom),
    bbox,
    center,
    minZoom,
    maxZoom,
    estimatedSizeMb: positiveNumber(region.estimatedSizeMb),
    packFormat: normalizePackFormat(region.packFormat, region.packUrl),
    packUrl: optionalString(region.packUrl),
    dataVersion: optionalString(region.dataVersion ?? region.version),
    checksumSha256: normalizeSha256(region.checksumSha256 ?? region.checksum),
    checksumSha256Url: optionalString(region.checksumSha256Url),
    updatedAt: optionalString(region.updatedAt),
    tags: Array.isArray(region.tags)
      ? Array.from(new Set(region.tags.filter((tag) => typeof tag === 'string' && tag.trim())))
      : undefined,
    description: optionalString(region.description),
  });
}

function normalizeBbox(region) {
  if (Array.isArray(region.bbox) && region.bbox.length === 4) {
    const bbox = region.bbox.map(Number);
    return isValidBbox(bbox) ? bbox : null;
  }
  const bounds = region.bounds;
  if (!bounds) return null;
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north].map(Number);
  return isValidBbox(bbox) ? bbox : null;
}

function isValidBbox(bbox) {
  const [west, south, east, north] = bbox;
  return bbox.every(Number.isFinite) && east > west && north > south;
}

function normalizeCenter(center, bbox) {
  if (Array.isArray(center) && center.length === 2) {
    const nextCenter = center.map(Number);
    if (nextCenter.every(Number.isFinite)) return nextCenter;
  }
  const [west, south, east, north] = bbox;
  return [(west + east) / 2, (south + north) / 2];
}

function normalizeLevel(level, bbox, minZoom) {
  if (['world', 'country', 'region', 'city'].includes(level)) return level;
  const [west, south, east, north] = bbox;
  const span = (east - west) * (north - south);
  if (minZoom <= 4 || span > 120) return 'country';
  if (span < 2) return 'city';
  return 'region';
}

function normalizeCountryCode(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizePackFormat(format, packUrl) {
  if (['maplibre_offline_pack', 'pmtiles', 'mbtiles', 'vector_tiles'].includes(format)) {
    return format;
  }
  const normalizedUrl = optionalString(packUrl)?.toLowerCase() ?? '';
  if (normalizedUrl.endsWith('.pmtiles')) return 'pmtiles';
  if (normalizedUrl.endsWith('.mbtiles')) return 'mbtiles';
  return undefined;
}

function normalizeSha256(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : undefined;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function positiveNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
