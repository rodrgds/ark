# Ark v1 Prep Plan

## Done In This Pass

- Added PRODUCT/DESIGN context files for future UI and product decisions.
- Fixed vault autolock refresh: user activity now updates globally, background return checks the latest timeout setting, and failed DB boot promises can retry.
- Pinned the optional vault password verifier to device-only SecureStore storage and added focused service coverage for vault init/passphrase change/disable persistence.
- Replaced vault verifiers with `ark-v4:argon2id`, avoided normal string equality, and rotated verifier salt on passphrase changes. Old SHA verifier compatibility has been removed for the fresh pre-v1 baseline. Remaining KDF work is device calibration.
- Added explicit DB encryption state tracking for Diagnostics: encrypted, plaintext, unenforced, or unknown.
- Made DB encryption optional: fresh installs open plaintext by default for speed/battery, Settings > Security can encrypt or return to plaintext, and each swap keeps a timestamped backup.
- Collapsed DB compatibility to a fresh pre-v1 baseline. Old app databases should be cleared before testing this build instead of migrated forward.
- Added SQLCipher migration actions. Plaintext-to-encrypted exports the current plaintext DB to an encrypted copy; encrypted-to-plaintext exports an encrypted DB to a plaintext copy. Both move SQLite sidecar files out of the live path, swap the selected DB into place, and reopen in the requested mode.
- Added SQLCipher device-root rotation during vault passphrase changes when the opened DB is encrypted; plaintext and unenforced builds no-op so password changes still work.
- Removed direct lock/unlock actions from the exported auth hook; components now subscribe to vault state while VaultService/AutoLockService own the mutations.
- Grouped content-reader TTS/export/share actions behind a More sheet while keeping Chapters as a first-class header action.
- Split TTS preparing state from active playback across guide, document, ZIM, web, and chat read-aloud controls.
- Made the app-bar vault control stateful: locked opens the vault unlock path, unlocked opens the lock confirmation sheet.
- Hardened reader WebView navigation and ZIM article dark-reader styling.
- Added ZIM in-reader back navigation.
- Added ZIM article actions behind a More sheet with read aloud and plaintext article sharing.
- Added note editor export actions for current-note PDF and plaintext sharing.
- Added an iOS simulator native build gate: `bun run ios:build:sim` plus a macOS CI job that regenerates the iOS project, installs pods, and runs unsigned `xcodebuild`.
- Corrected the curated PDF section page anchors against physical PDF pages and added regression coverage for Hesperian First Aid, Where There Is No Doctor, and FM 21-76.
- Made chat `[1]` citation markers tappable when the citation has a source target.
- Clarified routing fallback copy so production builds do not say "install a dev build".
- Added direct-line fallback reasons for navigation: no covered region, navigation not downloaded/downloading/failed, missing graph file, missing native engine, or route calculation failure.
- Split Diagnostics routing status into engine availability and local navigation-data readiness, including stale "ready but graph file missing" detection.
- Added routing graph storage preflight based on catalog graph size.
- Added cached/online place search to map search while preserving offline saved spot/region/route search.
- Labeled Photon place results as Online place or Cached place so map search does not imply a bundled offline geocoder.
- Reverse geocoding now reuses cached names and falls back to the bundled map catalog offline, so missing-region prompts avoid "this area" for known catalog regions.
- Added an Offline Maps sheet on the map screen with downloaded/browse tabs and a visible-area download action that turns the current MapLibre viewport bounds into a custom offline region.
- Added download notification tap handling to open Settings > Advanced > Downloads and focus the matching download, map, or navigation resource in a recovery/details sheet.
- Cleaned AI Settings wording so source search uses "Fast" and "Thorough" modes; the hash fallback is hidden unless Battery Reduce Mode is active.
- Source-search model rebuilds now write coverage incrementally, refresh Settings coverage while switching, and only promote a new model as the primary search embedding after its rebuild completes.
- Fixed map active-download polling for queued map packs and cleared stale dynamic prompt names when the viewport changes.
- Added persisted System theme support plus configurable accent swatches; accent variables update Uniwind and navigation colors at runtime and are included in encrypted backups.
- Cleaned the document detail screen into one status header with compact metadata chips, a primary Open file action, read aloud/rename/delete grouped in a Document Actions sheet, and a single offline-search/OCR status panel.
- Simplified chat process UI into one collapsed status row with optional Steps, Sources, and Reasoning details; streaming no longer expands the trace panel by default.
- Simplified AI Settings around current answer model, source search, installed model count, and a tucked-away Add answer model sheet for GGUF imports or custom URLs.
- Added mounted AI Settings coverage for the Add answer model sheet, Fast/Thorough source-search labels, rebuild-progress copy, and hidden `ark-hash-v2` fallback in normal mode.
- Added mounted Downloads recovery coverage for notification-selected failed downloads and navigation-graph retry sheets.
- Added mounted guide-reader coverage for keeping Chapters primary while grouping read aloud, export PDF, and share behind Reader Actions.
- Added mounted Library coverage for category browsing, offline pack/document search, model/feed exclusion, document import, and route handoff.
- Added mounted document-detail coverage for the primary Open file action, Document Actions sheet, OCR retry, rename, and read-aloud handoff.
- Added mounted Map coverage for fallback world overview, saved/offline search results, saved data, and offline map recovery controls.

## Still Requires Device Testing

