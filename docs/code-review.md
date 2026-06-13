# Ark — Comprehensive Code Review

> Generated 2026-06-03. Covers all areas: services, stores, UI, routes, native modules, types, constants, lib, hooks, tests, and build config.

---

## Executive Summary

| Dimension           | Score | Verdict                                                                                                                                                     |
| ------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**    | B+    | Well-separated concerns, good adapter/repository patterns. Some cross-cutting issues.                                                                       |
| **Code Quality**    | B     | Ranges from A (DB layer, backup) to C (native modules, lib dead code).                                                                                      |
| **Maintainability** | B-    | ~5K lines of dead/duplicate code, over-large files (rag.service 1017L, download-manager 1126L), 3 styling systems in play.                                  |
| **Test Coverage**   | B-/C+ | Service layer is 65% covered with excellent integration tests. UI layer is 0%. 31 test files / 172 tests.                                                   |
| **Security**        | B-    | Custom KDF instead of Argon2id, timing-leaky password verification, SQLCipher key via string interpolation, no rate limiting, AutoLockService is dead code. |
| **Performance**     | B     | No pagination on any list(), seedStarterPacks() on every read, sequential embedding in RAG, some O(n²) patterns.                                            |

### What to Ship vs What to Rethink

| Keep (well-done)                    | Fix before launch                      | Consider replacing                         |
| ----------------------------------- | -------------------------------------- | ------------------------------------------ |
| Service-layer integration tests     | SQL injection in encryption.service.ts | Custom Kotlin/Swift native modules         |
| Repository pattern with real SQLite | Custom SHA-512 KDF vs Argon2id         | Vercel `ai` SDK in Hermes                  |
| Backup/restore with AES-GCM         | PDFTron-style PDF text stripping       | `react-native-keyboard-controller` adapter |
| Offline map region management       | RAG HTTP regex parser for ZIM          | Inline 300-line guide HTML in source       |
| Onboarding flow + vault service     | iOS ZIM module is dead code            |                                            |

---

## 1. 🔴 Security & Cryptographic Issues

### 1.1 CRITICAL: SQLCipher key via string interpolation

**`src/services/db/encryption.service.ts:14`**

```ts
await db.execAsync(`PRAGMA key = '${key}'`);
```

While the key is hex-encoded (a-f0-9), this is a SQL injection pattern. Use `x'${key}'` hex literal syntax or parameterized PRAGMA. Test at `service-integration.test.ts:624` demonstrates the attack surface.

### 1.2 CRITICAL: Custom KDF instead of standard

**`src/services/security/keychain.service.ts:27-41`**
Homebrew iterative SHA-512 (12,000 rounds) — not PBKDF2, not HMAC-based, no memory hardness. AGENTS.md acknowledges "a native libsodium Argon2id module is still required." This has not been cryptanalyzed.

### 1.3 HIGH: Timing-attack-vulnerable password comparison

**`src/services/security/keychain.service.ts:49`**

```ts
actual === expectedVerifier;
```

JavaScript string equality short-circuits on first mismatch. Should use `crypto.timingSafeEqual` or constant-time comparison.

### 1.4 HIGH: AutoLockService is entirely dead code

**`src/services/security/autolock.service.ts`**
`touch()` and `enforce()` are never called anywhere. There is no timer, AppState listener, or foreground handler. The `autoLockMinutes` field persists to SQLite but has zero runtime effect. The feature described in AGENTS.md is non-functional.

### 1.5 HIGH: auth-store.unlock() bypasses vault service

**`src/stores/auth-store.ts:18`**

```ts
unlock: () => set({ unlocked: true }),
```

Any component can call `useAuthStore.getState().unlock()` to bypass authentication entirely. Vault service does call this after real verification, but nothing prevents rogue callers.

### 1.6 MEDIUM: Password change reuses salt

**`src/services/security/vault.service.ts:105`**
`derivePasswordVerifier(nextPassword, vault.kdfSalt)` reuses the original salt. Standard practice generates a fresh salt on every password change.

### 1.7 MEDIUM: No rate limiting or lockout

