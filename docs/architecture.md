# Architecture

Ark is a local-first Expo/React Native app. The architecture is intentionally service-oriented: screens compose UI and call domain services; durable behavior lives under `src/services/**`; database access goes through repositories.

## Runtime layers

| Layer          | Location             | Responsibility                                                                      |
| -------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Routes/screens | `app/**`             | Navigation, screen composition, loading/error states.                               |
| UI components  | `src/components/**`  | Reusable visual primitives and feature cards.                                       |
| Stores         | `src/stores/**`      | App boot state, auth/vault state, theme, live sensors.                              |
| Services       | `src/services/**`    | Offline maps, downloads, content, AI, sensors, security, weather, backup, OCR, RSS. |
| Repositories   | `src/services/db/**` | SQLite schema, migrations, and typed data access.                                   |
| Native modules | `modules/**`         | Android/iOS bridges for routing, OCR, and ZIM reading.                              |
| Static assets  | `assets/**`          | App icons, generated brand assets, catalog files, bundled authored content.         |

## App boot

On boot, Ark opens SQLite, prepares app directories, runs migrations, seeds local catalogs and authored guides, recovers download state, checks native capability status, initializes RAG-related services, and loads persisted settings. Boot must not require the network.

## Offline storage

Ark creates app-scoped folders for content, maps, models, imports, backups, and cache. User-created notes, settings, download metadata, map pins, routes, RSS metadata, and indexes live in SQLite. Large downloaded files stay in the file system and are referenced from database rows.

## Security model

The vault service owns password unlock, biometric unlock, lock state, failed-attempt rate limiting, and auto-lock. SecureStore is used for small verifier/key material. Personal content should be treated as sensitive even when a UI route is already vault-gated.

Do not claim production-grade encryption unless the relevant dev-build path has been verified on device. See `docs/release-readiness.md`.

## Content model

Ark supports several content types:

- Authored Markdown guides bundled in source and seeded locally.
- PDF guides downloaded and rendered on device.
- HTML snapshots extracted into clean Markdown.
- Kiwix ZIM archives downloaded for offline knowledge access.
- RSS feeds cached for later reading.
- User-imported documents and custom model URLs.

The canonical list of starter content lives in `docs/content-pack-urls.md` and `src/constants/packs.ts`.

## AI and RAG

`AIService` talks to an adapter. Native builds can use llama.rn/GGUF models from Ark model storage. Expo-safe builds use the mock fallback. Retrieval uses indexed notes and curated guide chunks, with deterministic fallback behavior when vector/native embedding paths are unavailable.

AI output must remain caveated. It is useful for offline search and summarization, not a source of truth for critical decisions.

## Maps and routing

Map surfaces use MapLibre when the native module exists. Offline map packs are managed by app services, not assumed to be globally available. Routing packs are separate downloadable artifacts and may be larger than map style/tile data. Android routing uses the local `ark-routing` module; iOS routing remains a future native path unless documented otherwise.

## Native-heavy features

The following should be tested in a development build before being marked ready:

- MapLibre render/offline pack lifecycle.
- SQLCipher and sqlite-vec runtime behavior.
- ArkZim embedded reading.
- ArkOcr document/image OCR.
- llama.rn local model inference.
- Valhalla routing pack loading and route calculation.

## Design constraints

- Offline behavior first.
- No backend dependency for core app launch.
- No hidden account requirement.
- Conservative emergency/medical/foraging/weather language.
- Battery-aware defaults.
- Small, explicit service boundaries over broad abstractions.
