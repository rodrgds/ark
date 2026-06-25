# AGENTS.md — Ark

> Source of truth for any agent working on this codebase. Read this first.

## Recent changes

- Offline navigation wiring: `startPresetRegionDownload` accepts `includeNavigation` (default true) and downloads the routing pack alongside map tiles when a region's catalog entry carries `routingPackUrl`. `OfflineRoutingService.downloadRoutingPack` is now idempotent, gates re-entry with `activeRoutingRegionId`, verifies SHA-256 (when advertised), guards 0-byte downloads, posts `DownloadNotificationService` progress/terminal events, and reuses an existing ready graph. `OfflineMapService.deleteRegion` removes the local routing graph too. Portugal Mainland catalog entries (`pt-portugal-overview`, `pt-north-centre`, `pt-lisbon-south`) advertise Valhalla `.tar` packs hosted on GitHub Releases under `routing-v1`. `map-storage.ts` gained `presetIncludesNavigation`, `presetTotalSizeMb`, `formatPresetTotalSize`, and `routingStatusLabel`; Settings Offline Maps card, Onboarding maps badges, and the map screen MissingRegionPrompt now show "Map + navigation" totals and routing-status lines. `modules/ark-routing/README.md` documents the GitHub Releases static-hosting model.
- Tab reorganization: `NativeTabs` from `expo-router/unstable-native-tabs` with `TabPreferencesService` for user-configurable tab order/visibility. Tools tab hidden by default; chat + settings locked. `FunctionSearch` filters entries by enabled tabs.
- `app/(tabs)/settings.tsx` refactored from 1982 → 679 lines. Each tab section now lives in `src/components/settings/`. `AppearanceSection`, `SecuritySection`, `BackupSection`, `AboutSection` (smallest), then `AiSection`, `OfflineMapsCard`, `DownloadsCard`, `DiagnosticsCard`, `EmbeddingIndexCard`, `ModelSection` (bigger). Local state (password inputs, model title/url/checksum, map search/browse) moved into the owning section.
- Vault security: rate-limit with exponential backoff (5→30s, 10→5min, 15→1hr), autolock rewrite with background/active lifecycle, boot mutex idempotency, vault gates on editor save.
- Content: Markdown-based authored guides, Defuddle for remote HTML → Markdown extraction, enhanced rich editor with toolbar, high-quality PDF rendering, TTS in document/content readers.
- `src/lib/errors.ts` (ArkError) **deleted** — zero callers.
- 8 unused `package.json` deps removed: `defuddle`, `tailwindcss-animate`, `expo-splash-screen`, `expo-system-ui`, `expo-updates`, `expo-battery`, `expo-linking`, `punycode`.
- Migration 18 added `vault_state.failed_attempts` + `locked_until` columns; sqlite_master guard kept (defensive for users who never created a vault).
- Backup format bumped to v2: now includes `chat_threads`, `chat_messages`, `document_pages` + FTS rebuild. v1 rejected with "Re-export the backup from this app version."
- `services/db/migrations.ts` gained `hasColumn(db, table, column)` and `addColumnIfMissing(db, table, column, definition)` helpers for future migrations.
- `services/content/zim-html-sanitizer.ts` (new): `sanitizeArticleHtml` strips scripts, void tags, iframes, event handlers, javascript: URLs from ZIM article bodies. `ZimService.articleHtml` pipes through it.
- `src/stores/app-store.ts` boot is now an idempotent mutex with a Pressable "Try again" error splash in `app/_layout.tsx`.
- `app/(tabs)/chat/[threadId].tsx` and `services/ai/ai.service.ts` use a `Map<threadId, ActiveAiRequest>` for targeted cancellation; new requests for the same thread supersede prior in-flight responses.
- `services/files/download-manager.service.ts`: queue mutex (`withQueueLock`), 0-byte guard, free-space math subtracts already-on-disk bytes, `MAX_ACTIVE_DOWNLOADS` 1→3, resumeData invalidation after 30 min.
- `src/components/ui/input.tsx` and `src/services/ai/rag.service.ts` use proper React-subscribed Zustand selectors (no more `getState` outside React).
- `src/constants/map-pins.ts` exposes `BRAND_AMBER`; literal `#F2B84B` replaced throughout.

## Identity