There is no failed-attempt tracking, exponential backoff, or account lockout anywhere in the vault service.

### 1.8 MEDIUM: Verifier stored without device-only accessibility

**`src/services/security/keychain.service.ts:67-69`**
`SecureStore.setItemAsync(PASSWORD_VERIFIER_KEY, verifier)` — no `keychainAccessible` option, defaults to `WHEN_UNLOCKED` (accessible by accessories, watch unlock). Should be `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

---

## 2. 🔴 Database Layer

### 2.1 CRITICAL: seedStarterPacks() called on every list()

**`src/services/db/repositories/content.repo.ts:143`**
Every `list()` call runs ~90 SQL operations (DELETE + INSERT OR IGNORE + UPDATE). This should be one-time boot initialization.

### 2.2 HIGH: Massive duplication

- **`now()` helper defined in 5+ files** — extract to `db/helpers.ts`
- **15+ identical row-mapping functions** (snake_case → camelCase) — generic `camelCaseKeys()` would eliminate ~200 lines
- **25+ `PRAGMA table_info` + `ALTER TABLE` blocks in migrations** — extract `ensureColumn()` helper
- **Tables re-created in v9 migration** (lines 497-571) that were already created in v1 — dead code

### 2.3 HIGH: Side effects in repositories

Repositories call `HapticsService.success()`, `RagCleanupService.removeSource()`, etc. (notes.repo.ts, documents.repo.ts, rss.repo.ts). Repositories should be pure data access layers.

### 2.4 MEDIUM: No pagination on any list() method

`notes.repo.ts:109`, `documents.repo.ts:48`, `downloads.repo.ts:46`, `maps.repo.ts:115,297,396` — all return unbounded result sets.

### 2.5 MEDIUM: No error wrapping

Every repository method lets raw SQLite errors propagate. No `ArkError` wrapping.

### 2.6 MEDIUM: Missing indexes

- `rss_items.feed_id` has no index
- `weather_cache.fetched_at` has no index

---

## 3. 🟠 AI Service Layer

### 3.1 HIGH: No formal adapter interface

**`src/services/ai/`**
`MockAIAdapter` and `LlamaAdapter` are structurally typed but don't `implements` a shared interface. New adapters can silently diverge from the contract.

### 3.2 HIGH: Module-level mutable state — race conditions

**`src/services/ai/ai.service.ts:26`** — `activeRequest` is module-level; fast double-tap makes first request uncancellable. **`llama-adapter.ts:13-17`** — five module-level variables shared across instances.

### 3.3 HIGH: cancelActiveResponse can target wrong adapter

**`src/services/ai/ai.service.ts:309-312`** — Always calls `llamaAdapter.cancelActiveCompletion()` even when mock adapter is active.

### 3.4 HIGH: rag.service.ts — 1017 lines, zero tests

The most complex and bug-prone file in the AI layer has zero dedicated tests. Contains regex-based HTML parsing for ZIM articles (lines 781-803) that will break on non-trivial HTML.

### 3.5 MEDIUM: getThread does full table scan

**`src/services/ai/ai.service.ts:83`** — Loads all threads then `.find()` in JS instead of `SELECT ... WHERE id = ?`.

### 3.6 MEDIUM: RAG replaceSource serializes embedding calls

**`src/services/ai/rag.service.ts:89-96`** — 20 sequential embedding model invocations. Should be `Promise.all`.

---

## 4. 🟠 Sensor Services

### 4.1 BUG: compass cardinal() returns wrong results

**`src/services/sensors/compass.service.ts:45-48`**

```ts
const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
return points[Math.round(heading / 45) % 8];
```

Sector boundaries are wrong. Should be `Math.floor((heading + 22.5) / 45) % 8`. However, this method is dead code — never called. The screen uses its own local `getCardinal`.

### 4.2 BUG: diagnostics hardcodes FTS as available

**`src/services/sensors/diagnostics.service.ts:53`**

```ts
ftsAvailable: true,  // always true
```

Should be runtime check via `PRAGMA compile_options`.

### 4.3 BUG: aiAdapter type/code mismatch

Type allows `'llama-unavailable'` but code never produces it (produces only `'mock'` or `'llama'`).

### 4.4 MEDIUM: Pedometer poll race with watchStepCount

**`src/services/sensors/pedometer.service.ts:40-59`**
Guard `delta !== lastEmitted` compares apples to oranges on Android where `getStepCountAsync` returns system-step counts while `watchStepCount` may return different values.

---

## 5. 🟠 Files / Download Manager

### 5.1 HIGH: Static global mutable state without sync

**`src/services/files/download-manager.service.ts:295-297`**
`activeDownloads`, `downloadPackIds`, `drainingQueue` are module-level maps. `drainQueue()` has TOCTOU race: guard and assignment are non-atomic.

### 5.2 HIGH: Fire-and-forget void promise calls

**`download-manager.service.ts:407-408, 438, 447`** — `void this.drainQueue()`, `void this.runDownload(...)` — unhandled rejections silently swallowed.

### 5.3 MEDIUM: HTML snapshot sequential asset download

**`download-manager.service.ts:693-725`** — Images downloaded one-by-one. Should use `Promise.all` with concurrency limit.

### 5.4 MEDIUM: No duplicate document detection on import

**`src/services/files/import.service.ts:37-71`** — Same file imported twice creates two copies. No SHA-256 dedup.

### 5.5 MEDIUM: SHA-256 sidecar fetched at queue time, not download time

**`download-manager.service.ts:353-356`** — If URL unreachable at queue time, verification is skipped even if URL becomes reachable later.

### 5.6 MEDIUM: User-Agent hardcoded to Android

**`download-manager.service.ts:39-41`** — iOS devices misidentified as Android.

---

## 6. 🟠 Native Modules

### 6.1 CRITICAL: ark-ocr Android — content:// URI not supported for PDF

**`modules/ark-ocr/android/src/main/java/expo/modules/arkocr/ArkOcrModule.kt:205-211`**
`fileFromUri()` only handles `file://` paths. PDF extraction from file picker (which returns `content://` URIs) silently fails.

