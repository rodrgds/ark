# Ark

**Noé's Ark for the offline age**

Ark is an offline-first survival computer for mobile. The initial Expo/React Native MVP focuses on clean architecture for offline maps, downloadable knowledge packs, secure notes/documents, RSS cache, local AI/RAG, and practical sensor tools.

## Run

```sh
bun install
bun run dev
```

Use Expo Go for the current MVP path. Native-heavy features such as MapLibre offline packs and llama.rn local models require a development build before they can run.

## Implemented

- Expo Router app shell with onboarding and bottom tabs.
- OLED black theme by default, with OLED/Dark/Light/System settings.
- SQLite database client, `PRAGMA user_version` migrations, FTS tables, and repository layer.
- First-run onboarding for intro, vault setup, permissions, starter packs, and AI setup notes.
- Vault service with password verifier storage, biometric unlock path, lock state, and auto-lock service stub.
- Secure notes screen gated by vault unlock, with create/search/favorite/soft-delete and RAG indexing.
- Library screen with starter content pack manifest and mock install/download state.
- Chat screen using `AIService` with a mock AI adapter and FTS-backed RAG source shape.
- Map screen shell with offline map region repository and MapLibre-safe unavailable state.
- Tools hub plus compass, barometer, level, pedometer, light meter, and diagnostics screens.
- File-system service that creates app directories for `content/`, `maps/`, `models/`, `imports/`, and `cache/`.

## Native Build Notes

- `app.json` configures app name, SecureStore, LocalAuthentication, SQLite with FTS/SQLCipher flags, sensors, and location permission strings.
- MapLibre is intentionally not installed in this Expo Go-safe MVP. Add `@maplibre/maplibre-react-native` in a development build and wire `MapService`/`OfflineMapService` to `OfflineManager`.
- llama.rn / `@react-native-ai/llama` is represented by an adapter placeholder. Do not download a large model automatically; use the model manager flow when native support is added.
- SQLCipher is configured at the Expo plugin level, but the current runtime does not activate a DB key path. Diagnostics reports vault encryption as not active.

## Architecture Notes

- **DB/repositories:** `src/services/db/client.ts` opens SQLite once and runs migrations from `src/services/db/migrations.ts`. Screens call repositories instead of raw SQL.
- **Vault/security:** `VaultService` owns initialization, password unlock, biometric unlock, and lock state. SecureStore is used only for small verifier/token material; raw passwords are never stored.
- **Downloads/content packs:** `ContentPackService` and `DownloadManagerService` manage starter pack state and mock downloads while preserving rows for real downloads later.
- **Sensors:** Each sensor has a small service wrapper with availability checks and clean start/stop subscriptions. Diagnostics aggregates capability status.
- **AI/RAG adapters:** `AIService` talks to an adapter. The MVP uses `MockAIAdapter`; `LlamaAdapter` is a safe placeholder. `RagService` indexes notes/mock content into FTS now and keeps the interface ready for embeddings.
- **OLED theme:** Theme preference is persisted in SQLite settings. `oled` uses true black `#000000`, near-black cards, high-contrast text, and muted emergency amber as the primary accent.

## Known Limitations

- Vault encryption is not active in this build; personal DB rows are access-gated by app state only.
- Password derivation uses a local hash abstraction because a production KDF is not available in pure Expo Go.
- Downloads are mocked unless real URLs and resumable download handling are configured.
- Map rendering/offline packs and local LLM inference need native development builds.
- Medical, foraging, and AI output are reference-only and must be verified for critical decisions.

## Next Steps

- Add a production KDF and encrypted DB/key handling in a dev build.
- Wire MapLibre native map rendering and offline pack lifecycle.
- Add import flows for PDFs/ZIM/HTML and real RSS fetching.
- Add model download management and a real llama adapter.
- Expand notes editor UX and document vault storage.
