<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/images/readme-logo-dark.png" />
    <img src="assets/images/readme-logo.png" alt="Ark logo" width="150" />
  </picture>
</p>

<h1 align="center">Ark</h1>

<p align="center"><strong>Noé's Ark for the offline age.</strong></p>

<p align="center">
  <a href="https://github.com/rodrgds/ark/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="Expo SDK 57" src="https://img.shields.io/badge/Expo-SDK%2057-000020.svg" />
  <img alt="React Native 0.86" src="https://img.shields.io/badge/React%20Native-0.86-61dafb.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178c6.svg" />
  <img alt="Offline first" src="https://img.shields.io/badge/offline--first-yes-2f855a.svg" />
  <a href="https://ark.rgo.pt"><img alt="Docs" src="https://img.shields.io/badge/docs-ark.rgo.pt-29302a.svg" /></a>
</p>

Ark is an offline-first survival computer for iOS and Android. It combines downloadable maps, emergency knowledge packs, secure notes/documents, local search, on-device AI/RAG, cached feeds/weather, and practical sensor tools in one mobile app that remains useful after the internet disappears.

This repository is the beta/open-source development home for Ark. The app is not a substitute for emergency services, medical professionals, official local instructions, or verified field training.

## Why Ark

Most preparedness apps solve one narrow problem: maps, notes, PDFs, weather, or a chatbot. Ark's bet is that the useful version is integrated and local-first: one place to download what matters before a crisis, search it offline, annotate it privately, and use phone sensors when the network is gone.

Good references in the same orbit are offline navigation apps like OsmAnd/Organic Maps/CoMaps, offline knowledge readers like Kiwix, and survival/off-grid toolkits. Ark is different because it tries to connect those pieces into one private mobile command center instead of another single-purpose app.

## Features

- Offline maps, saved places, route drafts, region downloads, and navigation-data status.
- Downloadable knowledge library with guides, PDFs, ZIM archives, HTML snapshots, RSS feeds, imports, and full-text search.
- Private notes, document storage, vault protection, encrypted backups, soft delete, labels, favorites, and export paths.
- Ask Arky chat and source search over local documents, notes, and curated packs.
- Field tools: compass, barometer, level, pedometer, light meter, coordinates, weather cache, chronometer, diagnostics, and readiness checklists.
- Tracks for field recordings with route history, stats, markers, GPX export, and map overlays.
- Battery-aware settings, offline diagnostics, resumable downloads, and a command-search surface for quick navigation.

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/library.png" alt="Ark library" width="170" /></td>
    <td><img src="docs/screenshots/map.png" alt="Ark offline map" width="170" /></td>
  </tr>
</table>

## Stack

- **App:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript.
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

- [Documentation website](https://ark.rgo.pt)
- [User guide](https://ark.rgo.pt/user/getting-started)
- [Maps and navigation](https://ark.rgo.pt/user/maps-navigation)
- [Vault, notes, and backups](https://ark.rgo.pt/user/vault-notes-backups)
- [Developer setup](https://ark.rgo.pt/developer/setup)
- [Architecture](https://ark.rgo.pt/developer/architecture)
- [Native builds](https://ark.rgo.pt/developer/native-builds)
- [Release checklist](https://ark.rgo.pt/release/release-checklist)
- [F-Droid preparation](https://ark.rgo.pt/release/fdroid)

## Project status

Ark publishes installable Android APKs through GitHub Releases. Core app flows exist, but this is not a polished store release yet. The most important remaining work is native-device verification, security hardening, checksum coverage, and real-world usability testing.

## Contributing

Contributions are welcome, especially around Android device testing, offline maps/routing, ZIM reading, download integrity, UI polish, docs, and small reliability fixes. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

Security issues should not be reported in public issues. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

Third-party content packs, maps, models, datasets, guides, and documentation sources keep their own licenses and terms. Ark's license covers this repository's code and project-owned assets only.
