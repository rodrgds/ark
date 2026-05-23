# AGENTS.md — Ark

> Source of truth for any agent working on this codebase. Read this first.

## Identity

**Ark** = "Noé's Ark for the offline age." An offline-first survival computer for mobile. The app should remain useful with zero internet after initial downloads: offline maps, downloadable knowledge packs (Wikipedia/ZIM, survival guides, RSS cache), secure encrypted notes/documents, on-device AI/RAG, and practical sensor tools (compass, barometer, level, pedometer, light meter).

**Target:** iOS + Android via Expo/React Native. Current path is Expo Go MVP. Native-heavy features (MapLibre, llama.rn, SQLCipher) require a development build.

**Tone:** Serious, calm, survival-grade utility. Not playful camping app. "Offline command center."

## Tech Stack

| Layer           | Choice                             | Notes                                                       |
| --------------- | ---------------------------------- | ----------------------------------------------------------- |
| Framework       | Expo SDK 55 + React Native 0.83    | Expo Go for MVP; dev builds for native features             |
| Routing         | Expo Router (file-based)           | `app/` directory                                            |
| Styling         | Tailwind CSS v4 + Uniwind v1.6     | `global.css` defines OLED/dark/light themes                 |
| UI primitives   | shadcn-style (CVA + RN Primitives) | `src/components/ui/` — Button, Text, Input, Card, Icon      |
| State           | Zustand v5                         | 5 stores in `src/stores/`                                   |
| Database        | expo-sqlite + custom migrations    | `PRAGMA user_version` pattern, FTS5 virtual tables          |
| Icons           | lucide-react-native                | Wrapped via `src/components/ui/icon.tsx`                    |
| Date handling   | date-fns v4                        |                                                             |
| Validation      | zod v4                             | Installed but barely used                                   |
| Keyboard        | react-native-keyboard-controller   | Installed but UNUSED — we use built-in KeyboardAvoidingView |
| Package manager | bun                                | Lockfile is `bun.lock`                                      |

## Project Structure

```
app/                          # Expo Router file-based routes
├── _layout.tsx               # Root: boot splash → theme/nav shell
├── index.tsx                 # Redirect hub (onboarding vs tabs)
├── onboarding/
│   ├── index.tsx             # Step 1: intro cards (offline maps, packs, vault, AI)
│   ├── security.tsx          # Step 2: create vault password + biometrics
│   ├── permissions.tsx       # Step 3: location permission request
│   ├── packs.tsx             # Step 4: starter pack selection
│   └── finish.tsx            # Step 5: AI notes + "Enter Ark"
├── (tabs)/
│   ├── _layout.tsx           # Bottom tabs + LockStateBar
│   ├── index.tsx             # Home: status dashboard + action cards
│   ├── chat.tsx              # AI chat with mock adapter + RAG
│   ├── map.tsx               # Map shell (MapLibre unavailable)
│   ├── library.tsx           # Content pack browser
│   ├── notes.tsx             # Vault-gated secure notes
│   ├── tools.tsx             # Sensor tool hub (9 cards)
│   └── settings.tsx          # Theme/security/diagnostics settings
└── tools/
    ├── compass.tsx           # Magnetometer → heading + cardinal
    ├── barometer.tsx         # hPa + pressure trend
    ├── level.tsx             # Accelerometer → pitch/roll bubble
    ├── pedometer.tsx         # Step counter
    ├── light.tsx             # Light meter (lux)
    └── diagnostics.tsx       # Native capability report

src/
├── components/
│   ├── ui/                   # Button, Text, Input, Card, Icon (shadcn-style)
│   ├── layout/
│   │   ├── app-shell.tsx     # LockStateBar (vault lock indicator)
│   │   └── screen.tsx        # Screen wrapper (ScrollView + KeyboardAvoidingView)
│   ├── onboarding/
│   │   └── onboarding-frame.tsx  # Reusable onboarding layout
│   └── cards/
│       └── action-card.tsx   # Pressable card with icon + title + description
├── constants/
│   ├── app.ts                # APP_NAME, APP_SLOGAN, APP_TAGLINE, SAFETY_COPY
│   ├── packs.ts              # STARTER_PACKS (8 off-usable content packs)
│   └── theme.ts              # ThemePreference type, THEME_OPTIONS, NAV_COLORS
├── lib/
│   ├── cn.ts                 # Re-export of cn()
│   ├── errors.ts             # ArkError class
│   ├── logger.ts             # Dev-only console logger
│   ├── platform.ts           # isWeb, isNative helpers
│   ├── theme.ts              # NAV_THEME for React Navigation
│   └── utils.ts              # cn() = twMerge(clsx())
├── stores/
│   ├── app-store.ts          # Boot state: DB open, FS dirs, content seeding
│   ├── auth-store.ts         # Vault lock/unlock state
│   ├── theme-store.ts        # Theme preference + Uniwind integration
│   ├── download-store.ts     # Download list (barely used)
│   └── sensor-store.ts       # Live sensor values (UNUSED by any screen)
├── services/
│   ├── db/                   # SQLite client + migrations + 9 repositories
│   ├── security/             # Vault, biometrics, keychain, autolock
│   ├── ai/                   # AI service, mock adapter, llama placeholder, RAG, chunking
│   ├── sensors/              # Compass, barometer, level, pedometer, light, diagnostics
│   ├── maps/                 # Map service stub, offline map CRUD
│   ├── weather/              # Weather cache + pressure trend
│   ├── content/              # Content pack service, guide service, ZIM placeholder
│   ├── files/                # FileSystem, download manager, document import
│   ├── connectivity/         # NetInfo wrapper
│   └── rss/                  # RSS parser stub
└── types/
    ├── ai.ts                 # AiMessage, AiCitation, AiAdapterResponse
    ├── content.ts            # ContentPack, ContentCategory, ContentFormat
    ├── db.ts                 # OnboardingState, VaultState, Note
    ├── downloads.ts          # DownloadRow, DownloadKind, DownloadStatus
    ├── maps.ts               # MapRegion
    ├── security.ts           # VaultUnlockResult, BiometricsStatus
    └── sensors.ts            # SensorAvailability, DiagnosticReport
```

