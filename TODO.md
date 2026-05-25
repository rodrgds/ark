# TODO.md — Ark ordered task list

> Ordered by priority. ~ means partially done. ✗ means not started.
> ✅ = done.

---

## PRIORITY 1 — Launch blockers (bugs + core security)

### Bugs

- [x] **Keyboard avoiding for vault inputs** — `OnboardingFrame` now enables iOS keyboard insets and interactive keyboard dismissal on the onboarding ScrollView, so the vault inputs can scroll above the keyboard.
- [x] **Hardcoded `placeholderTextColor="#A1A1AA"` in Input** — Fixed. `src/components/ui/input.tsx` now reads theme from Zustand store and returns correct color per theme (light: `#71717A`, dark/oled: `#A1A1AA`).
- [x] **Home screen "Diagnostics in Tools" button is dead** — Fixed. `app/(tabs)/index.tsx` button now links to `/tools/diagnostics`.
- [x] **No SafeAreaView** — Fixed. Root layout now wraps the app in `SafeAreaProvider`, and the vault lock bar uses `SafeAreaView` for the top edge.
- [x] **"Vault unlocked" header has no top spacing** — Fixed. `LockStateBar` clears the status bar/notch via `react-native-safe-area-context`.
- [x] **Top header pages show URL/path instead of page name** — Fixed for tool stack screens with `app/tools/_layout.tsx` titles: Compass, Barometer, Level, Pedometer, Light Meter, Diagnostics.

### Security (vault = core product promise)

- [ ] ~ **Activate SQLCipher encryption** — Partially wired. `DatabaseClient` now applies a SecureStore-backed `PRAGMA key` before migrations, validates the stored key as generated hex before interpolation, replaces corrupt key material, and records runtime `cipher_version` availability for Diagnostics, following Expo SQLCipher guidance. Diagnostics also reports whether the device key exists and explicitly calls out that plaintext migration/vault-passphrase rekey are unresolved. Android dev build compiles with `expo-sqlite` `useSQLCipher: true`. Still needed: on-device verification against a fresh encrypted DB, safe migration/re-key strategy for existing plaintext DBs, and final decision on whether DB keying must be vault-passphrase-derived instead of device-secret-derived.
- [ ] ~ **Upgrade password KDF** — Partially improved. New vault verifiers now use a v3 versioned SHA-512 stretched verifier with a higher iteration count, and legacy 750-iteration SHA-256 plus v2 SHA-512 verifiers are upgraded after successful unlock/change. Still not production-grade. Need a custom Expo native `ark-kdf` module around libsodium Argon2id with calibrated params, v4 vault header/verifier, root-key purpose splitting, and v3 migration after successful unlock.
- [x] **Wire auto-lock to app lifecycle** — `app/_layout.tsx` now listens to `AppState` changes and calls `AutoLockService.enforce()` when the app returns active.
- [x] **Implement password change** — Settings now has a real passphrase-change flow. `VaultService.changePassword()` verifies the current passphrase, derives the new verifier with the existing salt, and stores it in SecureStore. SQLCipher re-keying remains part of the dev-build encryption task.
- [x] **Wire biometric toggle in Settings** — Settings now reads biometric token state, enables biometric unlock after device authentication, disables by deleting the SecureStore token, and updates onboarding biometric state.

### Core offline capabilities (the "survival computer" part)

