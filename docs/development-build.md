# Development Build Setup

Ark's Expo Go MVP cannot load SQLCipher runtime keying, MapLibre native rendering, or llama.rn. Use an Expo development build for native-heavy work.

## Build Profiles

The repo includes `eas.json` with:

- `development`: internal dev client, Android APK, iOS simulator build.
- `preview`: internal QA build.
- `production`: app-store style build with auto-increment.

## Commands

```sh
bun install
npx eas login
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
```

Local Android debug builds can use the existing script:

```sh
bun run android:build:dev
bun run android:install
```

Current workspace status on 2026-05-25: TypeScript and Bun tests pass for the MapLibre map domain,
but a local Android native build cannot be completed in this workspace because
`ANDROID_HOME=/home/bpcosta/Android/Sdk` points to a missing directory. Install the Android SDK
before treating native MapLibre, SQLCipher, ArkZim, ArkOcr, or llama.rn as verified locally.

For local Android verification:

1. Install Android Studio or the Android command-line tools.
2. Install an SDK platform compatible with Expo SDK 55, Android build tools, platform-tools, and
   the Android SDK command-line tools.
3. Set `ANDROID_HOME` to the SDK directory, for example `export ANDROID_HOME=$HOME/Android/Sdk`.
4. Add `$ANDROID_HOME/platform-tools` to `PATH` if you need `adb install`.
5. Re-run `bun run android:build:dev`, or from `android/` run
   `GRADLE_USER_HOME=/tmp/ark-gradle ./gradlew assembleDebug --no-daemon`.
6. Install the APK on a real device or emulator and verify that MapLibre renders, an offline pack
   downloads, app restart preserves the pack, and airplane mode still shows the downloaded region
   and saved pins.

The build includes MapLibre, expo-sqlite with SQLCipher/sqlite-vec config, and llama.rn once the
native toolchain is available. llama.rn builds CPU-only unless the Hexagon SDK is installed.

## Native Feature Checklist

- SQLCipher: keep `expo-sqlite` configured with `useSQLCipher: true`. Ark now applies a
  SecureStore-backed `PRAGMA key` before migrations/data access and reports `cipher_version` in
  Diagnostics when the native runtime exposes SQLCipher. This follows Expo's SQLCipher docs, which
  require setting the key immediately after opening the database.
- MapLibre: `@maplibre/maplibre-react-native` is installed and registered in `app.json`. `MapService`
  dynamically detects the native runtime, and `OfflineMapService.refreshRegion()` creates MapLibre
  offline packs from manifest-backed regions. Remaining native proof: local/EAS dev-build compile,
  real-device render, offline-pack download/resume/delete, and airplane-mode use after restart.
- llama.rn: install the package in a dev build, load GGUF models from Ark model storage, and stream tokens through the existing AI adapter interface.

## Map Environment

- `EXPO_PUBLIC_ARK_MAP_STYLE_URL`: optional production MapLibre style JSON URL. Use an
  OpenStreetMap-derived source and never commit private API keys.
- `EXPO_PUBLIC_ARK_USE_JSON_MAP_STYLE=true`: optional local tactical style using the configured
  OpenFreeMap vector source for development.
- `EXPO_PUBLIC_ARK_MAP_CATALOG_URL`: optional remote region manifest. Ark caches the last valid
  catalog in SQLite and falls back to `assets/map-catalog.json` when offline or when the remote
  manifest is invalid.

Do not present SQLCipher, MapLibre downloads, or local LLM inference as production-ready until the dev build path has been exercised on-device.
