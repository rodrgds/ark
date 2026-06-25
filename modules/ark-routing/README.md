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
