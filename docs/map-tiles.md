# Map Tile Configuration

Ark's Map tab stores manifest-backed offline regions, saved emergency pins, route drafts, and validated manual bounds in SQLite. Native vector map rendering and offline pack downloads require a development build with MapLibre.

## Online Style URL

For the first native pass, use a style JSON from one of:

- MapTiler free tier: `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles-hosted styles if available for the target deployment.

Set `EXPO_PUBLIC_ARK_MAP_STYLE_URL` for the default runtime style. Region-specific overrides are
stored in `map_regions.style_url`. Do not hardcode private API keys into source control.

The source fallback is OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty` for light,
`https://tiles.openfreemap.org/styles/dark` for dark/OLED). Treat public tile services as
development or early deployment sources until Ark has its own tile hosting contract or
self-hosted vector tile pipeline. The legacy MapLibre demo style is intentionally detected as a
demo source and should not be used as Ark's built-in default.

## Region Catalog

Ark treats `assets/map-catalog.json` as a bundled seed/fallback only. The source of truth should be
an Ark-controlled generated manifest hosted on a static CDN or object store. Set
`EXPO_PUBLIC_ARK_MAP_CATALOG_URL` to the manifest URL; Ark fetches it as raw JSON, optionally
verifies `EXPO_PUBLIC_ARK_MAP_CATALOG_SHA256`, normalizes compact generated rows, caches the last
valid catalog in SQLite, and falls back to cache or the bundled seed when offline or invalid.
Relative `packUrl` and `checksumSha256Url` values are resolved against the manifest URL or the
manifest `baseUrl`.

Generate a catalog from curated region boundaries or pack metadata with:

```sh
bun run maps:catalog:build -- --source regions.json --out public/map-catalog.json --base-url https://cdn.example.test/maps/ --source-name ark-pmtiles-openstreetmap --version 20260601
```

Publish both `map-catalog.json` and `map-catalog.json.sha256`. Configure the app with the catalog
URL and the SHA-256 value printed by the generator. This mirrors the MAPS.ME/Organic Maps model at
the architecture level: build map packs from OpenStreetMap-derived data, publish a region tree and
pack metadata, and let the app download from that controlled catalog rather than discovering maps
from an arbitrary public API at runtime.

Remote catalogs can use this compact shape:

```json
{
  "schemaVersion": 1,
  "version": 20260601,
  "generatedAt": "2026-06-01T00:00:00Z",
  "updatedAt": "2026-06-01",
  "source": "ark-pmtiles-openstreetmap",
  "baseUrl": "https://cdn.example.test/maps/",
  "regions": [
    {
      "id": "pt-lisbon-south",
      "name": "Lisbon and South Portugal",
      "countryCode": "PT",
      "level": "region",
      "bbox": [-9.55, 36.85, -6.95, 39.45],
      "center": [-8.25, 38.15],
      "minZoom": 7,
      "maxZoom": 14,
      "estimatedSizeMb": 560,
      "packFormat": "pmtiles",
      "packUrl": "pt-lisbon-south.pmtiles",
      "checksumSha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "dataVersion": "2026-06"
    }
  ]
}
```

Region rows persist manifest IDs, catalog version, data version, pack format, pack URL, checksums,
and estimated sizes so downloaded packs can later be refreshed when map data changes.

## Offline Path

Preferred storage model:

1. Download PMTiles or MapLibre offline packs to `FileSystemService.dir('maps')`.
2. Store region metadata in `map_regions`.
3. Store saved points in `map_markers`.
4. Store simple route drafts in `routes`.

`OfflineMapService.refreshRegion()` calls `OfflineManager.createPack()` when MapLibre is available
and persists native pack IDs in `offline_pack_id`. PMTiles/MBTiles/vector-pack manifest rows are
accepted and preserved for the future self-hosted tile path, but this app version deliberately does
not treat those pack URLs as MapLibre native offline packs; download attempts fail with a clear
unsupported-pack message until a local pack renderer/importer exists. Ark also searches saved spots,
planned regions, and route drafts offline. Remaining map work is Android/iOS dev-build verification,
production style/source configuration, local PMTiles rendering, and a real offline geocoder/place
index.
