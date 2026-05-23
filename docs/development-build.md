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

Current workspace status: `bun run android:build:dev` completes successfully. The build includes
MapLibre, expo-sqlite with SQLCipher/sqlite-vec config, and llama.rn. llama.rn builds CPU-only
unless the Hexagon SDK is installed.

## Native Feature Checklist

- SQLCipher: keep `expo-sqlite` configured with `useSQLCipher: true`. Ark now applies a
  SecureStore-backed `PRAGMA key` before migrations/data access and reports `cipher_version` in
  Diagnostics when the native runtime exposes SQLCipher. This follows Expo's SQLCipher docs, which
  require setting the key immediately after opening the database.
- MapLibre: install `@maplibre/maplibre-react-native`, add its config/plugin requirements, then implement `MapService` native detection and `OfflineManager` region downloads.
- llama.rn: install the package in a dev build, load GGUF models from Ark model storage, and stream tokens through the existing AI adapter interface.

Do not present SQLCipher, MapLibre downloads, or local LLM inference as production-ready until the dev build path has been exercised on-device.
