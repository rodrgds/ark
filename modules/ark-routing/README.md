# Ark Routing

`ark-routing` is Ark's native offline routing bridge. The JavaScript app calls this module for route calculation; the module calls Valhalla when prebuilt Valhalla mobile artifacts are present.

## Current Modes

- **Fallback mode:** always builds and reports `available: false`.
- **Valhalla mode:** builds when Gradle receives `-ParkRoutingValhallaDir=/absolute/path/to/prebuilt-valhalla`.

The app-side navigation, rerouting, routing-pack metadata, and route rendering can be committed now. Real route calculation starts once the Valhalla artifact directory exists.

## Expected Android Artifact Layout

```text
prebuilt-valhalla/
  include/
    valhalla/
    boost/
    ...
  android/
    arm64-v8a/
      lib/
        libvalhalla*.a
        libprotobuf*.a
        libboost*.a
        ...
    armeabi-v7a/
      lib/
    x86_64/
      lib/
```

Build the module with:

```sh
cd android
./gradlew :ark-routing:assembleDebug --no-daemon \
  -PreactNativeArchitectures=arm64-v8a \
  -ParkRoutingValhallaDir=/absolute/path/to/prebuilt-valhalla
```

Build the full app only after the targeted module build works.

## Routing Graph Packs

Ark expects downloaded routing packs to contain Valhalla graph tiles produced by `valhalla_build_tiles`. A map catalog region can advertise:

```json
{
  "routingPackUrl": "https://github.com/rodrgds/ark/releases/download/routing-v1/pt-lisbon-south.valhalla.tar",
  "routingDataVersion": "osm-2026-06",
  "routingChecksumSha256": "...",
  "routingSizeMb": 120
}
```

Ark pulls routing packs from GitHub Releases (static hosting, no backend). The runtime downloads the pack to app storage, verifies it when a SHA-256 is advertised, and passes the local path to Valhalla. When `routingPackUrl` is present on a catalog region, `startPresetRegionDownload` downloads both the map tiles and the routing pack as a single user-facing download.

## Android Build Helper

`scripts/build-valhalla-android.mjs` prepares the expected output directory and runs a CMake Android build for Valhalla. Valhalla's dependency graph is large; use it on a machine with enough RAM/CPU and expect to tune dependency paths.

## Graph Pack Helper

`scripts/build-valhalla-routing-pack.mjs` runs Valhalla tools against an `.osm.pbf` extract and creates a tar archive suitable for `routingPackUrl`.

```sh
PBF=/path/region.osm.pbf OUT=/path/region-valhalla.tar \
  node modules/ark-routing/scripts/build-valhalla-routing-pack.mjs
```

The script invokes `valhalla_build_config`, `valhalla_build_tiles`, and `valhalla_build_extract` with the catalog's tile dir + extract path. It is intentionally minimal: a single PBF in, a single tarball out. Region clipping (e.g. extracting a subregion of the Portugal PBF) is done upstream with `osmium extract --bbox` — the script expects a PBF that already covers the target region.

## CI: Routing Packs Workflow

`.github/workflows/routing-packs.yml` builds and publishes the routing tarballs to GitHub Releases. It is the canonical way to refresh routing data; the local script is for debugging.

**Trigger**

- Manual: `gh workflow run routing-packs.yml -f release_tag=routing-v2` (overrides defaults).
- Tag push: any tag matching `routing-v*` automatically rebuilds the release.
- The workflow defaults to the Portugal mainland regions (`pt-portugal-overview`, `pt-north-centre`, `pt-lisbon-south`); the `regions` input accepts a comma-separated list of catalog ids.

**Pipeline**

1. Cache the Geofabrik Portugal PBF keyed by `assets/map-catalog.json` so reruns reuse the same extract.
2. Pull the latest Portugal PBF from Geofabrik on cache miss.
3. For each region, read its bounds + `routingPackUrl` from `assets/map-catalog.json`:
   - Clip the PBF with `osmium extract --strategy=smart --bbox=<bounds>`.
   - Run `scripts/build-valhalla-routing-pack.mjs` to build the tar.
   - SHA-256 the result and record it in a `checksums.json` sidecar.
4. Upload all `*.tar` files + `checksums.json` as a workflow artifact.
5. Publish / overwrite the assets on the configured GitHub Release via `softprops/action-gh-release@v2`.

**After the run**

Pull the published checksums with `gh release download <tag> -p checksums.json` and bake `routingChecksumSha256` + the actual `routingSizeMb` for each region into `assets/map-catalog.json`. The runtime (`OfflineRoutingService.downloadRoutingPack`) uses the checksum to reject tampered downloads and the size to estimate free-space requirements.

**Re-running for OSM refresh**: Geofabrik updates Portugal daily. To refresh, re-run the workflow with a new tag (e.g. `routing-v2`) and update the catalog. Older tags stay published so existing installs keep working until they are updated.

**Local rebuild** (for one-off regions not in the catalog yet): clip a PBF yourself, set `PBF` + `OUT`, and run the build script. The same tarball format is consumed by the runtime.