- [x] **Set up EAS Build for development builds** — Added `eas.json` development/preview/production profiles and `docs/development-build.md` with cloud and local build steps.
- [ ] ~ **Install and wire MapLibre** — Partially done. `@maplibre/maplibre-react-native` is installed, the Expo config plugin is in `app.json`, `MapService` dynamically loads the native module, the Map tab renders a native map when available, the Map fallback reflects the actual dynamic native-load result, and default style configuration is centralized behind `EXPO_PUBLIC_ARK_MAP_STYLE_URL` with the demo style called out as non-production. `bun run android:build:dev` completes successfully. Still needs on-device runtime verification and a production style URL before shipping map downloads.
- [ ] ~ **Implement real offline map tile download** — Partially done. `OfflineMapService.refreshRegion()` now calls MapLibre `OfflineManager.createPack()` with progress callbacks and stores native pack IDs when the native module exists. Map now supports recommended regions, current-location 25 km/100 km planning, saved-spot bounds planning, validated manual bounds with zoom ranges, and offline search across saved spots, planned regions, and route drafts. Still needs on-device dev-build verification, freehand map-drawn bounds selection, and a real offline geocoder/PMTiles place index.
- [ ] ~ **Real download system** — Partially implemented. `DownloadManagerService` now uses `expo-file-system/legacy.createDownloadResumable()`, requests background download sessions where supported, checks free disk space before known large downloads, stores local files under Ark app directories, writes byte progress/resume data/expected MD5/expected SHA-256/actual MD5/actual SHA-256 fingerprints to SQLite, verifies HTTP status, rejects undersized files, rejects blocked-server HTML/PDF error pages, validates ZIM headers, exposes a visible verifying state after byte transfer reaches 100%, resolves Kiwix `.sha256` sidecars with a timeout, verifies SHA-256 for small files through Expo Crypto and for large files with a chunked streaming SHA-256 path, syncs content-pack status, reuses valid completed local files on retry, and Library exposes pause/resume/cancel controls for large packs. Still needed: on-device background behavior, Android resume-token behavior under process death, and multi-GB checksum performance verification.
- [ ] ~ **Download actual ZIM knowledge files** — Partially implemented. Library now exposes real Kiwix URLs for Simple English Wikipedia mini/nopic, Medical Wikipedia nopic, Wikivoyage English nopic, and a tiny Top 100 test archive, with official Kiwix SHA-256 sidecar URLs recorded. ZIM detail screen and external Kiwix handoff are wired; fully embedded in-app ZIM browsing still needs libzim or bundled Kiwix JS file access.
  - Wikipedia Simple English nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_2026-05.zim`
  - Wikipedia Simple English mini: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_mini_2026-05.zim`
  - Wikivoyage English nopic: `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_2026-03.zim`
  - Medical Wikipedia nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_2026-04.zim`
  - Implement ZIM reader — either embed Kiwix JS in a WebView or use a native reader lib.
- [x] **Actual survival/medical content** — Starter packs now include real downloadable PDFs from Hesperian, the public-domain US Army FM 21-76 survival manual, and USDA Forest Service wild-plant harvest guidance, plus a WebView-backed content reader with section jump targets for first aid, shelter, water, fire, navigation, signaling, field medical topics, and plant-harvest safety. Ark intentionally does not ship mushroom identification guidance without expert local sources and safety review.
- [x] **Implement RSS feed fetching** — `RssService` now seeds official emergency feeds, fetches RSS/Atom XML, parses with `fast-xml-parser`, and caches items to `rss_items`. Library exposes a refresh/readout surface.

### AI infrastructure

- [ ] ~ **Install llama.rn in dev build** — Partially done. `llama.rn` and `expo-build-properties` are installed, native artifacts are present/cached for Android and iOS, the `llama.rn` config plugin is in `app.json`, Bun trusts the package for native artifact downloads, `LlamaAdapter` dynamically loads the first installed GGUF model in dev builds, streams token callbacks into a temporary Chat response bubble, exposes stop/cancel for active completions, and sizes context windows conservatively by model size. The Chat UI now shows a Stop action while Ark is answering, and the Android dev build compiles. Build output reports CPU-only because Hexagon SDK is not installed. Still needed: on-device verification and real-device memory tuning.
- [ ] ~ **Implement model download manager** — Partially implemented. Library now includes real Hugging Face GGUF downloads for Qwen2.5 1.5B Q4_0 and SmolLM2 1.7B Q4_0, published SHA-256 metadata for curated model files, local `.gguf` import, custom GGUF URL registration with optional MD5 or SHA-256, progress-tracked downloads under app model storage, expected-MD5 verification when provided, expected-SHA-256 persistence and chunked verification, and user-facing `ModelManagerService` readiness/status in Library and Settings. Still needed: on-device checksum performance and llama.rn runtime verification.
- [x] **Real weather data** — Weather cache now refreshes from Open-Meteo when stale or empty, uses granted device location with a Lisbon fallback, stores provider/coordinates/forecast JSON, and Home shows cache freshness/staleness.
- [ ] ~ **Upgrade RAG from FTS-only to vector search** — Partially implemented. Installed content packs, notes, imported text documents, imported image OCR text, PDF page text, and best-effort native ZIM search results now feed local AI citations. RAG chunks use hybrid FTS plus embeddings: the deterministic offline `ark-hash-v2` fallback remains available, while installed embedding model packs initialize llama.rn embedding contexts for model-quality vectors. Nomic Embed Text v1.5 is the compact default pack and Qwen3 Embedding 0.6B is the optional multilingual pack. Model-specific sqlite-vec tables are created when the extension is available, with FTS candidate ranking and embedding rerank as the current reliable path. Android PDFs use PDFBox text-layer extraction first and ML Kit OCR fallback only when the PDF looks scanned and is small enough for automatic OCR. ZIM RAG now keeps native ZIM search as primary retrieval and lazily caches paragraphs from searched/opened articles. Still needed: on-device sqlite-vec KNN verification, real-device embedding model performance/quality tuning, and large-ZIM validation with real archives.

---

## PRIORITY 2 — UI/UX quality

### Simplify the UI

- [x] **Complete onboarding overhaul with character assets (Arky poses)**
- [ ] ~ **Full UI revamp** — Partially complete. Home, Chat, Map, Library, Notes, Settings, Tools, onboarding, content/document readers, color, branding, empty states, loading states, and destructive confirmations have been redesigned around the restrained Ark product UI. Still needs on-device visual QA across iOS/Android sizes and final pass after native MapLibre/ZIM/llama verification.
- [x] **Update color scheme to final palette** — OLED, dark, and light themes now use the final restrained Ark palette: near-black field UI, warm bone text, amber command accent, moss status support, and non-placeholder navigation colors.
- [x] **Set up logo and branding** — Added `ArkMark`/`ArkBrandLockup`, replaced key text-only headers, added an Ark SVG source mark, and regenerated app icon, adaptive icon, splash, and favicon PNG assets from `scripts/generate-brand-assets.mjs`.
- [x] **Make OLED the recommended default theme** — OLED is already the default, and the theme picker now labels it as "OLED (Recommended - saves battery)".

- [x] **Redesign Home screen** — `app/(tabs)/index.tsx` now has compact Ark branding, one status card, 3 primary action cards, and an offline storage summary.
  - Keep: Ark branding header (smaller), quick status bar (online/offline dot + vault icon + weather one-liner)
  - Reduce to 3 action cards: "Ask Ark", "Open Map", "New Note"
  - Remove: "Compass" card (it's in Tools tab), "Download Pack" card (it's in Library tab), "Diagnostics in Tools" dead button
  - Add: a small "Offline storage" summary showing total KB/MB downloaded
- [x] **Rethink Tools screen around useful offline tools** — `app/(tabs)/tools.tsx` now keeps real sensors and adds working Coordinates, Offline Weather, and Readiness Checklist routes instead of placeholder cards. Coordinates captures GPS and saves spots to Map, Weather reads/refreshes the cached Open-Meteo forecast, and Checklist persists local readiness state.
- [x] **Reduce Library filter chips** — Library filters are now a compact wrapped set: All, Wiki, Medical, Survival, Maps.
- [x] **Add images/content previews for library packs** — Library packs now have scannable icon treatments by pack type/category, plus source labels and progress states.
- [x] **Improve Chat UX** — Chat now uses an inverted `FlatList`, fixed bottom composer, source toggle, loading/send indicators, empty state, error recovery, and clear-thread action.
- [x] **Improve Map fallback UX** — Map screen now explains the Expo Go/dev-build split, shows recommended offline regions, and references the PMTiles path instead of showing a hostile native-module error.
- [x] **Improve Notes editor — full redesign** — Notes now has a full-height multiline editor, Markdown helper toolbar, preview mode, tags input, timestamps, word/character count, edit mode, empty/search states, and delete confirmation.
- [x] **Fix theme-adaptive `placeholderTextColor`** — Done in `src/components/ui/input.tsx`; duplicate tracking item closed.
- [x] **Improve onboarding UX** — Onboarding now uses Ark branding plus Arky, clearer nontechnical copy, subtle disableable motion, and a safer starter-pack default that avoids pushing huge Wikipedia/model downloads on first launch.
- [x] **Improve Settings UX** — Settings now shows theme descriptions, real auto-lock choices, password change, biometric toggle, offline storage summary, management links, and a persisted subtle-motion preference without burying users in dev-build detail.

### Off-site backups & export

- [ ] ~ **Guide export (share to print)** — Already implemented: the content reader supports share/print for PDF and HTML guides.
- [ ] **Notes export** — Add off-site backup support for vault notes: export individual notes or the full note list as encrypted PDF, plaintext, or downloadable archive so users can print or store copies outside the device.
- [ ] **Wikipedia article export** — Allow users to save/print individual ZIM articles from the in-app reader as PDF or plaintext for off-site reference.
- [ ] **Full vault backup** — Encrypted export of all user data (notes, documents, settings, chat history) to a portable archive file that can be restored on a new device.

### Placeholders → real implementations

- [ ] ~ **Implement `modules/ark-zim` Expo local module** — Local Expo module is now registered as the `ark-zim` package, resolves through Expo autolinking, and Android compiles against `org.kiwix:libkiwix:2.6.0` with archive metadata, article reads, title suggestions, and full-text search when the ZIM has an index. Still needs iOS CoreKiwix binding and real-device ZIM verification.
  - [x] Android: Bind `org.kiwix:libkiwix`
  - [ ] iOS: Bind `CoreKiwix.xcframework`
- [ ] ~ **Build ZIM-backed Encyclopedia reader with WebView** — Content details can open installed ZIM articles in a WebView through ArkZim, and AI citations can deep-link to `/content/:id?article=...`. Still needs iOS native reader support and on-device validation with the large Wikipedia archives.
- [x] **Selective RAG: Connect ZIM search results to local AI context** — Installed ZIM archives now contribute best-effort native ArkZim search results to AI citations, with direct `/content/:id?article=...` links into the in-app article viewer when a dev build has the reader module. The native ArkZim implementation is still required for real on-device Wikipedia article search.
- [x] **Wire up document import UI** — Library now imports files through `expo-document-picker`, copies them into Ark app storage, lists personal documents from SQLite, and opens `/documents/[id]` for preview/open/delete actions.
- [x] **Index imported documents, PDF text, and image OCR for RAG** — Imported text files are extracted into `documents.extracted_text`, PDFs are indexed page-by-page with Android PDFBox text-layer extraction and capped ML Kit OCR fallback for scanned files, imported images run Android on-device OCR through the `ark-ocr` Expo module, Library/document detail show extraction/OCR/indexing state, and document deletion removes the matching page and RAG sources. Expo Go/dev builds without the OCR module report OCR/PDF extraction as unavailable instead of fabricating text.
- [ ] ~ **Wire up ZIM reader** — Placeholder status was replaced with a ZIM detail/reader-planning service and content screen. Installed `.zim` files can be opened through the OS handoff path for Kiwix or another reader, and the ZIM screen now attempts an in-app ArkZim native reader when available: archive metadata, offline search, main page, search results, and article WebView rendering are wired behind the native module boundary. Android ArkZim now compiles against libkiwix/libzim; still needed: iOS CoreKiwix binding plus on-device verification with real archives.
- [x] **Wire up actual biometric toggle** — Done in Settings and `VaultService.setBiometricsEnabled()`.
- [x] **Wire up actual password change** — Done in Settings and `VaultService.changePassword()`.
- [ ] ~ **Wire up model manager** — Partially done. Model packs are real Library entries with download status/delete via content-pack management, local GGUF import, custom GGUF URL import, optional MD5/SHA-256 capture, curated SHA-256 metadata, model size warnings, and `ModelManagerService` reports available/installed model packs plus runtime readiness in Library/Settings. Still needed: on-device checksum performance and llama.rn runtime verification.
- [x] **Wire up sensor store or delete it** — Tool screens now publish compass, barometer, level, pedometer, and light readings into `src/stores/sensor-store.ts`; Tools shows last live readings.

---

## PRIORITY 3 — Code quality & cleanup

### Delete dead code

- [x] **Delete `components/ui/` at project root** — Deleted duplicate root UI component files; active imports resolve to `src/components/ui/` through the `@/` alias.
- [x] **Delete or wire unused `react-native-keyboard-controller`** — Removed from dependencies with `bun remove react-native-keyboard-controller`; the app continues to use built-in `KeyboardAvoidingView`.
- [x] **Audit unused `@rn-primitives/*` packages** — Only `portal` and `slot` are imported; the remaining unused `@rn-primitives/*` packages were removed from `package.json`/`bun.lock`.
- [x] **Delete unused DB tables or implement their UI** — Implemented UI/service usage for `documents`, `map_markers`, `routes`, `rss_feeds`, and `rss_items`.
- [x] **Delete unused `download-store.ts`** — Deleted `src/stores/download-store.ts`; downloads continue through `DownloadManagerService`.
- [x] **Enable zod validation** — Added `src/lib/validation.ts` and wired schemas into note creation/update, vault password requirements, content pack IDs, and chat message payloads.

### UX polish

- [x] **Add tab bar badges** — Tabs now show vault lock status, Library activity/RSS count, and planned map-region count.
- [x] **Add pull-to-refresh** — Home refreshes network/weather/download/storage state, Library refreshes packs/documents/RSS overview, and Notes reloads the note list.
- [x] **Add empty states** — Notes, Chat, Library documents, and no-result states now show explicit empty-state UI.
- [x] **Add loading skeletons** — Added reusable `Skeleton` UI and wired it into Chat, Library, and Notes initial loading states.
- [x] **Add haptic feedback** — Added `HapticsService` and wired vault lock/unlock/password change, note create/update, chat send, and barometer snapshots.
- [x] **Add confirmation dialogs** — Destructive flows now confirm before deleting notes, packs, imported documents, planned map regions, saved spots, route drafts, and before locking the vault.

### Testing

- [x] **Baseline regression tests** — Added Bun tests for content-pack URLs/Wikipedia/model manifest shape, validation schemas, readiness checklist persistence/content contract, and tool route registration.
- [x] **Repository unit tests** — Added Bun-backed SQLite repository coverage for migrations, app settings, content packs, downloads, notes + FTS + soft delete, map regions/markers/routes, RSS, weather, documents, and sensors. The suite caught and fixed an ambiguous RSS join order clause.
- [x] **Service integration tests** — Added Expo-edge-mocked integration coverage for vault initialize/unlock/biometric/change-password, content pack install/download completion, RAG indexing/search, AI chat persistence with citations, and content pack removal clearing RAG sources.
- [ ] ~ **Component smoke tests** — Partially covered with route contract tests for default exports, root stack registration, tab registration, onboarding step order, tools route registration, and placeholder-copy regressions. Still needs a React Native test renderer/Jest or Detox layer that actually mounts screens.
- [x] **Onboarding E2E test** — Deprioritized per product decision. Store-level onboarding completion and route contract coverage remain; no Detox/E2E work is planned for now.

### Documentation

- [x] **EAS Build setup guide** — Added `docs/development-build.md`.
- [x] **Map tile source configuration** — Added `docs/map-tiles.md`.
- [x] **Model download setup** — Added `docs/model-downloads.md`.
- [x] **Content pack URLs** — Added `docs/content-pack-urls.md`.

---

## Content download URLs (reference)

These are the actual URLs used by the current download system:

### ZIM files (Wikipedia/Wikivoyage)

- Wikipedia Simple English nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_2026-05.zim`
- Wikipedia Simple English mini: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_mini_2026-05.zim`
- Wikipedia Medical nopic: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_2026-04.zim`
- Wikivoyage English nopic: `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_2026-03.zim`

### Survival/Medical (public domain texts)

- US Army FM 21-76 Survival Manual (public domain): `https://ia601604.us.archive.org/28/items/Fm21-76SurvivalManual/FM21-76_SurvivalManual.pdf`
- Hesperian New Where There Is No Doctor: First Aid: `https://hesperian.org/wp-content/uploads/pdf/en_nwtnd_2011/en_nwtnd_2014_03g.pdf`
- Hesperian Where There Is No Doctor: First Aid: `https://hesperian.org/wp-content/uploads/pdf/en_wtnd_2025/en_wtnd_2025_10.pdf`
- USDA Forest Service wild plant harvest guidance: `https://research.fs.usda.gov/download/treesearch/45826.pdf`

### Weather (free API, no key required)

- Open-Meteo: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=...` (free, no API key, no account needed)

### Map tiles

- Maptiler free tier (requires API key): `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles: `https://tiles.openmaptiles.org/styles/` (free tier available)

### AI models (for llama.rn)

- Qwen2.5 1.5B Q4_0 GGUF (~1 GB): Good starting model for mobile. From HuggingFace.
- SmolLM2 1.7B Q4_0 GGUF (~1.2 GB): Alternative. Good instruction following.

---

## Summary: what to ship in MVP v1.0

**Must have:**

1. Bug fixes above (keyboard, dead button, safe area)
2. Security baseline (SQLCipher + proper KDF in dev build)
3. Real content packs with actual downloadable content
4. Dev build setup with MapLibre rendering

**Should have:** 5. AI with real LLM in dev build 6. Offline map tile downloads 7. Real weather cache (Open-Meteo) 8. RSS feed fetching 9. ZIM reader

**Nice to have:** 10. Vector search RAG 11. Vision model integration (mushroom ID, etc.) 12. Voice dictation (whisper.rn) 13. Cleaned up UI (decluttered home/tools/library) 14. Tests
