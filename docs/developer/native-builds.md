# Native Builds

Native builds are required for MapLibre, SQLCipher runtime checks, Valhalla routing, ArkZim, ArkOcr, llama.rn, ExecuTorch, background tracks, and audio behavior.

## Android

```sh
bun run android:build:dev
bun run android:install
```

Production APK proof uses:

```sh
bun run android:build:prod
```

Do not call the Android build from this release-readiness pass unless explicitly requested. The current goal excludes building the app.

## iOS Simulator

```sh
bun run ios:build:sim
```

The script regenerates the iOS project when needed, runs CocoaPods, then performs an unsigned simulator build.

## Device Proof Still Needed

- SQLCipher plaintext/encrypted migration and rekey
- MapLibre render and offline pack lifecycle
- Valhalla route calculation with downloaded graphs
- ZIM search and article reading with large archives
- OCR and PDF extraction
- llama.rn GGUF loading and memory behavior
- ExecuTorch embedding model load, rebuild, and rollback
- Background track recording and battery behavior

See [Development Build Setup](/development-build) for detailed environment notes.
