# AGENTS.md — Ark

> Source of truth for any agent working on this codebase. Read this first.

## Identity

**Ark** = "Noé's Ark for the offline age." An offline-first survival computer for mobile. The app should remain useful with zero internet after initial downloads: offline maps, downloadable knowledge packs (Wikipedia/ZIM, survival guides, RSS cache), secure encrypted notes/documents, on-device AI/RAG, and practical sensor tools (compass, barometer, level, pedometer, light meter).

**Target:** iOS + Android via Expo/React Native. Current path is Expo Go MVP. Native-heavy features (MapLibre, llama.rn, SQLCipher) require a development build.

**Tone:** Serious, calm, survival-grade utility. Not playful camping app. "Offline command center."

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Expo SDK 55 + React Native 0.83 | Expo Go for MVP; dev builds for native features |
| Routing | Expo Router (file-based) | `app/` directory |
| Styling | Tailwind CSS v4 + Uniwind v1.6 | `global.css` defines OLED/dark/light themes |
| UI primitives | shadcn-style (CVA + RN Primitives) | `src/components/ui/` — Button, Text, Input, Card, Icon |
| State | Zustand v5 | 5 stores in `src/stores/` |
| Database | expo-sqlite + custom migrations | `PRAGMA user_version` pattern, FTS5 virtual tables |
| Icons | lucide-react-native | Wrapped via `src/components/ui/icon.tsx` |
| Date handling | date-fns v4 | |
| Validation | zod v4 | Installed but barely used |
| Keyboard | react-native-keyboard-controller | Installed but UNUSED — we use built-in KeyboardAvoidingView |
| Package manager | bun | Lockfile is `bun.lock` |

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

20 tables, 2 FTS5 virtual tables, V1 migration via `PRAGMA user_version`.

**Key tables actually used by screens:**
- `app_settings` — key-value config (theme preference, etc.)
- `onboarding_state` — single row wizard progress
- `vault_state` — password verifier, KDF salt, hint, auto-lock settings
- `notes` + `notes_fts` — secure notes with FTS search, soft delete
- `chat_threads` + `chat_messages` — AI conversation history
- `rag_sources` + `rag_chunks` + `rag_chunks_fts` — RAG indexing

**Tables in schema but unused by any screen/service:**
- `documents` — personal document metadata (no UI to import/view)
- `map_markers` — saved map markers (no map rendering yet)
- `routes` — saved GPS routes (no map rendering yet)
- `rss_feeds` + `rss_items` — RSS infrastructure exists but feed fetching is deferred

**Encryption:** SQLCipher is configured in `app.json` but NOT active at runtime (`SQLCIPHER_ACTIVE = false` in `schema.ts`). No DB encryption in current build.

## What's Real vs What's Mock/Stub/Placeholder

### REAL (works now):
- OLED/Dark/Light/System theme switching, persisted to SQLite
- SQLite database with full migrations, all 20 tables, FTS5 search
- Repository layer — all CRUD is against real SQLite
- Secure notes: create, FTS search, favorite, soft-delete (gated by vault unlock)
- Onboarding wizard: 5-step flow with state persistence
- Vault service: password verifier (SHA-256, 750 iter), biometric unlock via LocalAuthentication
- Mock AI chat: messages stored to DB, mock responses with RAG citations
- RAG: FTS indexing of notes + mock "Ark starter guide"
- Pressure trend: rising/stable/falling from barometer snapshot history
- Network monitoring: NetInfo wrapper
- App filesystem directories: created at boot
- Content pack manifest: 8 starter packs with metadata
- Sensor tools: compass, barometer, level, pedometer, light meter (real Expo Sensors)