### 6.2 CRITICAL: ark-zim — resolveRedirect doesn't loop

**`modules/ark-zim/android/src/main/java/expo/modules/arkzim/ArkZimModule.kt:206-208`**
Returns redirect entry directly without checking if that entry is itself a redirect. Causes `ClassCastException` on chained redirects.

### 6.3 CRITICAL: ark-speech — destroy() inside onError callback

**`modules/ark-speech/android/src/main/java/expo/modules/arkspeech/ArkSpeechModule.kt:139`**
`recognizer?.destroy()` called inside SpeechRecognizer's `onError` callback — undefined behavior on some Android versions.

### 6.4 HIGH: ark-speech — dual requireNativeModule

**`modules/ark-speech/src/index.ts:23-24`**

```ts
export const { isAvailable, recognizeOnce, stop, cancel } =
  requireNativeModule<ArkSpeechModule>('ArkSpeech');
```

`requireNativeModule` called twice — named exports operate on a different module instance than the default export. Stateful instance variables are separate.

### 6.5 HIGH: ark-zim iOS is dead code

Entire iOS module throws `E_NOT_IMPLEMENTED`. Podspec claims ZIM reading but has no libzim dependency.

### 6.6 HIGH: All modules use deprecated Promise callback API

All three modules use the legacy `AsyncFunction { ..., promise: Promise -> }` pattern deprecated in Expo SDK 51 and removed in SDK 52. Must migrate to return-value pattern before upgrading.

### 6.7 MEDIUM: ark-ocr iOS — missing image orientation

**`modules/ark-ocr/ios/ArkOcrModule.swift:178`**
`VNImageRequestHandler(cgImage: cgImage, options: [:])` ignores EXIF orientation. Portrait images produce garbled text.

---

## 7. 🟡 Stores (Zustand)

### 7.1 HIGH: AGENTS.md is wrong about sensor-store

AGENTS.md claims sensor-store is "UNUSED by any screen" — false. Used by compass, light, level, pedometer, barometer, and map screens.

### 7.2 MEDIUM: sensor-store values duplicated in component-local useState

