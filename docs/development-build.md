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

Local iOS simulator build proof can use:

```sh
bun run ios:build:sim
```

By default the script builds the host simulator architecture quietly so the CI lane stays usable.
Set `ARK_IOS_UNIVERSAL_SIM=1` for a universal simulator build, or
`ARK_IOS_XCODEBUILD_QUIET=0` when debugging native compiler output. Quiet mode writes the full
native log to `ios/build/ci/xcodebuild.log`; override that with `ARK_IOS_XCODEBUILD_LOG`.

Current workspace status on 2026-07-01: the full local JS gate passes and `bun run
android:build:prod` completes a release APK on this machine. That is build proof only:
`adb devices -l` shows no attached device, so SQLCipher, MapLibre packs, Valhalla routing, ArkZim,
ArkOcr, llama.rn, ExecuTorch, and audio behavior still need real-device verification before being
called production-ready.

Use `docs/android-device-smoke.md` for the concrete Android device pass. It covers clean and
upgraded installs, optional SQLCipher on/off migration/rekey, downloads, MapLibre packs, Valhalla routing, ZIM,
OCR/PDF readers, TTS, local AI/RAG, backups, and Android theme/accent behavior.

For local Android verification:

1. Install Android Studio or the Android command-line tools.
2. Install an SDK platform compatible with Expo SDK 57, Android build tools, platform-tools, and
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

- SQLCipher: keep `expo-sqlite` configured with `useSQLCipher: true`. Ark treats database
  encryption as optional. Fresh installs open plaintext by default for speed and battery, and
  Settings > Security can encrypt the DB or return it to plaintext when SQLCipher is available.
  Diagnostics should distinguish `Encrypted database`, `Plaintext database`, `Not enforced in this
  build`, and `Needs inspection`. Encrypted DB installs use a purpose-derived SQLCipher key from a
  SecureStore device root and rotate that root on vault passphrase changes. The device-root vs
  vault-derived SQLCipher strategy still needs a production decision and device proof.
- MapLibre: `@maplibre/maplibre-react-native` is installed and registered in `app.json`. `MapService`
  dynamically detects the native runtime, and `OfflineMapService.refreshRegion()` creates MapLibre
  offline packs from manifest-backed regions. Remaining native proof: local/EAS dev-build compile,
  real-device render, offline-pack download/resume/delete, and airplane-mode use after restart.
- Valhalla routing: Android and iOS `ark-routing` delegate to `valhalla-mobile` and use downloaded
  `.valhalla.tar` graph packs. Android consumes the Maven artifact; iOS attaches the Swift Package
  to the app target through the ArkRouting Podspec post-install hook during prebuild/CocoaPods
  install, and ArkRouting calls the ObjC wrapper dynamically. Remaining
  proof: route calculation with a ready graph, fallback reason accuracy, rerouting/session behavior,
  and device storage/memory impact.
- llama.rn: install the package in a dev build, load GGUF models from Ark model storage, and stream tokens through the existing AI adapter interface.
- ExecuTorch source search: built-in MiniLM/MPNet contexts drive local source-search embeddings
  with `ark-hash-v2` kept as an internal fallback. Remaining proof: model load memory, rebuild
  progress/rollback, sqlite-vec behavior, and citation quality on device.

## CI Native Build Coverage

- GitHub Actions runs `bun run ios:build:sim` on macOS when app or CI paths change.
- The iOS lane regenerates the native project with Expo prebuild, installs CocoaPods, and runs an
  unsigned host-architecture `xcodebuild` simulator build. It proves the generated iOS native
  project still compiles; it does not replace real-device verification for SQLCipher, MapLibre,
  ArkZim, ArkOcr, llama.rn, ExecuTorch, or audio.

## Map Environment

- `EXPO_PUBLIC_ARK_MAP_STYLE_URL`: optional MapLibre style JSON override. Ark defaults to
  OpenFreeMap Liberty/Dark, which is OpenStreetMap-derived and needs no private API key.
- `EXPO_PUBLIC_ARK_USE_JSON_MAP_STYLE=true`: optional local tactical style using the configured
  OpenFreeMap vector source.
- `EXPO_PUBLIC_ARK_MAP_CATALOG_URL`: optional remote region manifest. Ark caches the last valid
  catalog in SQLite and falls back to `assets/map-catalog.json` when offline or when the remote
  manifest is invalid.
- `EXPO_PUBLIC_ARK_MAP_CATALOG_SHA256`: optional SHA-256 for the exact remote catalog JSON body.
  Use this when the manifest is published from the generated CDN pipeline.

Do not present SQLCipher, MapLibre downloads, Valhalla routing, local LLM inference, or ExecuTorch
source search as production-ready until the dev build path has been exercised on-device.