**Ark** = "Noé's Ark for the offline age." An offline-first survival computer for mobile. The app should remain useful with zero internet after initial downloads: offline maps, downloadable knowledge packs (Wikipedia/ZIM, survival guides, RSS cache), secure encrypted notes/documents, on-device AI/RAG, and practical sensor tools (compass, barometer, level, pedometer, light meter).

**Target:** iOS + Android via Expo/React Native. Current path is Expo Go MVP. Native-heavy features (MapLibre, llama.rn, SQLCipher) require a development build.

**Tone:** Serious, calm, survival-grade utility. Not playful camping app. "Offline command center."

## Tech Stack

| Layer           | Choice                             | Notes                                                                                                                                                                             |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Expo SDK 55 + React Native 0.83    | Expo Go for MVP; dev builds for native features                                                                                                                                   |
| Routing         | Expo Router (file-based)           | `app/` directory                                                                                                                                                                  |
| Styling         | Tailwind CSS v4 + Uniwind v1.6     | `global.css` defines OLED/dark/light themes                                                                                                                                       |
| UI primitives   | shadcn-style (CVA + RN Primitives) | 11 components in `src/components/ui/` (Button, Text, Input, Card, Icon, plus Sheet, Skeleton, Markdown, Progress, ConfirmModal, BottomSheet)                                      |
| State           | Zustand v5                         | 4 stores in `src/stores/` (app, auth, theme, sensor)                                                                                                                              |
| Database        | expo-sqlite + custom migrations    | `PRAGMA user_version` pattern, FTS5 virtual tables, versioned to 18                                                                                                               |
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
│   ├── packs.tsx             # Step 4: starter pack selection
│   ├── power.tsx             # Step 5: battery-reduce-mode + low-power guidance
│   ├── maps.tsx              # Step 6: map region primer
│   ├── models.tsx            # Step 7: on-device model primer
│   └── finish.tsx            # Step 8: AI notes + "Enter Ark"
├── (tabs)/                   # 7 bottom tabs
│   ├── _layout.tsx           # Tabs + LockStateBar
│   ├── index.tsx             # Home: status dashboard + action cards
│   ├── chat.tsx              # AI chat list (thread [threadId] for one)
│   ├── map.tsx               # Map shell
│   ├── library.tsx           # Content pack browser
│   ├── notes.tsx             # Vault-gated secure notes list
│   ├── tools.tsx             # Sensor tool hub
│   └── settings.tsx          # Theme / security / diagnostics
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
│   ├── settings/             # 10 Settings tab sections + cards (extracted from app/(tabs)/settings.tsx)
│   │   ├── appearance-section.tsx
│   │   ├── security-section.tsx
│   │   ├── backup-section.tsx
│   │   ├── about-section.tsx
│   │   ├── ai-section.tsx
│   │   ├── offline-maps-card.tsx
│   │   ├── downloads-card.tsx
│   │   ├── diagnostics-card.tsx
│   │   ├── embedding-index-card.tsx
│   │   └── model-section.tsx
│   └── cards/
│       └── action-card.tsx   # Pressable card with icon + title + description
├── constants/                # 11 constants modules
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
├── stores/                   # 4 Zustand stores
│   ├── app-store.ts          # Boot state: DB open, FS dirs, content seeding, RAG init flag (`ragRelatedInitialized`), boot mutex
│   ├── auth-store.ts         # Vault lock/unlock state
│   ├── theme-store.ts        # Theme preference + Uniwind integration
│   └── sensor-store.ts       # Live sensor readings (consumed by tools/ + map heading)
├── services/                 # 16 service domains
│   ├── db/                   # SQLite client + migrations + 11 repositories
│   ├── security/             # Vault, biometrics, keychain, autolock
│   ├── ai/                   # AI service, mock + llama adapters, RAG, chunking, embeddings, voice
│   ├── sensors/              # Compass, barometer, level, pedometer, light, diagnostics
│   ├── maps/                 # Map service, offline packs, geocoding, region updates
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
└── types/                    # 10 type modules
    ├── ai.ts                 # AiMessage, AiCitation, AiAdapterResponse
    ├── backup.ts             # Backup manifest types
    ├── content.ts            # ContentPack, ContentCategory, ContentFormat
    ├── db.ts                 # OnboardingState, VaultState, Note
    ├── downloads.ts          # DownloadRow, DownloadKind, DownloadStatus
    ├── maps.ts               # MapRegion
    ├── polyfills.d.ts        # Polyfill ambient types
    ├── react-native-keyboard-controller.d.ts  # RNKC ambient types
    ├── security.ts           # VaultUnlockResult, BiometricsStatus
    └── sensors.ts            # SensorAvailability, DiagnosticReport