Every screen that writes to the store ALSO keeps local React state for the same values. Store acts as cross-screen publish channel but local state is display source of truth — potential stale data.

### 7.3 MEDIUM: app-store magic boot progress values

**`src/stores/app-store.ts:34-47`** — `0.08`, `0.26`, `0.42`, etc. with no semantic meaning. Extract to named constants.

### 7.4 MEDIUM: theme-store.getEffective() is dead

**`src/stores/theme-store.ts:14-16`** — Always returns input. No system-theme detection. Either implement or remove.

### 7.5 LOW: app-store cross-store coupling

**`src/stores/app-store.ts:49`** — Calls `useThemeStore.getState().init()` directly, creating hidden dependency.

---

## 8. 🟡 UI Components

### 8.1 HIGH: Dynamic Tailwind classes unsafe with Uniwind

**`src/components/layout/app-shell.tsx:21-22, 93`**

```tsx
const networkStatusClass =
  isOnline === null ? 'bg-muted-foreground' : isOnline ? 'bg-green-500' : 'bg-red-500';
```

Template-string Tailwind classes invisible to compiler — may not be generated in production.

### 8.2 HIGH: input.tsx has stale theme subscription

**`src/components/ui/input.tsx:7-14`** — Calls `useThemeStore.getState()` directly instead of using the hook. Placeholder color doesn't update on theme change.

### 8.3 MEDIUM: Duplicate press animation logic

**`button.tsx:90-114`** and **`action-card.tsx:42-66`** — Nearly identical `useSharedValue` + `withTiming` animation. Extract to shared hook.

### 8.4 MEDIUM: Legacy Animated API in app-shell

**`src/components/layout/app-shell.tsx:20, 45-58`** — Uses `Animated.Value` and `Animated.timing` while rest of codebase uses Reanimated.

### 8.5 MEDIUM: Aggressive focus retry in function-search

**`src/components/layout/function-search.tsx:219-226`** — Polls focus with 4 retry timers (0ms, 80ms, 180ms, 320ms). Root focus issue should be fixed instead.

### 8.6 MEDIUM: keyboard-controller.tsx overly complex

**`src/components/layout/keyboard-controller.tsx`** — 162-line adapter for optional native module. `ArkKeyboardStickyView` silently becomes plain `View` on fallback.

### 8.7 LOW: NotesList has dead prop

**`src/components/notes/notes-list.tsx:25`** — `labelColors: _labelColors` (underscore-prefixed, never used).

### 8.8 LOW: chat/ directory is empty

**`src/components/chat/`** — Directory exists with zero files.

---

## 9. 🟡 App Screens / Routes

### 9.1 HIGH: Dimensions.get('window') doesn't update on orientation

Multiple tool screens (compass, light) use `Dimensions.get('window')` at module level — value is stale after orientation change. Should use `useWindowDimensions()` hook.

### 9.2 HIGH: chat/[threadId].tsx — duplicate keyboard listeners

Two separate `Keyboard.addListener('keyboardWillShow')` subscriptions in the same screen.

### 9.3 HIGH: Over-sized screens

- `chat/[threadId].tsx` — ~500+ lines, should be split into components
- `(tabs)/map.tsx` — ~1800+ lines, largest file in the project
- `settings.tsx` — ~400+ lines

### 9.4 MEDIUM: Promise.all error handling in settings

**`app/(tabs)/settings.tsx`** — `Promise.all` used without individual error handling; single failure silences all state updates.

### 9.5 MEDIUM: `as never` casts pervasive

Multiple files use `as never` to satisfy TypeScript with Expo Router typed routes. Indicates type-gen blind spots.

---

## 10. 🟡 Types & Constants

### 10.1 HIGH: Hardcoded date in Kiwix ZIM URLs

**`src/constants/packs.ts:71, 87, 104, 122, 138`**
URLs like `...wikipedia_en_simple_all_nopic_2026-05.zim` embed a specific YYYY-MM release. These will 404 when superseded. Inconsistent: one uses `2026-04` while others use `2026-05`.

### 10.2 MEDIUM: note-themes.ts is 383 lines of raw hex