## Navigation Flow

```
Boot → index.tsx
  ├── onboarding not completed → /onboarding (5-step stack)
  │   1. intro → 2. security → 3. permissions → 4. packs → 5. finish → replace(/(tabs))
  └── onboarding completed → /(tabs) (7 bottom tabs)
       Home | Chat | Map | Library | Notes | Tools | Settings
       └── Tools → push stack screens (compass, barometer, level, pedometer, light, diagnostics)
```

**Onboarding guard:** `app/index.tsx` checks `useAppStore.onboarding.completedAt`. If `null`, redirect to `/onboarding`. If set, redirect to `/(tabs)`.

## Database Schema

24 tables, 3 FTS5 virtual tables, V1 migration via `PRAGMA user_version`.

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

**Tables now used by screens/services:**

- `map_markers` — saved spots from Coordinates/Map
- `routes` — route drafts built from saved spots
- `rss_feeds` + `rss_items` — official emergency feed refresh and cached item list

**Encryption:** SQLCipher is configured in `app.json` and the DB client applies a SecureStore-backed key when the native SQLCipher build is available. Diagnostics reports cipher availability and key state. Plaintext migration/re-key strategy and real-device proof are still launch blockers.

## What's Real vs What's Mock/Stub/Placeholder

### REAL (works now):

- OLED/Dark/Light/System theme switching, persisted to SQLite
- SQLite database with full migrations, all 20 tables, FTS5 search
- Repository layer — all CRUD is against real SQLite
- Secure notes: create, FTS search, favorite, soft-delete (gated by vault unlock)
- Onboarding wizard: 5-step flow with state persistence
- Vault service: versioned stretched SHA-512 verifier with legacy upgrade, password change, biometric unlock via LocalAuthentication, auto-lock lifecycle enforcement
- AI chat: messages stored to DB, mock fallback adapter, llama.rn adapter in dev builds when a GGUF model is installed, streaming tokens, Stop action
- RAG: hybrid FTS plus embeddings, deterministic offline `ark-hash-v2` fallback, llama.rn embedding contexts for installed Nomic/Qwen embedding packs, installed guide chunks, note indexing, imported document text, PDF page text, imported image OCR text, section/page/document citations, and lazy ZIM paragraph citations when ArkZim is available
- Pressure trend: rising/stable/falling from barometer snapshot history
- Network monitoring: NetInfo wrapper
- App filesystem directories: created at boot
- Content pack manifest: real Kiwix ZIM URLs, public survival/medical PDFs, model GGUF URLs, checksums, source labels
- Real download manager: resumable Expo file downloads, progress, pause/resume/cancel, free-space checks, MD5/SHA-256 verification, app-directory storage
- Content readers: PDF/WebView guide reader with section jumps, ZIM detail screen, OS handoff to Kiwix, Android ArkZim native reader path behind dev builds
- Document ingestion: text-file extraction, Android PDFBox text-layer extraction, capped PDF OCR fallback through ML Kit, Android on-device image OCR through `ark-ocr`, visible extraction/OCR/indexing status, page-level FTS, and document RAG cleanup on delete
- Sensor tools: compass, barometer, level, pedometer, light meter, coordinates, offline weather, readiness checklist, with live readings in the sensor store