- Android MapLibre pack completion and Settings/Map status refresh while downloading, pausing, app-switching, and restarting.
- Visible-area custom map downloads from the Offline Maps sheet; verify the saved bounds match the current viewport closely enough on Android.
- Android Valhalla route calculation with a downloaded routing pack; verify Diagnostics shows both `Routing engine: active` and `Routing data: ready` before testing a road route, and verify the direct-line fallback reason is accurate if road routing still fails.
- ZIM article link/back behavior, dark tables, and plaintext share/export on real Wikipedia/Medical Wikipedia pages.
- PDF page jumps in all three curated PDFs on Android, especially FM 21-76 later chapters.
- TTS state transition on real Android audio: Preparing -> Stop/Stop reading -> idle across guide, document, ZIM, web, and chat read-aloud controls.
- Download notification tap behavior on Android from running, paused, and failed notifications; verify it opens the matching resource sheet and retry/pause/cancel actions work.
- Note editor PDF/plaintext export through the Android share sheet.
- Chat inline citation taps for guide, document, ZIM, note, RSS, and map sources.
- Online/cached place search behavior with and without network, including visible Online place vs Cached place labels.
- System theme switching on Android while the app is open.
- Accent swatch contrast across OLED, Dark, Light, and System themes.
- Optional security on Android: skip passphrase during onboarding, verify notes open without unlock, turn passphrase protection on in Settings, restart and unlock, then turn passphrase protection off again.
- Optional SQLCipher on Android: from `Plaintext database`, tap `Encrypt DB`, confirm the backup path, restart, verify Diagnostics changes to `Encrypted database`, then tap `Use Plaintext`, restart, and verify notes/chat/documents/maps still load.
- Encrypted DB passphrase rekey on Android: after Diagnostics shows `Encrypted database`, change the vault passphrase, force-close/restart Ark, verify the DB opens, old vault passphrase is rejected, and the new vault passphrase unlocks.

## Immediate Stability

- Device-test vault autolock: background timeout, active-use activity tracking, and settings changes.
- Device-test reader WebView navigation hardening with local guides and installed ZIM articles.
- Verify root "Try again" recovers after a transient DB/bootstrap failure.
- Resolve Expo Doctor dependency drift before treating device failures as feature failures.

## Offline Maps And Navigation

- Verify Android turn-by-turn route status on-device: engine active, Diagnostics routing data ready, graph downloaded, graph readable, route calculated.
- Device-test map-region naming and prompt churn around cached/catalog reverse-geocode fallback, city-level suggestions, and parent-region downloads.
- Device-test the visible-area custom region action before adding a heavier finger-drawn bounds editor.
- Offline place search now has a SQLite/FTS index with bundled place seeds plus Photon-enriched cached rows; full OSM-derived POI/PMTiles coverage remains future data-pipeline work.
- Device-test iOS Valhalla routing now that the Swift Package bridge is wired and the iOS simulator build now passes; keep it marked unproved until a route with a ready graph passes on device.

## Reader And Knowledge Packs

- Keep chapters as a first-class header action.
- Group read aloud, export, and share in a single actions sheet.
- Device-test TTS so "Preparing" appears only before audio starts, then "Stop reading" or "Stop" remains available while speaking.
- Device-test corrected PDF chapter jumps for the curated guides; regression tests now cover the section page tables.
- Device-test ZIM article back navigation, dark-mode styling for tables/blocks, and plaintext share/export.

## AI, RAG, And Models

- Device-test embedding model switching: progress, current model, incremental coverage updates, failed-rebuild rollback, and rebuild state.
- Keep `ark-hash-v2` hidden from normal settings; it only appears when Battery Reduce Mode makes the internal fallback relevant.
- Device-test source citation taps in chat responses.
- Continue validating model screens around outcomes: "Answer model", "Source search", "Voice", "Storage".
- Profile Gemma/Qwen and ExecuTorch models on real Android hardware with memory and cancellation checks.

## Security And Backup

- Current boundary: notes are runtime vault-gated only when passphrase protection is on; documents, chat history, map markers/routes, and RSS data are local sensitive data and included in encrypted backups, but are not individually vault-gated yet. Decide whether to expand runtime vault gating beyond notes before production.
- Clear app data before testing this build; old pre-v1 DB/key compatibility paths have been removed. Fresh SQLCipher-capable builds should show `Plaintext database` by default. Use Settings > Security > `Encrypt DB` and `Use Plaintext` to test both directions, and keep the reported backup until the restarted DB is verified.
- SQLCipher now uses a purpose-derived key from a SecureStore device root when enabled. Device-root rotation is wired for encrypted DBs during vault passphrase changes. It still needs Android proof across restart, and it does not yet prove a vault-derived SQLCipher design.
- Device-calibrate the v4 Argon2id verifier on Android/iOS, then decide whether native libsodium is needed for performance/hardening.
- Decide whether SQLCipher must use a vault-derived key path before production encryption claims.
- Verify backup restore on a clean install with notes, documents, document pages, chat, routes, RSS, and settings.

## UI Cleanup

- Streamline Settings into normal-user and Advanced/Diagnostics modes.
- AI Models and document detail have had first cleanup passes; review current model status, document action sheet behavior, OCR retry, and preview sizing on device before doing deeper visual iteration.
- Continue tuning chat answer layout after device review; progress/retrieval details now collapse behind a short status row.
- Android Material You accent extraction is now wired through the `ark-system-colors` native bridge and appears as the System accent option; it still needs real Android 12+ device proof and contrast review.
- Remove repeated status text and technical engine labels from primary flows.

## Verification

- Keep `bun run check`, `bun run check:docs`, Android arm64 debug build, and `bun run ios:build:sim` as the local gate. CI now runs the iOS simulator build on macOS for app/CI changes.
- Use `docs/android-device-smoke.md` for native runtime smoke notes on Android: SQLCipher, MapLibre, routing, OCR/PDF readers, ZIM, llama.rn, ExecuTorch, audio, backups, and Android theme/accent behavior.
- Add focused tests when fixing a defect; do not rely on broad smoke tests to prove a narrow state machine.