```

## Navigation Flow

```
Boot → index.tsx
  ├── onboarding not completed → /onboarding (8-step stack)
  │   1. intro → 2. security → 3. permissions → 4. packs
  │   5. power → 6. maps → 7. models → 8. finish → replace(/(tabs))
  └── onboarding completed → /(tabs) (7 bottom tabs)
       Home | Chat | Map | Library | Notes | Tools | Settings
       └── Tools → push stack screens (compass, barometer, level, pedometer,
           light, coordinates, checklist, chronometer, weather, news, diagnostics)
```

**Onboarding guard:** `app/index.tsx` checks `useAppStore.onboarding.completedAt`. If `null`, redirect to `/onboarding`. If set, redirect to `/(tabs)`.

## Database Schema

24 base tables + 3 FTS5 virtual tables
(notes_fts, document_pages_fts, rag_chunks_fts). Migrations run via
`PRAGMA user_version` and are versioned to 18.

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
- `rss_feeds` + `rss_items` — official emergency feed refresh and cached item list
- `weather_cache` + `sensor_snapshots` — cached weather + barometer history

**Encryption:** SQLCipher is configured in `app.json` and the DB client applies a SecureStore-backed key when the native SQLCipher build is available. Diagnostics reports cipher availability and key state. Plaintext migration/re-key strategy and real-device proof are still launch blockers.

## What's Real vs What's Mock/Stub/Placeholder

### REAL (works now):

- OLED/Dark/Light/System theme switching, persisted to SQLite
- SQLite database with full migrations (24 base + 3 FTS5 tables), FTS5 search
- Repository layer — all CRUD is against real SQLite
- Secure notes: create, FTS search, favorite, soft-delete (gated by vault unlock)
- Onboarding wizard: 8-step flow with state persistence
- Vault service: versioned stretched SHA-512 verifier with legacy upgrade, password change, biometric unlock via LocalAuthentication, auto-lock lifecycle enforcement
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
- RSS feed cache: parse + persist official emergency feeds, read offline
- Encrypted backup: export/import of vault + notes + documents with key derivation

### MOCK / STUB / PLACEHOLDER:

| Feature                 | Status  | What's missing                                                                                                                                                                                                 |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map rendering           | PARTIAL | MapLibre is installed and dynamically loaded; native map rendering needs on-device dev-build verification and a production style URL.                                                                          |
| Offline map downloading | PARTIAL | MapLibre `OfflineManager.createPack()` is wired when native MapLibre exists; still needs real-device validation, drawn bounds, and offline geocoder/PMTiles index.                                             |
| Local LLM inference     | PARTIAL | llama.rn is installed and dynamically loads installed GGUF models; still needs device memory tuning and runtime verification.                                                                                  |
| DB encryption           | PARTIAL | SecureStore SQLCipher key path is wired; still needs fresh encrypted DB proof, plaintext migration, and final vault-passphrase/device-key decision.                                                            |
| Password KDF            | PARTIAL | v3 SHA-512 stretching is in place with legacy upgrades; still needs a custom Expo native libsodium Argon2id `ark-kdf` module before production.                                                                |
| ZIM reader              | PARTIAL | Android ArkZim module compiles with libkiwix/libzim and the UI can search/open articles when native is available; iOS CoreKiwix binding and real-archive device testing remain.                                |
| OCR/PDF indexing        | PARTIAL | Android `ark-ocr` compiles with ML Kit and PDFBox, images use on-device OCR, PDFs use text-layer extraction before OCR fallback; still needs real-device verification with scanned/searchable PDFs.            |
| Component tests         | PARTIAL | 6 RNTL screen tests added (tab preferences, function search, chat index, tabs layout, note editor autosave); broader mounted coverage still growing. Detox onboarding coverage is intentionally deprioritized. |

## Theme System

Defined in `global.css`. Three themes as CSS variables:

| Token                  | OLED (default)    | Dark      | Light     |
| ---------------------- | ----------------- | --------- | --------- |
| `--background`         | `#000000`         | `#09090B` | `#FFFFFF` |
| `--card`               | `#000000`         | `#18181B` | `#FFFFFF` |
| `--popover`            | `#000000`         | `#18181B` | `#FFFFFF` |
| `--sidebar`            | `#000000`         | `#1A1A1A` | `#F2F2F2` |
| `--foreground`         | `#FAFAFA`         | `#FAFAFA` | `#0A0A0A` |
| `--card-foreground`    | `#FAFAFA`         | `#FAFAFA` | `#0A0A0A` |
| `--primary`            | `#F2B84B` (amber) | `#F2B84B` | `#996515` |
| `--primary-foreground` | `#0A0A0A`         | `#0A0A0A` | `#FFFFFF` |
| `--muted`              | `#27272A`         | `#27272A` | `#F4F4F5` |
| `--muted-foreground`   | `#A1A1AA`         | `#A1A1AA` | `#71717A` |
| `--border`             | `#27272A`         | `#27272A` | `#E4E4E7` |
| `--destructive`        | `#EF4444`         | `#EF4444` | `#DC2626` |