### MOCK / STUB / PLACEHOLDER:

| Feature                 | Status  | What's missing                                                                                                                                                                                      |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map rendering           | PARTIAL | MapLibre is installed and dynamically loaded; native map rendering needs on-device dev-build verification and a production style URL.                                                               |
| Offline map downloading | PARTIAL | MapLibre `OfflineManager.createPack()` is wired when native MapLibre exists; still needs real-device validation, drawn bounds, and offline geocoder/PMTiles index.                                  |
| Local LLM inference     | PARTIAL | llama.rn is installed and dynamically loads installed GGUF models; still needs device memory tuning and runtime verification.                                                                       |
| DB encryption           | PARTIAL | SecureStore SQLCipher key path is wired; still needs fresh encrypted DB proof, plaintext migration, and final vault-passphrase/device-key decision.                                                 |
| Password KDF            | PARTIAL | v3 SHA-512 stretching is in place with legacy upgrades; still needs a custom Expo native libsodium Argon2id `ark-kdf` module before production.                                                     |
| ZIM reader              | PARTIAL | Android ArkZim module compiles with libkiwix/libzim and the UI can search/open articles when native is available; iOS CoreKiwix binding and real-archive device testing remain.                     |
| OCR/PDF indexing        | PARTIAL | Android `ark-ocr` compiles with ML Kit and PDFBox, images use on-device OCR, PDFs use text-layer extraction before OCR fallback; still needs real-device verification with scanned/searchable PDFs. |
| Component tests         | PARTIAL | Route/static/service tests are broad; mounted React Native screen tests are still missing. Detox onboarding coverage is intentionally deprioritized.                                                |

## Theme System

Defined in `global.css`. Three themes as CSS variables:

| Token                  | OLED (default)    | Dark      | Light     |
| ---------------------- | ----------------- | --------- | --------- |
| `--background`         | `#000000`         | `#09090B` | `#FFFFFF` |
| `--foreground`         | `#FAFAFA`         | `#FAFAFA` | `#0A0A0A` |
| `--card`               | `#0A0A0A`         | `#18181B` | `#FFFFFF` |
| `--card-foreground`    | `#FAFAFA`         | `#FAFAFA` | `#0A0A0A` |
| `--primary`            | `#F2B84B` (amber) | `#F2B84B` | `#996515` |
| `--primary-foreground` | `#0A0A0A`         | `#0A0A0A` | `#FFFFFF` |
| `--muted`              | `#27272A`         | `#27272A` | `#F4F4F5` |
| `--muted-foreground`   | `#A1A1AA`         | `#A1A1AA` | `#71717A` |
| `--border`             | `#27272A`         | `#27272A` | `#E4E4E7` |
| `--destructive`        | `#EF4444`         | `#EF4444` | `#DC2626` |

Applied via `Uniwind.setTheme()` called from `theme-store.ts`.

## Key Architectural Decisions

1. **No backend server.** Everything is local. No APIs, no auth server, no cloud.
2. **Repository pattern.** Screens never write raw SQL. All DB access through `src/services/db/repositories/`.
3. **Adapter pattern for AI.** `AIService` talks to an adapter interface. Mock now, llama.rn later. Same interface.
4. **Service isolation.** Each domain (security, maps, sensors, content, AI) has its own service directory.
5. **Path alias.** `@/` resolves to `src/` via tsconfig. Always import from `@/components/ui/...`, never `components/ui/...`.
6. **Keyboard handling.** `Screen` and `OnboardingFrame` components wrap content in `KeyboardAvoidingView` (iOS: `behavior="padding"`). All screens using these get keyboard avoidance automatically.

## Anti-Patterns & Known Issues

1. **Native verification remains the main risk:** SQLCipher, MapLibre offline packs, ArkZim, ArkOcr, and llama.rn all need real-device verification in development builds.
2. **iOS ZIM support is still missing:** Android ArkZim compiles; iOS still needs CoreKiwix.xcframework integration.
3. **Password KDF is improved but not production-grade:** v3 SHA-512 stretching replaced the old weak verifier path, but a native libsodium Argon2id module is still required.
4. **RAG embeddings need device validation:** Nomic/Qwen llama.rn embedding-pack support is implemented with an `ark-hash-v2` fallback, but real-device quality, memory, and sqlite-vec KNN behavior still need verification.
5. **Mounted UI tests are still absent:** current coverage is route/static/service-level, not React Native render tests. E2E onboarding coverage is intentionally deprioritized for now.

## Build / Run Commands

```sh
bun install          # Install dependencies
bun run dev          # Start Expo dev server (clears cache)
bun run ios          # Start for iOS
bun run android      # Start for Android
bun run web          # Start for web
```

TypeScript check: `npx tsc --noEmit`
