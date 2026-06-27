# Contributing to Ark

Ark is beta-stage mobile software. Good contributions are small, tested, and honest about native/runtime limitations.

## Good first areas

- Android device verification for MapLibre, offline packs, Valhalla routing, ArkZim, ArkOcr, SQLCipher, and llama.rn.
- Download reliability: resume/cancel/delete behavior, low-storage handling, checksum verification, and queue recovery.
- Documentation drift fixes when code changes behavior.
- UI polish that keeps Ark serious, readable, low-power, and non-gimmicky.
- Tests for repositories, services, migrations, backup/restore, notes, downloads, and settings.

## Before opening a PR

```sh
bun install
bun run typecheck
bun run lint
bun run test
```

Use `bun run check` for the full local gate.

For native Android work, also run a dev build on a real device or emulator when possible:

```sh
bun run android:build:dev
bun run android:install
```

Document what device/build you tested in the PR body.

## Code style

- Keep screens thin. Put durable behavior in `src/services/**` and persistence behind repository modules.
- Prefer boring, explicit TypeScript over clever abstractions.
- Do not add a dependency unless it removes more risk than it creates.
- Do not block app boot on network access.
- Keep offline behavior first-class; every network feature needs a failure/offline state.
- Keep safety copy conservative. Ark must not imply medical, foraging, weather, AI, or disaster guidance is authoritative.

## Documentation

Update docs in the same PR when behavior changes. The most important files are:

- `README.md` for public project positioning.
- `AGENTS.md` for implementation-level source-of-truth notes.
- `docs/release-readiness.md` for release risk.
- `docs/content-pack-urls.md` for curated downloads.
- `docs/development-build.md` for native build behavior.

## Issues

Use public issues for bugs, feature proposals, and docs gaps. Include:

- Platform: Android, iOS, web, Expo Go, or dev build.
- Device/emulator model and OS version.
- Build profile or command used.
- Reproduction steps.
- Expected result and actual result.
- Logs/screenshots when relevant.

Do not report security issues in public issues. Use `SECURITY.md`.