### MOCK / STUB / PLACEHOLDER:
| Feature | Status | What's missing |
|---------|--------|---------------|
| Map rendering | STUB | `@maplibre/maplibre-react-native` not installed. MapService returns `available: false`. Map screen shows "not available" message. |
| Offline map downloading | STUB | OfflineMapService.refreshRegion() returns `ok: false`. Region CRUD works on DB only, no actual tile download. |
| Local LLM inference | MOCK | MockAIAdapter returns hardcoded text. LlamaAdapter.isAvailable() returns false. |
| Model download manager | STUB | ModelManagerService.getStatus() returns static string. No download infrastructure. |
| Content pack downloads | MOCK | DownloadManagerService immediately marks downloads "completed" without real downloading. |
| DB encryption | NOT ACTIVE | SQLCipher plugin configured but no key path activated. Vault encryption is UI-level access gating only. |
| Password KDF | WEAK | 750 iterations of SHA-256 in JS. No bcrypt/scrypt/argon2. Documented limitation. |
| Password change | PLACEHOLDER | VaultService.changePassword() returns `ok: false`. |
| Biometric toggle | PLACEHOLDER | Settings screen button is a no-op. |
| RSS feed fetching | DEFERRED | RssService says "deferred until URLs are configured." |
| ZIM reader | PLACEHOLDER | ZimService returns placeholder status. |
| Document import | STUB | ImportService exists but never called from any screen. No UI to import files. |
| Weather forecasts | MOCK | Hardcoded mock Portugal forecast in weather.repo.ts. |
| Coordinates tool card | PLACEHOLDER | "Placeholder for location card once permission is granted." |
| Emergency checklist | PLACEHOLDER | "Placeholder for saved checklists and unit conversion." |
| Auto-lock service | STUB | Enforce function exists but never wired into app lifecycle. |
| Sensor store | UNUSED | `sensor-store.ts` exists with all getters/setters but no screen reads from it. |

## Theme System

Defined in `global.css`. Three themes as CSS variables:

| Token | OLED (default) | Dark | Light |
|-------|---------------|------|-------|
| `--background` | `#000000` | `#09090B` | `#FFFFFF` |
| `--foreground` | `#FAFAFA` | `#FAFAFA` | `#0A0A0A` |
| `--card` | `#0A0A0A` | `#18181B` | `#FFFFFF` |
| `--card-foreground` | `#FAFAFA` | `#FAFAFA` | `#0A0A0A` |
| `--primary` | `#F2B84B` (amber) | `#F2B84B` | `#996515` |
| `--primary-foreground` | `#0A0A0A` | `#0A0A0A` | `#FFFFFF` |
| `--muted` | `#27272A` | `#27272A` | `#F4F4F5` |
| `--muted-foreground` | `#A1A1AA` | `#A1A1AA` | `#71717A` |
| `--border` | `#27272A` | `#27272A` | `#E4E4E7` |
| `--destructive` | `#EF4444` | `#EF4444` | `#DC2626` |

Applied via `Uniwind.setTheme()` called from `theme-store.ts`.

## Key Architectural Decisions

1. **No backend server.** Everything is local. No APIs, no auth server, no cloud.
2. **Repository pattern.** Screens never write raw SQL. All DB access through `src/services/db/repositories/`.
3. **Adapter pattern for AI.** `AIService` talks to an adapter interface. Mock now, llama.rn later. Same interface.
4. **Service isolation.** Each domain (security, maps, sensors, content, AI) has its own service directory.
5. **Path alias.** `@/` resolves to `src/` via tsconfig. Always import from `@/components/ui/...`, never `components/ui/...`.
6. **Keyboard handling.** `Screen` and `OnboardingFrame` components wrap content in `KeyboardAvoidingView` (iOS: `behavior="padding"`). All screens using these get keyboard avoidance automatically.

## Anti-Patterns & Known Issues

1. **Duplicate components:** `components/ui/` at root is a dead directory. Screens import via `@/` which resolves to `src/components/ui/`. The root `components/ui/` versions have slightly different styling (h2 has border-b, different button sizes). DELETE the root `components/ui/` directory.
2. **Unused sensor store:** `src/stores/sensor-store.ts` is fully implemented but no screen reads from it. Screens use local `useState` instead. Either wire it in or delete it.
3. **Hardcoded placeholderTextColor:** `src/components/ui/input.tsx` hardcodes `#A1A1AA` as default placeholder color. This doesn't adapt to theme changes.
4. **Crowded UI:** Home screen has too many cards. Tools screen has 9 action cards, 3 of which are placeholders. Content pack filter has 8 chips.
5. **No SafeAreaView:** The app uses `contentInsetAdjustmentBehavior="automatic"` on ScrollViews but doesn't use SafeAreaView. May have notching issues on newer iPhones.
6. **Weak KDF:** 750 SHA-256 iterations is documented as a limitation but is not production-grade.
7. **No auto-lock:** The autolock service exists but is never started. No timer in the app lifecycle.
8. **No actual encryption:** SQLCipher not keyed. Notes are stored in plaintext in SQLite.

## Build / Run Commands

```sh
bun install          # Install dependencies
bun run dev          # Start Expo dev server (clears cache)
bun run ios          # Start for iOS
bun run android      # Start for Android
bun run web          # Start for web
```

TypeScript check: `npx tsc --noEmit`