Should be a JSON file; 198 hex color values inlined in TypeScript with no easy auditability.

### 10.3 MEDIUM: Duplicate type concepts

- `SavedMapPin` vs `MapMarker` — nearly identical but different field shapes
- `DownloadedMapRegion` likely dead code (not imported anywhere)
- `ArkBackupNote` manually duplicates `Note`

### 10.4 MEDIUM: NAV_COLORS duplicates global.css but with different values

**`src/constants/theme.ts:23-51`** — Uses sage green (`#95A78B`) as primary while global.css theme tokens use amber (`#F2B84B`). May be intentional (nav chrome vs content) but undocumented.

---

## 11. 🟡 Build Config

### 11.1 HIGH: CSS color system is broken

**`global.css`**

- Primary color scale is identical to background scale (gray ramp, not amber)
- Semantic `--color-primary` references `--color-secondary-600` instead of primary palette
- AGENTS.md says OLED background `#000000`, CSS sets `#0d0d0d`
- AGENTS.md says primary is `#F2B84B` (amber) — no amber in any palette
- Three theme variants all nested under `:root` — if two match simultaneously, last in source order wins

### 11.2 HIGH: tsconfig paths has dangerous "\*" fallback

**`tsconfig.json:7`**

```json
"@/*": ["src/*", "*"]
```

The `"*"` fallback silently resolves unmapped imports to top-level files/directories, masking module-not-found errors.

### 11.3 HIGH: ESLint config is too minimal

**`eslint.config.js`** — No `@typescript-eslint` type-checked rules, no `react-hooks/exhaustive-deps`, no `react-native` rules, no `no-unused-vars`.

### 11.4 MEDIUM: app.json assetBundlePatterns bundles everything

**`app.json:15`** — `"assetBundlePatterns": ["**/*"]` includes node_modules and other non-asset files.

### 11.5 MEDIUM: polyfills.ts uses private RN API

**`polyfills.ts`** — Imports `react-native/Libraries/Utilities/PolyfillFunctions` which is a private internal API that can break on any RN upgrade.

### 11.6 MEDIUM: polyfills fire without being awaited

`setupPolyfills()` is async but called with `void` — race condition if code runs before polyfills are installed.

### 11.7 MEDIUM: DOMException shim breaks instanceof

**`polyfills.ts`** — `Error as unknown as typeof DOMException` means `instanceof DOMException` never matches.

---

## 12. 🟡 Dead Code Audit

| File                                            | Lines | What's Dead                                                                   |
| ----------------------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `src/lib/cn.ts`                                 | 2     | Entire file — re-exports `cn` from utils.ts but has zero consumers            |
| `src/lib/errors.ts`                             | 13    | `ArkError` class + `getErrorMessage` — zero imports across codebase           |
| `src/lib/logger.ts`                             | 7     | `logger` object — zero calls anywhere                                         |
| `src/lib/platform.ts`                           | 5     | `isWeb`, `isNative`, `platformName` — zero imports                            |
| `src/services/security/autolock.service.ts`     | ~40   | Entire file — `touch()` and `enforce()` never called                          |
| `src/services/sensors/compass.service.ts:45-48` | 4     | `cardinal()` method — never called                                            |
| `src/components/chat/`                          | —     | Empty directory                                                               |
| `modules/ark-zim/ios/`                          | —     | All Swift files throw `E_NOT_IMPLEMENTED`                                     |
| `src/lib/label-colors.ts:3-6,8`                 | ~4    | `LabelColorOption` type + `LABEL_DEFAULT_COLOR` — exported but never imported |
| `src/components/readers/native-pdf.tsx`         | ~30   | `getNativePdf()` — never imported anywhere                                    |

**~150 lines of pure dead code, plus an empty directory, plus an entire non-functional iOS module.**

---

## 13. 🟠 Duplication Audit

