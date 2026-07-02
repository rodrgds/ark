# Developer Setup

Ark is an Expo SDK 57 and React Native 0.86 app using Bun, Expo Router, Uniwind, Zustand, SQLite, and local Expo modules.

## Requirements

- Bun
- Android SDK and platform tools for Android builds
- Xcode and CocoaPods for iOS simulator builds
- Nix and devenv for the repo-standard shell and CI parity

## Install

```sh
bun install
```

## Run

```sh
bun run dev
bun run android
bun run ios
```

Expo Go is useful for JS-only work. Native-heavy features need a development build.

## Checks

```sh
bun run typecheck
bun run lint
bun run test
bun run check:docs
bun run docs:build
```

The GitHub CI path runs format, typecheck, lint, tests, and an iOS simulator native build when app or CI files change.
