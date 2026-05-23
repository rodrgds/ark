# Ark

**Noé's Ark for the offline age**

Ark is an offline-first survival computer for mobile. The initial Expo/React Native MVP focuses on clean architecture for offline maps, downloadable knowledge packs, secure notes/documents, RSS cache, local AI/RAG, and practical sensor tools.

## Run

```sh
bun install
bun run dev
```

Use Expo Go for the pure Expo surfaces. Native-heavy features such as MapLibre offline packs, llama.rn local models, sqlite-vec, and SQLCipher require a development build before they can run.

## Implemented

- Expo Router app shell with onboarding and bottom tabs.
- OLED black theme by default, with OLED/Dark/Light/System settings.
- SQLite database client, `PRAGMA user_version` migrations, FTS tables, and repository layer.
- First-run onboarding for intro, vault setup, permissions, starter packs, and clean handoff into the app.
- Ark branding, generated app assets, and the Arky mascot component for first-run/product surfaces.
- Vault service with password verifier storage, biometric unlock path, lock state, password change, and app lifecycle auto-lock.
- Secure notes screen gated by vault unlock, with create/search/favorite/soft-delete and RAG indexing.
- Library screen with real downloadable PDFs, ZIM archives, GGUF model packs, document import, RSS refresh, progress state, pause/resume/cancel controls, and installed-content viewing.
- Chat screen using `AIService`, llama.rn dynamic loading when available, mock fallback, and FTS-backed RAG citations from notes/guides/packs.
- Map screen with saved spots, route drafts, recommended/current-area planned regions, MapLibre dynamic loading, and native offline-pack calls in development builds.
- Tools hub plus compass, barometer, level, pedometer, light meter, coordinates, cached weather, readiness checklist, and diagnostics screens.
- File-system service that creates app directories for `content/`, `maps/`, `models/`, `imports/`, and `cache/`.

## Native Build Notes

- `app.json` configures app name, SecureStore, LocalAuthentication, SQLite with FTS/SQLCipher/sqlite-vec flags, sensors, MapLibre, llama.rn, and location permission strings.
- `@maplibre/maplibre-react-native` is installed. `MapService` loads it dynamically, and `OfflineMapService` calls `OfflineManager.createPack()` when the native module exists.
- `llama.rn` is installed and configured. `LlamaAdapter` loads the first installed GGUF model when the runtime supports it; otherwise chat uses the mock fallback.
- SQLCipher is configured at the Expo plugin level, but the current runtime does not activate a DB key path. Diagnostics reports vault encryption as not active.

## Architecture Notes

- **DB/repositories:** `src/services/db/client.ts` opens SQLite once and runs migrations from `src/services/db/migrations.ts`. Screens call repositories instead of raw SQL.
- **Vault/security:** `VaultService` owns initialization, password unlock, biometric unlock, and lock state. SecureStore is used only for small verifier/token material; raw passwords are never stored.
- **Downloads/content packs:** `ContentPackService` and `DownloadManagerService` manage starter packs, real resumable/background-capable file downloads, pause/resume/cancel state, local imports, custom GGUF URLs, installed-file opening/sharing, and pack deletion.
- **Sensors:** Each sensor has a small service wrapper with availability checks and clean start/stop subscriptions. Diagnostics aggregates capability status.
- **Preferences/tools:** Small user preferences and the offline readiness checklist are persisted through `app_settings`.
- **AI/RAG adapters:** `AIService` talks to an adapter. `LlamaAdapter` handles installed GGUF models when available; `MockAIAdapter` remains the Expo-safe fallback. `RagService` indexes notes and curated pack guide chunks into FTS while sqlite-vec/vector embeddings remain a dev-build follow-up.
- **OLED theme:** Theme preference is persisted in SQLite settings. `oled` uses near-black field UI, warm bone text, amber command accents, and moss status support.

## Known Limitations

- Vault encryption is not active in this build; personal DB rows are access-gated by app state only.
- Password derivation uses a local hash abstraction because a production KDF is not available in pure Expo Go.
- Embedded ZIM reading is not complete. Installed `.zim` files can be opened/shared through the OS handoff path for Kiwix or another reader.
- Map rendering/offline packs, sqlite-vec vectors, SQLCipher, and local LLM inference need development-build verification on device.
- Published checksum verification is still pending. Downloads store MD5 fingerprints from Expo where available, but curated packs do not yet include expected checksum metadata.
- Medical, foraging, and AI output are reference-only and must be verified for critical decisions.

## Next Steps

- Add a production KDF and encrypted DB/key handling in a dev build.
- Verify MapLibre native map rendering and offline pack lifecycle on device.
- Add embedded ZIM reading through libzim or bundled Kiwix JS file access.
- Add published checksum metadata and on-device background download verification.
- Add vector embeddings and repository/service/component/E2E tests.
