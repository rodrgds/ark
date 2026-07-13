# Developer Setup

Ark is an Expo SDK 57 and React Native 0.86 app using Bun, Expo Router, Uniwind, Zustand, SQLite, and local Expo modules.

## Requirements

- Nix and devenv for the repo-standard shell and CI parity
- Android SDK/platform tools or Xcode/CocoaPods only when doing explicit native work

The devenv shell pins the official Bun 1.3.3 `linux-x64-baseline` build so it works on older x86-64 NAS CPUs that cannot run the Nixpkgs Bun build. Keep the checkout under `/workspace` on Hermes/NAS hosts; `node_modules` is installed there with Bun's NAS-safe `copyfile` backend and does not rely on `/tmp` surviving.

## Setup

```sh
devenv shell
setup
```

`setup` and `install` both run a frozen install. They never create or overwrite `.env` or `.env.local`. Interactive Bun commands parse existing `.env` and `.env.local` as dotenv data via Node, then start raw Bun with `--no-env-file`; the files are never sourced, evaluated, or copied into the Nix store.

## Run

```sh
dev
```

Run `bun run android` or `bun run ios` only when native work is intentional. Expo Go is useful for JS-only work; native-heavy features need a development build.

## Checks

```sh
format-check
typecheck
lint
test
build-or-docs
verify
```

`check` runs typecheck, lint, and tests. `verify` adds formatting plus documentation checks/build, and explicitly does not run Expo prebuild, Gradle, Android, iOS, simulator, or device work. Ark installs no commit hook; checks are explicit and run once. GitHub CI keeps its iOS simulator build as a separate job.