Brand color tokens are exported from `src/lib/colors.ts`; import from there instead
of hardcoding `#F2B84B` (or any other theme color) in new code. Applied via
`Uniwind.setTheme()` called from `theme-store.ts`.

## Key Architectural Decisions

1. **No backend server.** Everything is local. No APIs, no auth server, no cloud.
2. **Repository pattern.** Screens never write raw SQL. All DB access through `src/services/db/repositories/`.
3. **Adapter pattern for AI.** `AIService` talks to an adapter interface. Mock now, llama.rn later. Same interface.
4. **Service isolation.** Each domain (security, maps, sensors, content, AI) has its own service directory.
5. **Path alias.** `@/` resolves to `src/` via tsconfig. Always import from `@/components/ui/...`, never `components/ui/...`.
6. **Keyboard handling.** `Screen` and `OnboardingFrame` wrap content in a fallback `KeyboardAvoidingView` and, when the native `react-native-keyboard-controller` is registered, upgrade to `ArkKeyboardAwareScrollView` from `src/components/layout/keyboard-controller.tsx`.

## Anti-Patterns & Known Issues

1. **Native verification remains the main risk:** SQLCipher, MapLibre offline packs, ArkZim, ArkOcr, and llama.rn all need real-device verification in development builds.
2. **iOS ZIM support is still missing:** Android ArkZim compiles; iOS still needs CoreKiwix.xcframework integration.
3. **Password KDF is improved but not production-grade:** v3 SHA-512 stretching replaced the old weak verifier path, but a native libsodium Argon2id module is still required.
4. **RAG embeddings need device validation:** ExecuTorch (`react-native-executorch`) text-embedding contexts for the `executorch-multi-qa-minilm-l6-cos-v1` (default) and `executorch-multi-qa-mpnet-base-dot-v1` models are wired with an `ark-hash-v2` fallback, but real-device quality, memory, and sqlite-vec KNN behavior still need verification.
5. **Mounted UI tests are still absent:** current coverage is route/static/service-level, not React Native render tests. E2E onboarding coverage is intentionally deprioritized for now.
6. **Big screens:** `app/(tabs)/map.tsx`, `app/(tabs)/chat/[threadId].tsx`, and `src/services/ai/rag.service.ts` are each over 1k lines and should be split before further feature work. `app/(tabs)/settings.tsx` was extracted to 679 lines via `src/components/settings/`.

## Build / Run Commands

```sh
bun install          # Install dependencies
bun run dev          # Start Expo dev server (clears cache)
bun run ios          # Start for iOS
bun run android      # Start for Android
bun run web          # Start for web
bun run check        # typecheck + lint + tests
```

TypeScript check: `npx tsc --noEmit`

## Dev Group Delivery

When asked to build and send to the dev group:

1. Run `bun run android:build:prod`.
2. Use APK `android/app/build/outputs/apk/release/app-release.apk`.
3. If Beeper is unauthenticated, run `beeper setup --yes`.
4. Send to `beeper://select-thread/whatsapp/!Hf5OYEW7nA8jd9xaPncq:beeper.local` with:
   `beeper send file --to '!Hf5OYEW7nA8jd9xaPncq:beeper.local' --file android/app/build/outputs/apk/release/app-release.apk --mime application/vnd.android.package-archive --caption '<short build note + SHA-256>' --wait --wait-timeout 120000 --timeout 5m --json --yes`
