<p align="center">
  <img src="assets/images/icon.png" alt="Ark logo" width="112" height="112" />
</p>

<h1 align="center">Ark</h1>

<p align="center"><strong>Noé's Ark for the offline age.</strong></p>

<p align="center">
  <a href="https://github.com/rodrgds/ark/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="Expo SDK 55" src="https://img.shields.io/badge/Expo-SDK%2055-000020.svg" />
  <img alt="React Native 0.83" src="https://img.shields.io/badge/React%20Native-0.83-61dafb.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178c6.svg" />
  <img alt="Offline first" src="https://img.shields.io/badge/offline--first-yes-2f855a.svg" />
</p>

Ark is an offline-first survival computer for iOS and Android. It combines downloadable maps, emergency knowledge packs, secure notes/documents, local search, on-device AI/RAG, cached feeds/weather, and practical sensor tools in one mobile app that remains useful after the internet disappears.

This repository is the beta/open-source development home for Ark. The app is not a substitute for emergency services, medical professionals, official local instructions, or verified field training.

## Why Ark

Most preparedness apps solve one narrow problem: maps, notes, PDFs, weather, or a chatbot. Ark's bet is that the useful version is integrated and local-first: one place to download what matters before a crisis, search it offline, annotate it privately, and use phone sensors when the network is gone.

Good references in the same orbit are offline navigation apps like OsmAnd/Organic Maps/CoMaps, offline knowledge readers like Kiwix, and survival/off-grid toolkits. Ark is different because it tries to connect those pieces into one private mobile command center instead of another single-purpose app.

## Features

### Working today

- Expo Router app shell with onboarding, OLED-first theme, configurable tabs, settings, diagnostics, and a command-search surface.
- Offline library with authored guides, PDF packs, HTML snapshots, ZIM archive downloads, RSS cache, custom imports, and resumable downloads.
- Secure vault flow with password unlock, biometric unlock path, lock state, password changes, auto-lock, soft-deleted notes, favorites, labels, search, and backup/export flows.
- Local RAG pipeline over notes and curated guides using SQLite FTS plus deterministic fallback retrieval.
- Ask Arky chat adapter boundary with mock fallback and native llama/GGUF loading path for development builds.
- Map shell with saved spots, route drafts, offline region suggestions, MapLibre dynamic loading, offline map packs, and Android Valhalla routing-pack integration.
- Tools: compass, barometer, level, pedometer, light meter, coordinates, cached weather, news/feed reader, readiness checklist, chronometer, and diagnostics.

### Native/dev-build features

Some surfaces require an Expo development build rather than Expo Go:

- MapLibre native map rendering and offline packs.
- SQLCipher/sqlite-vec runtime verification.
- Android ZIM reader module.
- OCR native module.
- Local GGUF inference through llama.rn.
- Android Valhalla routing engine and downloadable routing packs.

See [Development Build Setup](docs/development-build.md) before treating native-heavy features as verified on a device.

## Screenshots

<p align="center">
  <img src="docs/screenshots/library.png" alt="Ark library" width="180" />
  <img src="docs/screenshots/map.png" alt="Ark offline map" width="180" />
  <img src="docs/screenshots/chat.png" alt="Ask Arky" width="180" />
  <img src="docs/screenshots/notes.png" alt="Ark notes" width="180" />
</p>

## Stack

- **App:** Expo SDK 55, React Native 0.83, Expo Router, TypeScript.
- **UI:** Uniwind/Tailwind CSS v4, RN primitives, lucide-react-native.
- **State/data:** Zustand, expo-sqlite, FTS, repository/service boundaries.
- **Offline maps:** MapLibre React Native plus app-managed offline map/routing packs.
- **Knowledge:** PDFs, Markdown/authored guides, Defuddle HTML snapshots, Kiwix ZIM archives.
- **AI:** llama.rn/GGUF adapter path, local RAG, deterministic fallback source matcher.
- **Native modules:** `ark-routing`, `ark-ocr`, `ark-zim`.
- **Package manager:** Bun.

## Getting started

```sh
git clone https://github.com/rodrgds/ark.git
cd ark
bun install
bun run dev
```

For a development build instead of Expo Go (required for maps, local AI, and native modules):

```sh
bun run android:build:dev
bun run android:install
```

## Documentation

- [Architecture](docs/architecture.md)
- [Development build setup](docs/development-build.md)
- [Privacy and safety](docs/privacy-and-safety.md)
- [Content packs and URLs](docs/content-pack-urls.md)
- [Model downloads](docs/model-downloads.md)
- [Native routing module](modules/ark-routing/README.md)

## Project status

Ark is beta-stage software. Core app flows exist, but this is not a polished store release yet. The most important remaining work is native-device verification, security hardening, checksum coverage, and real-world usability testing.

## Contributing

Contributions are welcome, especially around Android device testing, offline maps/routing, ZIM reading, download integrity, UI polish, docs, and small reliability fixes. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

Security issues should not be reported in public issues. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

Third-party content packs, maps, models, datasets, guides, and documentation sources keep their own licenses and terms. Ark's license covers this repository's code and project-owned assets only.
