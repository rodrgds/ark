# AGENTS.md — Ark

> Source of truth for any agent working on this codebase. Read this first.

## Recent changes

- Shared input cursor stability: `src/components/ui/input.tsx` deliberately lets native `TextInput` own its text while focused instead of re-sending the controlled `value` prop on every render. This fixes Android cursor jumps when editing in the middle of fields such as Save Web Page URL. External programmatic changes still sync through `setNativeProps`, blur restores controlled rendering, and `src/components/ui/input.rntl.tsx` covers the contract.
- Settings loader resilience pass: `app/(tabs)/settings.tsx` no longer awaits native MapLibre pack sync before loading the rest of Settings and no longer gates AI, Offline Maps, storage, downloads, and diagnostics behind one giant `Promise.all`. Settings probes now run independently with bounded timeouts, stale refresh generations are ignored, native map-pack sync refreshes map rows after it completes, and visible fallback states replace forever text like "Checking model status...", "Calculating...", or "Loading diagnostics..." when a native/storage/model probe stalls.
- Offline Maps browse performance pass: the settings Offline Maps card now indexes downloaded regions by preset instead of repeatedly scanning them, defers the expensive browse-list filter until after the Add map/search interaction paints, caps visible country/custom/detail rows with search-to-narrow copy, and the map-screen Offline Maps sheet now limits initial browse results to a small first page. Field settings now derive fresh-install unit defaults from `expo-localization` locale measurement metadata (`metric`, `us`, `uk`) and repair missing/invalid field preference rows on first read without overriding explicit user choices.
- v1-prep Android feedback pass: `PRODUCT.md`, `DESIGN.md`, and `docs/v1-prep-plan.md` now capture product/design context and the remaining device-test checklist. Autolock now refreshes activity globally from the root layout, checks the latest vault timeout on each enforcement, and has focused coverage. Failed DB boot promises reset so the root "Try again" path can retry. The app-bar vault control now switches from Lock to Unlock and opens the vault unlock path while locked. Content reader header actions were consolidated into a More bottom sheet, TTS now suspends the audio context on stop/finish, TTS controls distinguish Preparing from active playback across guide/document/ZIM/web readers, reader WebView navigation is origin-limited, and curated PDF chapter targets were corrected against physical PDF pages with regression coverage for Hesperian First Aid, Where There Is No Doctor, and FM 21-76. ZIM articles now use a dark-reader wrapper for tables/infoboxes, support in-reader back navigation, and group read aloud plus plaintext sharing behind an Article Actions sheet. Note editor actions now export the current note as PDF or plaintext. Chat Markdown links bare `[1]` citation markers when a citation target exists, and chat process/progress details now collapse behind a short Steps/Sources/Reasoning status row. The document detail screen now keeps Open file as the primary action, groups read aloud/rename/delete in a Document Actions sheet, and keeps OCR retry/status in one offline-search panel. AI Settings now shows current answer/search/install status up front and moves custom GGUF/import URL inputs into an Add answer model sheet. Source-search model rebuilds now update coverage incrementally and keep the previous primary index if a switch fails. Appearance settings now include a real System theme preference plus persisted accent swatches that update Uniwind and navigation colors. Map search now merges local saved data with cached/online Photon place results using a separate `place` result kind and labels them as Online place or Cached place; reverse geocoding reuses cached names and falls back to the bundled map catalog offline so known regions do not degrade to "this area"; map active-download polling includes queued packs; dynamic missing-region prompt state resets on viewport changes. Download notifications deep-link to Settings > Advanced > Downloads and open a focused details/recovery sheet for the selected download, map, or navigation resource. Routing unavailable copy no longer says "install a dev build" on production builds, route fallback now records the direct-line reason, routing graph downloads preflight storage using catalog graph sizes, and Diagnostics now separates routing engine availability from local navigation-data readiness/missing graph files. AI Settings now labels source search as Fast/Thorough and hides the hash fallback unless Battery Reduce Mode is active. RAG embedding rebuild, starter seeding, and search/citation ranking moved from `rag.service.ts` into `src/services/ai/rag/`.
- SDK 57 upgrade: Expo moved to 57.0.1, React Native to 0.86.0, React to 19.2.3, TypeScript to 6.0.3, Expo Router to 57.0.2, and SDK-managed native packages were aligned with `npx expo install expo@^57.0.0 --fix`. The legacy top-level `splash` config was removed in favor of the `expo-splash-screen` plugin, local iOS module podspecs now target iOS 16.4+, Android precompiled headers are enabled, Worklets bundle mode is enabled as the SDK 57 Hermes/Reanimated memory workaround, and `expo prebuild` scripts use `--no-clean` to avoid SDK 57's new default clean/regenerate behavior during local builds.
- SDK 57 build notes: do not import `@react-navigation/native` directly; Expo Router 57 rejects that in production bundles, so import `ThemeProvider`, `DarkTheme`, and `DefaultTheme` from `expo-router`. Keep the TenTap patch that widens its `react-dom` peer to React 19, keep the root `react-dom` override, and avoid direct `expo-modules-core` dependencies in app/local module package manifests or `expo-doctor` will flag duplicates. `expo-image` is required by ArkLogo, `expo-asset`/`expo-linking` are SDK-managed peers, and `splash` must stay under the `expo-splash-screen` plugin. Android release R8 can GC-thrash at the default 2 GB heap; `plugins/with-ark-gradle-memory.js` owns `org.gradle.jvmargs=-Xmx12g -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8` so prebuilds keep enough memory for `bun run build-send`. If an Android release build crashes on startup with repeated `get NativeModules` plus `RangeError: Maximum call stack size exceeded`, or then `copyComponentProperties`/`ActivityIndicator` plus `TypeError: Cannot convert undefined value to object`, check the Uniwind Metro alias first. Ark pins `uniwind` to `1.6.3` and patches native Uniwind internals to import React Native through `react-native/index` so SDK 57/RN 0.86/Worklets bundle mode does not recursively resolve `react-native` back to `uniwind/components`. After changing a patched dependency, force `cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks && ./gradlew :app:assembleRelease`; otherwise Gradle can reuse a stale Metro bundle.
- Android tab/onboarding polish: native tabs are capped at 5 visible sections on all native platforms. `TabPreferencesService` sanitizes persisted `tabs.enabled` before `NativeTabs` renders, so a bad 6/7-tab Android preference should no longer brick launch. The settings UI must keep the same cap. Do not eagerly generate Material tab icon image sources on tab-shell entry; Expo Router `VectorIcon` avoids the post-onboarding icon delay/heat spike. Onboarding map setup should use `queuePresetRegionDownload` so it registers selected maps and advances, then starts tile/routing downloads after the transition. Shared bottom sheets support a pinned `footer`; use it for map route/save/cancel actions so buttons stay above the Android bottom inset.
- Theme defaults: fresh installs start with System theme + System accent, so Android uses Material You dynamic colors when available and otherwise falls back to Moss. Keep the defaults centralized in `src/constants/theme.ts`; do not restore OLED/Moss as the app default unless explicitly requested. OLED remains selectable, and Battery Reduce Mode may still switch the theme to OLED when toggled.
- Tracks and map feedback pass: `TrackRecordingService` now keeps the TaskManager background recorder but also starts a foreground `watchPositionAsync` watcher while the app is active, so the Tracks UI receives samples quickly instead of waiting for deferred background batches. The Tracks card also ticks elapsed time locally between GPS writes. `RouteOptionsSheet` keeps Cancel/Start route at the top of the sheet and shared bottom sheets enable Android nested scrolling, because pinned footers can still be obscured on tall route-option content. Onboarding map setup requests download notification permission before queueing and starts selected map downloads immediately with `startDelayMs: 0`.
- Tracks feature baseline: `Tracks` is now a default tab for field recordings, backed by Expo Location/TaskManager, a `tracks` app storage directory, SQLite `tracks`/`track_points`/`track_markers`, pure stat reducers, GPX export, map overlay/search integration, and Victory Native + Skia chart components. Settings gained a Field section for global units, rate display, default activity, and recording profile. Locked-screen/background recording, Skia/Victory rendering, photo capture, encrypted-DB background failure handling, and battery-drain behavior still need real-device proof.
- CI now includes an iOS simulator native build lane. `scripts/ios-simulator-build.sh` regenerates the iOS project when requested, installs CocoaPods, and runs unsigned `xcodebuild`; `.github/workflows/ci.yml` calls it on macOS as `bun run ios:build:sim`.
- Security cleanup: vault passphrase protection is optional during onboarding and can be turned on/off later in Settings > Security. When enabled, vault password verifiers default to `ark-v4:argon2id` via `@noble/hashes` (`t=2`, `m=19456 KiB`, `p=1`, `dkLen=32`), are saved with `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY`, compare without normal string equality, and rotate salt on passphrase changes. SQLCipher database encryption is optional too: fresh installs open plaintext by default for fast/battery-frugal access, Security can encrypt or return to plaintext when SQLCipher is available, and Diagnostics separates runtime availability from actual DB state (`Encrypted database`, `Plaintext database`, `Not enforced in this build`, or `Needs inspection`). Encrypted DBs use a purpose-derived SecureStore device root and rotate that root during vault passphrase changes. Real-device proof of encrypted/plaintext migration and rekey remains unresolved.
- Offline navigation wiring: `startPresetRegionDownload` accepts `includeNavigation` (default true) and downloads the routing pack alongside map tiles when a region's catalog entry carries `routingPackUrl`. `OfflineRoutingService.downloadRoutingPack` is now idempotent, gates re-entry with `activeRoutingRegionId`, verifies SHA-256 (when advertised), guards 0-byte downloads, posts `DownloadNotificationService` progress/terminal events, and reuses an existing ready graph. `OfflineMapService.deleteRegion` removes the local routing graph too. Portugal Mainland catalog entries (`pt-portugal-overview`, `pt-north-centre`, `pt-lisbon-south`) advertise Valhalla `.tar` packs hosted on GitHub Releases under `routing-v1` and carry the published SHA-256 + actual built size. `map-storage.ts` gained `presetIncludesNavigation`, `presetTotalSizeMb`, `formatPresetTotalSize`, and `routingStatusLabel`; Settings Offline Maps card, Onboarding maps badges, and the map screen MissingRegionPrompt now show "Map + navigation" totals and routing-status lines. `modules/ark-routing/README.md` documents the GitHub Releases static-hosting model and the `.github/workflows/routing-packs.yml` rebuild flow (manual + `routing-v*` tag push). iOS ArkRouting now uses a prebuild/CocoaPods post-install hook to attach the `valhalla-mobile` Swift Package to the app target and calls the same raw Valhalla route API shape as Android through the ObjC runtime; it still needs device route proof with a ready graph.
- Tab reorganization: `NativeTabs` from `expo-router/unstable-native-tabs` with `TabPreferencesService` for user-configurable tab order/visibility. Default visible order is Chat, Tracks, Map, Library, Settings; Tools and Notes are hidden by default but remain searchable/re-enableable; chat + settings are locked. `FunctionSearch` filters tab entries by enabled tabs.
- `app/(tabs)/settings.tsx` refactored from 1982 lines to under 800. Each tab section now lives in `src/components/settings/`. `AppearanceSection`, `SecuritySection`, `BackupSection`, `AboutSection` (smallest), then `AiSection`, `OfflineMapsCard`, `DownloadsCard`, `DiagnosticsCard`, `EmbeddingIndexCard`, `ModelSection` (bigger). Local state (password inputs, model title/url/checksum, map search/browse) moved into the owning section; download recovery detail UI lives in `DownloadsCard`.
- Vault security: rate-limit with exponential backoff (5→30s, 10→5min, 15→1hr), autolock rewrite with background/active lifecycle, boot mutex idempotency, selector-only auth hook, vault gates on editor save.
- Content: Markdown-based authored guides, Defuddle for remote HTML → Markdown extraction, enhanced rich editor with toolbar, high-quality PDF rendering, TTS in document/content readers.
- `src/lib/errors.ts` (ArkError) **deleted** — zero callers.
- 5 unused `package.json` deps removed: `tailwindcss-animate`, `expo-system-ui`, `expo-updates`, `expo-battery`, `punycode`. `expo-linking`, `expo-asset`, `defuddle`, and `expo-splash-screen` are currently installed because SDK 57 peer validation and app features require them.
- Database schema history was collapsed to a fresh v2 baseline for pre-release testing; old pre-v2 databases should be cleared instead of migrated.
- Backup format bumped to v3: now includes `chat_threads`, `chat_messages`, `document_pages`, tracks/track points/track markers, marker photos, and Field settings. Older backups are rejected with "Re-export the backup from this app version."
- `services/db/migrations.ts` now creates the current schema from a single fresh baseline and rejects older pre-release database versions.
- `services/content/zim-html-sanitizer.ts` (new): `sanitizeArticleHtml` strips scripts, void tags, iframes, event handlers, javascript: URLs from ZIM article bodies. `ZimService.articleHtml` pipes through it.
- `src/stores/app-store.ts` boot is now an idempotent mutex with a Pressable "Try again" error splash in `app/_layout.tsx`.
- `app/(tabs)/chat/[threadId].tsx` and `services/ai/ai.service.ts` use a `Map<threadId, ActiveAiRequest>` for targeted cancellation; new requests for the same thread supersede prior in-flight responses.
- `services/files/download-manager.service.ts`: queue mutex (`withQueueLock`), 0-byte guard, free-space math subtracts already-on-disk bytes, `MAX_ACTIVE_DOWNLOADS` 1→3, resumeData invalidation after 30 min.
- `src/components/ui/input.tsx` and `src/services/ai/rag.service.ts` use proper React-subscribed Zustand selectors (no more `getState` outside React).
- `src/constants/map-pins.ts` exposes `BRAND_AMBER`; literal `#F2B84B` replaced throughout.
- Valhalla routing linked natively: Android `ArkRoutingModule.kt` delegates to [valhalla-mobile](https://github.com/Rallista/valhalla-mobile) v0.1.1 (prebuilt `libvalhalla-wrapper.so` from Maven Central; newer Android artifacts require Kotlin 2.3), and iOS `ArkRoutingModule.swift` calls the package's `ValhallaObjc` wrapper dynamically through `plugins/with-ark-routing.js` plus `ArkRouting.podspec` post-install wiring. C++ CMake build removed from `modules/ark-routing/android/build.gradle` — no more cross-compilation. `getEngineStatus()` returns `available: true` when the native bridge is linked. Android and iOS still need real route proof against downloaded `.valhalla.tar` graphs.

## Identity

**Ark** = "Noé's Ark for the offline age." An offline-first survival computer for mobile. The app should remain useful with zero internet after initial downloads: offline maps, downloadable knowledge packs (Wikipedia/ZIM, survival guides, RSS cache), secure encrypted notes/documents, on-device AI/RAG, and practical sensor tools (compass, barometer, level, pedometer, light meter).

**Target:** iOS + Android via Expo/React Native. Current path is Expo Go MVP. Native-heavy features (MapLibre, llama.rn, SQLCipher) require a development build.

**Tone:** Serious, calm, survival-grade utility. Not playful camping app. "Offline command center."

## Tech Stack

| Layer           | Choice                             | Notes                                                                                                                                                                             |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Expo SDK 57 + React Native 0.86    | Development builds for native features; Expo Go is not the target environment for production testing                                                                              |
| Routing         | Expo Router (file-based)           | `app/` directory                                                                                                                                                                  |
| Styling         | Tailwind CSS v4 + Uniwind v1.6     | `global.css` defines OLED/dark/light themes                                                                                                                                       |
| UI primitives   | shadcn-style (CVA + RN Primitives) | 12 components in `src/components/ui/` (Button, Text, Input, Card, Icon, plus Sheet, SheetAlert, Skeleton, Markdown, Progress, ConfirmModal, BottomSheet)                          |
| State           | Zustand v5                         | 5 stores in `src/stores/` (app, auth, theme, sensor, track)                                                                                                                       |
| Database        | expo-sqlite + custom migrations    | `PRAGMA user_version` pattern, FTS5 virtual tables, versioned to 2                                                                                                                |
| Icons           | lucide-react-native                | Wrapped via `src/components/ui/icon.tsx`                                                                                                                                          |
| Date handling   | date-fns v4                        |                                                                                                                                                                                   |
| Validation      | zod v4                             | Installed but barely used                                                                                                                                                         |
| Keyboard        | react-native-keyboard-controller   | Used by `src/components/layout/keyboard-controller.tsx` (ArkKeyboardProvider/AwareScrollView/AvoidingView) — Screen and OnboardingFrame upgrade to native controller when present |
| Package manager | bun                                | Lockfile is `bun.lock`                                                                                                                                                            |

## Project Structure

```
app/                          # Expo Router file-based routes
├── _layout.tsx               # Root: boot splash → theme/nav shell
├── index.tsx                 # Redirect hub (onboarding vs tabs)
├── +html.tsx                 # Web-only <head> injection
├── +not-found.tsx            # 404 fallback
├── easter-egg.tsx            # Hidden debug surface
├── content/[id].tsx          # Content pack reader
├── documents/[id].tsx        # Imported document viewer
├── library/[packId]/...      # Library sub-routes
├── notes/editor.tsx          # Note editor (vault-gated)
├── onboarding/               # 8 step screens
│   ├── _layout.tsx           # Stack navigator
│   ├── index.tsx             # Step 1: intro cards
│   ├── security.tsx          # Step 2: create vault + biometrics
│   ├── permissions.tsx       # Step 3: location + sensor permission
│   ├── maps.tsx              # Step 4: map region primer
│   ├── power.tsx             # Step 5: battery-reduce-mode + low-power guidance
│   ├── packs.tsx             # Step 6: starter pack selection
│   ├── models.tsx            # Step 7: on-device model primer
│   └── finish.tsx            # Step 8: AI notes + "Enter Ark"
├── (tabs)/                   # 7 configurable bottom tab routes
│   ├── _layout.tsx           # Tabs + LockStateBar
│   ├── index.tsx             # Home: status dashboard + action cards
│   ├── chat.tsx              # AI chat list (thread [threadId] for one)
│   ├── tracks.tsx            # Tracks home + active recorder
│   ├── map.tsx               # Map shell
│   ├── library.tsx           # Content pack browser
│   ├── notes.tsx             # Vault-gated secure notes list
│   ├── tools.tsx             # Sensor tool hub
│   └── settings.tsx          # Theme / security / diagnostics
├── tracks/                   # Track detail stack
│   ├── _layout.tsx
│   └── [id].tsx              # Summary, map, charts, intervals, markers, GPX
└── tools/                    # 11 tool screens
    ├── _layout.tsx           # Stack navigator
    ├── compass.tsx           # Magnetometer → heading + cardinal
    ├── barometer.tsx         # hPa + pressure trend
    ├── level.tsx             # Accelerometer → pitch/roll bubble
    ├── pedometer.tsx         # Step counter
    ├── light.tsx             # Light meter (lux)
    ├── coordinates.tsx       # GPS lat/lon with saved-spots actions
    ├── checklist.tsx         # Offline readiness checklist
    ├── chronometer.tsx       # Stopwatch / countdown
    ├── weather.tsx           # Cached forecast + barometer
    ├── news.tsx              # Cached RSS reader (news/[feedId].tsx is the detail sub-route)
    └── diagnostics.tsx       # Native capability report

src/
├── components/
│   ├── ui/                   # shadcn-style primitives
│   ├── layout/               # 5 layout helpers
│   │   ├── app-shell.tsx     # LockStateBar (vault lock indicator)
│   │   ├── screen.tsx        # Screen wrapper (KeyboardAvoidingView fallback)
│   │   ├── keyboard-controller.tsx  # ArkKeyboardProvider/AwareScrollView/AvoidingView
│   │   ├── app-header-actions.tsx   # Shared header right-slot actions
│   │   └── function-search.tsx      # Cmd-K style search overlay
│   ├── onboarding/           # 2 onboarding helpers
│   │   ├── onboarding-frame.tsx  # Reusable onboarding layout
│   │   └── onboarding-feature.tsx# Single feature card used in intro
│   ├── settings/             # 11 Settings tab sections + cards (extracted from app/(tabs)/settings.tsx)
│   │   ├── appearance-section.tsx
│   │   ├── security-section.tsx
│   │   ├── backup-section.tsx
│   │   ├── about-section.tsx
│   │   ├── ai-section.tsx
│   │   ├── offline-maps-card.tsx
│   │   ├── downloads-card.tsx
│   │   ├── diagnostics-card.tsx
│   │   ├── embedding-index-card.tsx
│   │   ├── field-section.tsx
│   │   └── model-section.tsx
│   ├── tracks/               # Track charts and route preview components
│   └── cards/
│       └── action-card.tsx   # Pressable card with icon + title + description
├── constants/                # 12 constants modules
│   ├── app.ts                # APP_NAME, APP_SLOGAN, APP_TAGLINE, SAFETY_COPY
│   ├── packs.ts              # STARTER_PACKS (8 off-usable content packs)
│   ├── theme.ts              # ThemePreference type, THEME_OPTIONS, NAV_COLORS
│   ├── battery.ts            # Battery-reduce-mode thresholds
│   ├── checklists.ts         # Readiness checklist definitions
│   ├── map-pins.ts           # Map pin color/icon catalogue
│   ├── map-presets.ts        # Offline map presets
│   ├── note-content.ts       # Default note body / template text
│   ├── note-sort.ts          # Note sort orders
│   ├── note-themes.ts        # Note color/theme tokens
│   ├── tracks.ts             # Activity/unit/profile constants
│   └── pack-presentation.ts  # Pack card icon/colors
├── hooks/                    # Custom React hooks
│   ├── use-ark-text-to-speech.ts
│   ├── use-ark-voice-activity.ts
│   ├── use-battery-reduce-mode.ts
│   ├── use-motion-enabled.ts
│   └── use-sensor-subscription.ts
├── lib/                      # 8 lib modules
│   ├── utils.ts              # cn() = twMerge(clsx())
│   ├── logger.ts             # Dev-only console logger
│   ├── platform.ts           # isWeb, isNative helpers
│   ├── theme.ts              # NAV_THEME for React Navigation
│   ├── colors.ts             # hexToRgba utility (NOT a brand-color source; brand color lives in src/constants/map-pins.ts and global.css)
│   ├── label-colors.ts       # Color cycling for note labels
│   ├── note-text.ts          # Note body normalisation helpers
│   └── validation.ts         # zod-style helpers
├── stores/                   # 5 Zustand stores
│   ├── app-store.ts          # Boot state: DB open, FS dirs, content seeding, RAG init flag (`ragRelatedInitialized`), boot mutex
│   ├── auth-store.ts         # Vault lock/unlock state
│   ├── theme-store.ts        # Theme preference + Uniwind integration
│   ├── sensor-store.ts       # Live sensor readings (consumed by tools/ + map heading)
│   └── track-store.ts        # Active recording snapshot subscription
├── services/                 # 17 service domains
│   ├── db/                   # SQLite client + migrations + 12 repositories
│   ├── security/             # Vault, biometrics, keychain, autolock
│   ├── ai/                   # AI service, mock + llama adapters, RAG, chunking, embeddings, voice
│   ├── sensors/              # Compass, barometer, level, pedometer, light, diagnostics
│   ├── maps/                 # Map service, offline packs, geocoding, region updates
│   ├── tracks/               # Recording, stats, formatting, background task, export
│   ├── weather/              # Weather cache + pressure trend
│   ├── content/              # Content pack service, guide service, ZIM, PDFs
│   ├── files/                # FileSystem, download manager, document import, SHA-256
│   ├── connectivity/         # NetInfo wrapper
│   ├── rss/                  # RSS parser + cache
│   ├── backup/               # Encrypted backup export/import
│   ├── audio/                # Audio capture helpers
│   ├── ocr/                  # OCR service (calls ark-ocr native module)
│   ├── device/               # Device capability probing
│   ├── preferences/          # User preferences (theme, autolock, …)
│   └── notes/                # Notes domain helpers (formatting, exports)
└── types/                    # 11 type modules
    ├── ai.ts                 # AiMessage, AiCitation, AiAdapterResponse
    ├── backup.ts             # Backup manifest types
    ├── content.ts            # ContentPack, ContentCategory, ContentFormat
    ├── db.ts                 # OnboardingState, VaultState, Note
    ├── downloads.ts          # DownloadRow, DownloadKind, DownloadStatus
    ├── maps.ts               # MapRegion
    ├── polyfills.d.ts        # Polyfill ambient types
    ├── react-native-keyboard-controller.d.ts  # RNKC ambient types
    ├── security.ts           # VaultUnlockResult, BiometricsStatus
    ├── sensors.ts            # SensorAvailability, DiagnosticReport
    └── tracks.ts             # Track, point, marker, stats, intervals
```

## Navigation Flow

```
Boot → index.tsx
  ├── onboarding not completed → /onboarding (8-step stack)
  │   1. intro → 2. security → 3. permissions → 4. maps
  │   5. power → 6. packs → 7. models → 8. finish → replace(/(tabs))
  └── onboarding completed → /(tabs) (configurable tabs; 5 visible by default)
       Chat | Tracks | Map | Library | Settings
       └── Tools → push stack screens (compass, barometer, level, pedometer,
           light, coordinates, checklist, chronometer, weather, news, diagnostics)
```

**Onboarding guard:** `app/index.tsx` checks `useAppStore.onboarding.completedAt`. If `null`, redirect to `/onboarding`. If set, redirect to `/(tabs)`.

## Database Schema

29 base tables + 4 FTS5 virtual tables
(notes_fts, document_pages_fts, rag_chunks_fts, map_places_fts). Migrations run via
`PRAGMA user_version` and are versioned to 2.

**Key tables actually used by screens:**

- `app_settings` — key-value config (theme preference, etc.)
- `onboarding_state` — single row wizard progress
- `vault_state` — password verifier, KDF salt, hint, auto-lock settings
- `notes` + `notes_fts` — secure notes with FTS search, soft delete
- `chat_threads` + `chat_messages` — AI conversation history
- `rag_sources` + `rag_chunks` + `rag_chunks_fts` — RAG indexing
- `documents` — imported local files plus extracted text/OCR status for RAG
- `document_pages` + `document_pages_fts` — page-level PDF/text/OCR extraction for document search and RAG
- `embedding_models` + `chunk_embeddings` — active embedding-pack metadata and model-specific chunk vector links
- `zim_articles_cache` + `zim_paragraph_chunks` — lazily cached ZIM article paragraphs for RAG
- `map_markers` — saved spots from Coordinates/Map
- `routes` — route drafts built from saved spots
- `tracks` + `track_points` + `track_markers` — recorded movement, samples, markers, photos, and exportable route history
- `rss_feeds` + `rss_items` — official emergency feed refresh and cached item list
- `weather_cache` + `sensor_snapshots` — cached weather + barometer history

**Encryption:** SQLCipher is configured in `app.json`, but database encryption is user-controlled instead of mandatory. Fresh installs default to plaintext so Ark can stay fast and battery-frugal in survival use. Settings > Security can encrypt a plaintext DB or export an encrypted DB back to plaintext when the native SQLCipher runtime is available; each swap keeps a timestamped backup of the prior database. Diagnostics reports SQLCipher runtime availability separately from the opened DB state. Encrypted installs use a purpose-derived SQLCipher key from a SecureStore device root, and vault passphrase changes rotate that device root when the DB is encrypted. Fresh encrypted/plaintext migration proof, real-device rekey proof, and the final device-root vs vault-derived SQLCipher decision remain launch blockers.

## What's Real vs What's Mock/Stub/Placeholder

### REAL (works now):

- OLED/Dark/Light/System theme switching, persisted to SQLite
- SQLite database with a fresh baseline schema (29 base + 4 FTS5 tables), FTS5 search
- Repository layer — all CRUD is against real SQLite
- Secure notes: create, FTS search, favorite, soft-delete (gated by vault unlock)
- Onboarding wizard: 8-step flow with state persistence
- Vault service: optional passphrase protection, Argon2id verifier, password change/disable, biometric unlock via LocalAuthentication when passphrase protection is on, auto-lock lifecycle enforcement
- AI chat: messages stored to DB, mock fallback adapter, llama.rn adapter in dev builds when a GGUF model is installed, streaming tokens, Stop action
- RAG: hybrid FTS plus embeddings, deterministic offline `ark-hash-v2` fallback, ExecuTorch (`react-native-executorch`) text-embedding contexts for the registered `executorch-multi-qa-minilm-l6-cos-v1` (default) and `executorch-multi-qa-mpnet-base-dot-v1` models, installed guide chunks, note indexing, imported document text, PDF page text, imported image OCR text, section/page/document citations, and lazy ZIM paragraph citations when ArkZim is available
- Pressure trend: rising/stable/falling from barometer snapshot history
- Network monitoring: NetInfo wrapper
- App filesystem directories: created at boot
- Content pack manifest: real Kiwix ZIM URLs, public survival/medical PDFs, model GGUF URLs, checksums, source labels
- Real download manager: resumable Expo file downloads, progress, pause/resume/cancel, free-space checks, MD5/SHA-256 verification, app-directory storage
- Content readers: PDF/WebView guide reader with section jumps, ZIM detail screen, OS handoff to Kiwix, Android ArkZim native reader path behind dev builds
- Document ingestion: text-file extraction, Android PDFBox text-layer extraction, capped PDF OCR fallback through ML Kit, Android on-device image OCR through `ark-ocr`, visible extraction/OCR/indexing status, page-level FTS, and document RAG cleanup on delete
- Sensor tools: compass, barometer, level, pedometer, light meter, coordinates, offline weather, readiness checklist, with live readings pushed into the shared `sensor-store` and consumed by the tools and the map heading arrow
- Tracks: recording repository/schema, live recorder UI, markers/photos, stats reducers, splits, Victory Native chart components, GPX export, map overlay/search integration, and global Field units/settings are wired
- RSS feed cache: parse + persist official emergency feeds, read offline
- Encrypted backup: export/import of vault + notes + documents with key derivation

### MOCK / STUB / PLACEHOLDER:

| Feature                 | Status  | What's missing                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map rendering           | PARTIAL | MapLibre is installed and dynamically loaded, with OpenFreeMap Liberty/Dark as the production fallback style and `EXPO_PUBLIC_ARK_MAP_STYLE_URL` for overrides; native map rendering still needs on-device dev-build verification.                                                                                                                                                                |
| Offline map downloading | PARTIAL | MapLibre `OfflineManager.createPack()` is wired when native MapLibre exists, and the map can save the current visible viewport as a custom region; bundled/cached offline place search is wired, but full OSM-derived POI/PMTiles coverage still needs a larger index decision.                                                                                                                   |
| Local LLM inference     | PARTIAL | llama.rn is installed and dynamically loads installed GGUF models; still needs device memory tuning and runtime verification.                                                                                                                                                                                                                                                                     |
| DB encryption           | PARTIAL | Optional SQLCipher is wired: fresh installs default plaintext, Settings > Security can encrypt or return to plaintext, swaps keep timestamped backups, encrypted DBs use a purpose-derived SecureStore device root; still needs fresh encrypted/plaintext migration proof, rekey device proof, and final vault-passphrase/device-root decision.                                                   |
| Password KDF            | PARTIAL | Optional vault passphrase protection uses v4 Argon2id verifiers and can be enabled/disabled from Settings; still needs real-device latency/memory calibration before production claims.                                                                                                                                                                                                           |
| ZIM reader              | PARTIAL | ArkZim compiles on Android with libkiwix/libzim and has an iOS CoreKiwix bridge wired; both platforms still need real-archive device testing.                                                                                                                                                                                                                                                     |
| OCR/PDF indexing        | PARTIAL | Android `ark-ocr` compiles with ML Kit and PDFBox, images use on-device OCR, PDFs use text-layer extraction before OCR fallback; still needs real-device verification with scanned/searchable PDFs.                                                                                                                                                                                               |
| Component tests         | PARTIAL | 14 RNTL mounted tests added (shared Input cursor stability, tab preferences, diagnostics, AI Settings, Downloads recovery, guide reader actions, Library search/import, document detail, Map fallback/search/offline controls, function search, chat index, tabs layout, note editor autosave); broader mounted coverage still growing. Detox onboarding coverage is intentionally deprioritized. |

## Theme System

Defined in `global.css`, `src/constants/theme.ts`, and `src/stores/theme-store.ts`.

- Effective themes: `oled`, `dark`, `light`.
- Saved theme preferences: `system`, `oled`, `dark`, `light`; `system` follows the phone light/dark setting.
- Accent preferences: `system`, `moss`, `amber`, `clay`, `blue`, `violet`.
- Fresh install defaults: `system` theme preference + `system` accent preference.
- `theme-store.ts` calls `Uniwind.setTheme()` for the effective theme and `Uniwind.updateCSSVariables()` for accent variables.
- Runtime color consumers should prefer `useThemeStore((state) => state.colors)` when they need concrete colors for native APIs, WebViews, maps, or navigation.
- New Tailwind-styled UI should use semantic classes (`bg-primary`, `text-primary`, `border-border`, etc.) rather than hard-coded hex values.
- Android Material You accent extraction is wired through the `ark-system-colors` native bridge for the System accent option. Keep Moss as the deterministic fallback in JS and do not claim final dynamic-color quality until it has Android 12+ device visual proof.

## Key Architectural Decisions

1. **No backend server.** Everything is local. No APIs, no auth server, no cloud.
2. **Repository pattern.** Screens never write raw SQL. All DB access through `src/services/db/repositories/`.
3. **Adapter pattern for AI.** `AIService` talks to an adapter interface. Mock now, llama.rn later. Same interface.
4. **Service isolation.** Each domain (security, maps, sensors, content, AI) has its own service directory.
5. **Path alias.** `@/` resolves to `src/` via tsconfig. Always import from `@/components/ui/...`, never `components/ui/...`.
6. **Keyboard handling.** `Screen` and `OnboardingFrame` wrap content in a fallback `KeyboardAvoidingView` and, when the native `react-native-keyboard-controller` is registered, upgrade to `ArkKeyboardAwareScrollView` from `src/components/layout/keyboard-controller.tsx`.

## Anti-Patterns & Known Issues

1. **Native verification remains the main risk:** SQLCipher, MapLibre offline packs, Valhalla routing, ArkZim, ArkOcr, llama.rn, and ExecuTorch embeddings all need real-device verification in development builds.
2. **ZIM support still needs real-archive proof:** Android ArkZim compiles and iOS is wired through CoreKiwix, but both paths still need device testing with large Wikipedia/Medical Wikipedia archives.
3. **Valhalla routing still needs native route proof:** Android and iOS both use valhalla-mobile, but each platform still needs route-calculation proof with a downloaded `.valhalla.tar` graph before turn-by-turn can be treated as ready.
4. **Password KDF still needs device calibration:** v4 Argon2id replaced the old SHA verifier path for new passphrase writes, but real-device latency/memory proof is still required.
5. **RAG embeddings need device validation:** ExecuTorch (`react-native-executorch`) text-embedding contexts for the `executorch-multi-qa-minilm-l6-cos-v1` (default) and `executorch-multi-qa-mpnet-base-dot-v1` models are wired with an `ark-hash-v2` fallback, but real-device quality, memory, and sqlite-vec KNN behavior still need verification.
6. **Mounted UI tests are still growing:** current coverage includes focused RNTL tests for tab preferences, diagnostics, AI Settings, Downloads recovery, guide reader actions, Library search/import, document detail, Map fallback/search/offline controls, function search, chat index, tab layout, and note editor autosave; broader mounted coverage is still needed. E2E onboarding coverage is intentionally deprioritized for now.
7. **Big screens:** route files are now thin or under 1k: `app/(tabs)/map.tsx` re-exports `src/components/map/map-screen.tsx`, `app/chat/[threadId].tsx` is under 1k after attachment/page helpers moved to `src/components/chat/chat-thread-utils.ts`, `app/(tabs)/settings.tsx` was extracted via `src/components/settings/`, and `src/services/ai/rag.service.ts` now delegates seed/search/embed internals to `src/services/ai/rag/`. Continue splitting `src/components/map/map-screen*.tsx` before adding more map UI.

## Build / Run Commands

```sh
devenv shell   # Official Bun 1.3.3 linux-x64-baseline on Hermes/NAS; includes tar/gzip for llama.rn postinstall
setup          # Frozen install; preserves live links to local modules and never writes env files
dev            # Start Expo (clears cache)
check          # Typecheck + lint + tests
format-check   # Check formatting
build-or-docs  # Docs drift check + VitePress build
verify         # Source/docs gates only; no native or Android build
```

Keep Hermes/NAS checkouts under `/workspace` so `node_modules` is durable; do not depend on `/tmp`. Bun wrappers parse `.env` and `.env.local` as data through Node and invoke raw Bun with `--no-env-file`; never source/eval dotenv. Run native, device, prebuild, Gradle, or deployment commands only when explicitly requested.

## Dev Group Delivery

When asked to build and send to the dev group:

1. Run `bun run android:build:prod`.
2. Use APK `android/app/build/outputs/apk/release/app-release.apk`.
3. If Beeper is unauthenticated, run `beeper setup --yes`.
4. Send to `beeper://select-thread/whatsapp/!Hf5OYEW7nA8jd9xaPncq:beeper.local` with:
   `beeper send file --to '!Hf5OYEW7nA8jd9xaPncq:beeper.local' --file android/app/build/outputs/apk/release/app-release.apk --mime application/vnd.android.package-archive --caption '<short build note + SHA-256>' --wait --wait-timeout 120000 --timeout 5m --json --yes`