| What's Duplicated              | Where                                                                                          | Recommendation                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `now()` timestamp              | 5+ repo files                                                                                  | Extract to `db/helpers.ts`           |
| Row mapping (snake→camel)      | 10 files, ~200 lines                                                                           | Generic `camelCaseKeys()`            |
| `ensureColumn()` pattern       | 25+ migration blocks, ~150 lines                                                               | Shared helper                        |
| `isAvailable()` + catch(false) | 5 sensor services                                                                              | Shared `checkSensorAvailability()`   |
| Haversine distance             | `offline-map.service.ts:747-756` + `map-region-utils.ts:198-210`                               | Extract to `src/lib/geo.ts`          |
| `withTimeout()`                | `map-location.service.ts:115-127`, `zim.service.ts:247-263`, `download-manager.service.ts:280` | Extract to `src/lib/async.ts`        |
| Press animation                | `button.tsx` + `action-card.tsx`                                                               | Shared `useScalePressAnimation` hook |
| Base64/bytes conversion        | `backup.service.ts` + `zim-header.ts`                                                          | Extract to `src/lib/encoding.ts`     |
| nav-chrome colors              | `constants/theme.ts` vs `global.css`                                                           | Single source of truth               |

---

## 14. 🟠 Test Coverage Assessment

### The Good

- **`service-integration.test.ts`** — 2,029 lines, 49 tests. Real SQLite with 20+ mocked Expo modules. Exceptional quality.
- **`repositories.test.ts`** — 813 lines, 14 tests. Thorough CRUD + migration testing.
- **`backup.service.test.ts`** — 398 lines, 2 tests. Real AES-GCM + scrypt encryption tests.
- **Edge case coverage** — MD5 mismatch, HTTP 403, low disk, GPS timeout, SQL injection attempt, etc.

### The Bad

- **Zero component/UI tests** — No `@testing-library/react-native` usage anywhere.
- **Zero store tests** — `app-store`, `auth-store`, `theme-store`, `sensor-store` all untested.
- **8 contract tests** (25% of test files) are brittle static-analysis string-matching.
- **No E2E tests** — Detox deprioritized.
- **RAG embedding only 2 tests** — under-tested for a deterministic fallback.

### Untested Critical Files

| File                          | Lines | Risk                                  |
| ----------------------------- | ----- | ------------------------------------- |
| `rag.service.ts`              | 1,017 | **Zero tests** — most complex AI file |
| `ai.service.ts`               | 397   | Zero tests — orchestration layer      |
| `download-manager.service.ts` | 1,126 | Zero unit tests (integration only)    |
| `vault.service.ts`            | ~120  | Zero unit tests                       |
| `keychain.service.ts`         | ~87   | Zero unit tests                       |
| `biometrics.service.ts`       | ~20   | Zero unit tests                       |
| `embedding.service.ts`        | 149   | Zero tests                            |
| `llama-adapter.ts`            | 281   | Zero tests                            |
| `model-manager.service.ts`    | 327   | Zero tests                            |
| `content-pack.service.ts`     | ~280  | Zero isolated tests                   |

### Test Stats

| Metric            | Value                           |
| ----------------- | ------------------------------- |
| Total test files  | 31                              |
| Total test cases  | 172                             |
| Describe blocks   | 32                              |
| Total lines       | ~5,025                          |
| Coverage estimate | ~65% service layer, 0% UI layer |

---

## 15. Recommendations by Priority

### 🔴 Do Before Launch

1. **Fix SQLCipher key injection** — Use `x'${key}'` hex literal in `encryption.service.ts:14`
2. **Fix AutoLockService** — Wire `touch()` into user interaction handlers, add timer + AppState listener
3. **Protect auth-store.unlock()** — Remove public `unlock` or gate it behind vault service call
4. **Fix ark-ocr content:// URI** — Handle Android content URIs in PDF extraction
5. **Fix ark-zim resolveRedirect** — Loop until non-redirect entry
6. **Fix ark-speech dual requireNativeModule** — Single module instance
7. **Fix global.css color system** — Restore amber primary, fix background values, unify with AGENTS.md
8. **Move seedStarterPacks() out of list()** — Call once at boot
9. **Fix Kiwix ZIM URLs** — Use redirector or discoverable URLs instead of hardcoded date
10. **Replace timing-leaky password comparison** — Use constant-time comparison

### 🟠 Do Before v1.0

11. **Add pagination to all list() methods** — Notes, documents, downloads, maps
12. **Remove side effects from repositories** — Move haptics/RAG cleanup to service layer
13. **Fix rag.service.ts regex HTML parsing** — Use proper HTML parser or DOM API
14. **Add missing DB indexes** — `rss_items(feed_id)`, `weather_cache(fetched_at)`
15. **Extract duplicated helpers** — `now()`, `camelCaseKeys()`, `ensureColumn()`, haversine, `withTimeout()`
16. **Fix compass cardinal() or remove dead code** — It's never called
17. **Fix diagnostics FTS/aiAdapter reporting** — Runtime checks, not hardcoded
18. **Add component tests for critical screens** — Vault unlock, onboarding, notes, chat
19. **Fix tsconfig "\*" fallback** — Remove dangerous catch-all path
20. **Fix ESLint config** — Add hooks, TS, and RN-specific rules
21. **Remove dead code** — cn.ts, errors.ts, logger.ts, platform.ts, empty chat/ directory

### 🟡 Do Before SDK 56 Upgrade

22. **Migrate native modules to return-value pattern** — Expo SDK 52+ drops legacy Promise API
23. **Move inline guide HTML to separate files** — `authored-guides.ts`, `guide.service.ts` data
24. **Move note-themes.ts color data to JSON** — 198 hex values as data, not code
25. **Fix polyfills.ts private RN API** — Remove `PolyfillFunctions` import, use `globalThis` assignments
26. **Fix polyfill race condition** — Await `setupPolyfills()` before other initialization
27. **Fix DOMException shim** — Use proper constructor-compatible shim
28. **Fix app.json assetBundlePatterns** — Narrow to `assets/**/*`
29. **Reduce react-native-keyboard-controller\*** — Remove or simplify the 162-line adapter
30. **Add arkit keychain pinning for SecureStore** — `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for vault verifier

### 🟢 Nice-to-Have

31. **Add Zustand devtools middleware** — For development debugging
32. **Single source of truth for nav colors** — Align `constants/theme.ts` with `global.css`
33. **Remove unused deps** — `punycode`, `tailwindcss-animate`, `@react-navigation/native`, `@react-native-community/cli`
34. **Investigate `ai` SDK replacement** — Vercel AI SDK is web-first, risky in Hermes
35. **Add husky/lint-staged** — Pre-commit hooks for typecheck + lint
36. **Add .prettierignore** — Exclude generated directories
37. **Rename or document map-presets.ts** — Currently only exports types despite "presets" name
38. **Add Sentry/crash reporting** — Offline-first doesn't mean no crash visibility
39. **Freeze Kiwix pack URLs** — Set up redirector for content pack URLs
40. **Add EAS update channels** — Required for `expo-updates` to work correctly

---

## Appendix: File Size Hotspots

| File                                                | Lines  | Issue                                |
| --------------------------------------------------- | ------ | ------------------------------------ |
| `app/(tabs)/map.tsx`                                | ~1,800 | Largest screen — needs decomposition |
| `src/services/ai/rag.service.ts`                    | 1,017  | Zero tests, regex HTML parsing       |
| `src/services/files/download-manager.service.ts`    | 1,126  | Race conditions, fire-and-forget     |
| `src/services/db/repositories/migrations.ts`        | ~700   | Duplicated column checks             |
| `src/services/db/repositories/repositories.test.ts` | 813    | Good — keep                          |
| `src/services/service-integration.test.ts`          | 2,029  | Good — keep                          |
| `src/constants/packs.ts`                            | 385    | Borderline — could split by category |
| `src/constants/note-themes.ts`                      | 383    | Should be JSON                       |
| `src/components/notes/rich-note-editor.tsx`         | 401    | Extract Toolbar component            |
| `src/components/layout/keyboard-controller.tsx`     | 162    | Overly complex adapter               |
| `src/services/backup/backup.service.ts`             | ~720   | Well-structured for size             |

---

_Generated by comprehensive multi-agent code review. Each finding verified against actual source code._
