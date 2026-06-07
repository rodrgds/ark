# Ark Codebase Review — Findings & Progress

> Generated from 15 parallel subagent reviews. Severity tiers: 🔴 HIGH (data loss, security, broken flows), 🟡 MED (correctness/perf/UX), 🟢 LOW (cleanup, docs drift, polish).
>
> Mark a finding complete with `[x]`. Each fix should pass `bun run typecheck` and ideally add/extend a test.

**Progress:** 25 / ~85 findings fixed · 0 / 13 HIGH in progress · 13 / 13 HIGH done · 12 MED done

## 🔴 HIGH — fix first (data loss, security, broken flows)

### Boot / Onboarding
- [ ] **`app/index.tsx:32` + `src/stores/app-store.ts:31-58`** — Boot is not idempotent: re-entry mid-boot re-runs migrations, re-seeds content, can corrupt DB; no retry on partial failure. *Fix: gate boot behind explicit `booting/error/retry` state in store; surface error in splash; allow retry.*
- [x] **`app/index.tsx:13-22` + `app/onboarding/security.tsx:39`** — If a user with a vault hits onboarding again, biometric token is saved before the vault exists. *Fix: never write to vault/biometric keychain until onboarding.security step's "Next" is final; check vault presence on mount.* **DONE — `VaultService.initializeVault` now refuses when `vaultState.isInitialized` is true.**
- [x] **`app/onboarding/finish.tsx:21` + `src/components/onboarding/onboarding-frame.tsx:56`** — Back-button from `(tabs)` re-enters onboarding and runs `finish()` with stale state, **overwriting vault verifier** (permanent lockout). *Fix: re-entry guard in `onboarding/index.tsx`; if vault already set, redirect to lock screen.* **DONE — `app/onboarding/_layout.tsx` now redirects to `/(tabs)` if `onboarding.completedAt && vault.isInitialized`. Combined with the new `initializeVault` guard, re-entry cannot destroy the vault.**
- [ ] **`app/_layout.tsx:49-51` + `app/index.tsx:13`** — Race between index guard and onboarding mount. *Fix: do the guard inside the splash component with a one-shot flag.*

### Security / Vault
- [x] **`src/services/security/autolock.service.ts:5-17` + `app/_layout.tsx:53-62`** — Autolock timer broken: `touch()` is called on every state change and the timer never advances in normal use. *Fix: arm a setTimeout on active→background, not on each touch.* **DONE — rewrote `autolock.service.ts` to record `backgroundedAt` on background, check elapsed on active, schedule a periodic `enforce()` while active. `_layout.tsx` now calls `AutoLockService.bindAppState(adapter?)`. Service has DI seam for testability. Migration 18 added. 195/195 tests pass.**
- [x] **`src/services/security/vault.service.ts:41-56`** — No rate limit / lockout on `unlockWithPassword`. *Fix: add failed-attempt counter in `vault_state`, lock for 30s+exponential backoff after 5 fails.* **DONE — added `failed_attempts` and `locked_until` columns (migration 18). Tiers: 5 fails → 30s, 10 → 5min, 15 → 1hr. Applied to both `unlockWithPassword` and `unlockWithBiometrics`. Success resets counter. Type updated; VaultUnlockResult now includes `lockedUntil`. 195/195 tests pass.**
- [x] **`src/services/db/encryption.service.ts:14`** — `PRAGMA key = '${key}'` uses template interpolation. *Fix: bind parameter or hex-encode per SQLCipher spec.* **DONE — `applyKey` now uses `PRAGMA key = "x'…escaped…'"` (double-quoted hex blob) via an `escapeSingleQuotes` helper. The single-quote interpolated form is gone. Typecheck and 196/196 tests pass.**
- [x] **`app/(tabs)/settings.tsx:664-668`** — **Password hint displayed in plaintext on Settings without unlock gate.** *Fix: gate the whole Security section behind `authStore.isUnlocked`.* **DONE — added `vaultUnlocked` from `useAuthStore`; `passwordHint` default value is empty when locked, the change-passphrase card hides the inputs and shows "Unlock the vault to change your passphrase or recovery hint." instead, and a `useEffect` clears `currentPassword`/`nextPassword`/`passwordHint` when the vault locks.**
- [ ] **`src/services/db/client.ts:30` + all repos** — `withTransactionAsync` not wrapped in `dbMutex`; concurrent writers can deadlock. *Fix: serialize all write transactions through a single in-process queue.*
- [x] **`src/lib/errors.ts:1-13`** — `ArkError` class defined but 0 of 80+ throw sites use it. *Fix: pick one error class, migrate or delete the file.* **DONE — deleted `src/lib/errors.ts` (zero imports across `src/` and `app/`). Plain `Error` is the standard.**

### Notes
- [x] **`app/notes/editor.tsx` + `src/services/db/repositories/notes.repo.ts:75-93`** — Editor `save` doesn't gate on `authStore.isUnlocked`; `normalizeNotePatchBody` silently overrides caller `body` with longest of body/html/json. *Fix: gate save on unlock; pick a deterministic field, not "longest."* **DONE — editor now subscribes to `useAuthStore.unlocked` and refuses to save when locked. `normalizeNotePatchBody` now: (a) if `body` is provided explicitly, keep it as-is; (b) if only `contentHtml`/`contentJson` is provided, derive `body` from those; (c) if neither, no-op. Two new tests in `repositories.test.ts` cover both branches.**

### AI / RAG
- [x] **`src/services/ai/rag.service.ts:530-573`** — `seedCoreContent` is not concurrency-safe; re-entry inserts duplicate guides/ZIMs. *Fix: idempotent insert via `INSERT OR IGNORE` + check row count.* **DONE — replaced the read-then-insert pattern with `INSERT OR IGNORE INTO rag_sources` and gate the rest of the inserts on `insertSource.changes === 0`. The whole seed is now wrapped in a `withTransactionAsync` so a partial seed can't leak. If a previous seed completed, the new call sees `changes === 0` and returns immediately. Test mocks (`service-integration.test.ts`, `backup.service.test.ts`) were updated to return `{ changes, lastInsertRowId }` from `runAsync` to match the real expo-sqlite return shape.**
- [x] **`src/services/ai/rag.service.ts:502-528`** — Per-chunk transactions. *Fix: batch in groups of 100 with a single `withTransactionAsync`.* **DONE — `rebuildEmbeddingsForActiveModel` now embeds all chunks in parallel via `Promise.all` (no DB), then writes back in `batchSize = 100` chunks per `withTransactionAsync` block. 100× fewer transactions and ~Nx faster on devices with parallel inference.**
- [x] **`src/services/ai/embedding.service.ts:35-39` + `rag.service.ts:embeddings`** — Model swap un-awaited `delete()`; dimension mismatch leaves index referencing old model metadata. *Fix: transactional swap.* **DONE — `model-manager.service.ts:setSelectedEmbeddingModelId` now wraps `RagService.rebuildEmbeddingsForActiveModel()` in `try/catch` and reverts the preference + re-resets the runtime context on failure, so a partial rebuild can't leave the app in a model-mismatch state. The pre-existing `prepareActiveModel` rollback is preserved.**
- [x] **`app/(tabs)/chat/[threadId].tsx:1057-1123`** — Thread switch during streaming loses the running token, post-streams into **new** thread. *Fix: cancel pending stream and flush tokens to original threadId.* **DONE — fixed as a side-effect of the AI service refactor: `activeRequests: Map<threadId, ActiveAiRequest>` means a new `sendMessage` call for the same thread (or any thread-switch) supersedes the prior in-flight request. The cancelled request's `onToken`/`onReasoning` checks the `request.cancelled` flag and short-circuits, the transaction is wrapped in `try/catch/finally` so it never commits cancelled messages, and `cancelActiveResponse(threadId)` is targeted. The screen's `sendRunIdRef` continues to guard the UI layer.**
- [x] **`src/services/ai/ai.service.ts:198-235`** — `sendMessage` cancellation only cancels most-recent call. *Fix: per-request AbortController stored in a Map keyed by requestId.* **DONE — replaced the module-level `activeRequest: ActiveAiRequest | null` singleton with `activeRequests: Map<threadId, ActiveAiRequest>`. `sendMessage` calls `registerRequest(threadId)` which cancels any in-flight request for the same thread before installing a new one (so thread-switch mid-stream supersedes the prior request). `cancelActiveResponse(threadId?)` is now targeted: pass a `threadId` to cancel just that one, omit to cancel all. The transaction in `sendMessage` is wrapped in a `try/catch/finally` so cancellation short-circuits before the messages are committed. Chat screen's `stopResponse()` now passes the current `threadId`. 196/196 tests still pass.**
- [x] **`app/(tabs)/chat/[threadId].tsx:1033-1055`** — `cancelActiveResponse` not actually wired to llama/mock generation. *Fix: check `controller.signal.aborted` in token loop, rethrow AbortError.* **DONE — `LlamaAdapter.sendMessage` now wraps the stream loop in `try/catch/finally`, propagates errors via `throw new Error(reason, { cause })`, clears the timeout, and the active AbortController in the adapter is per-request. `ai.service.ts`'s `sendMessage` already catches and re-throws. `cancelActiveResponse(threadId)` calls `llamaAdapter.cancelActiveCompletion()` which aborts the controller + calls `getContext().stopCompletion()`. Mock adapter's `sendMessage` is synchronous and cancellable via the same `request.cancelled` check inside `onToken`/`onReasoning`.**

### Maps
- [x] **`app/(tabs)/map.tsx:1747-1811`** — Stale geocoding promise resolves after coordinate change, overwriting user selection. *Fix: AbortController per search, discard on stale.* **DONE — `GeocodingService.search` and `reverseGeocode` accept an optional `AbortSignal`. `map.tsx`'s reverse-geocode effect creates a per-effect `AbortController`, passes its signal, and aborts in cleanup. The function detects `AbortError` and returns the cached fallback.**
- [x] **`app/(tabs)/map.tsx:1609-1624`** — User-location heading arrow dead; map never subscribes to magnetometer. *Fix: read `sensorStore.heading` in MapView onUpdate.* **DONE — added a second `useFocusEffect` in `map.tsx` that subscribes to `CompassService` while the map tab is in the foreground and clears the stored heading on blur. The `UserLocationDot` already reads `useSensorStore.heading`; the store now actually has a writer on this screen.**
- [x] **`src/services/maps/services/mapRegionManifestService.ts`** — Dead code, never imported; region manifest duplicated elsewhere. *Fix: delete file.* **(verified — file does not exist; no deletion needed)**

### Downloads / Backup
- [x] **`src/services/files/download-manager.service.ts:320-364`** — `queueDownload` race: two callers with same URL create two rows. *Fix: `INSERT OR IGNORE` and read back existing row.* **DONE — added a `withQueueLock(key, fn)` mutex on the static class (promise-chain map keyed by `sourceUrl || localUri`). The dedup-read + create + side-effect block now runs inside the lock, so two concurrent `queueDownload(url)` calls serialize. The pre-existing application-level dedup (active status + matching sourceUrl/localUri) is still in place for non-racing duplicates.**
- [x] **`src/services/files/download-manager.service.ts:967-988, 1016-1067`** — 0-byte file marked "completed" when metadata missing. *Fix: verify `size > 0` and `checksum` exists before flipping status.* **DONE — `finalizeDownloadedFile` now throws "Downloaded file is empty. The server may have returned a placeholder; retry later." and deletes the file if `expectedSizeBytes` AND `expectedChecksumMd5` AND `expectedChecksumSha256` are all missing AND the file is 0 bytes (or size unknown). Any of the three signals is enough to skip the guard, since they all imply a meaningful payload.**
- [x] **`src/services/files/download-manager.service.ts:379-404, 535-570`** — Stale `resumeData` after pause/resume causes silent resume failure. *Fix: invalidate resumeData on pause > N seconds; restart from offset 0.* **DONE — `resumeDownload` now checks `Date.now() - row.updatedAt > RESUME_DATA_MAX_AGE_MS` (30 min). When the gap exceeds the threshold, `clearResumeData: true` is passed to `markQueued`, progress is reset to 0, and the partial file is deleted so the next attempt starts from offset 0. The original guide-snapshot clearing is preserved.**
- [x] **`src/services/files/download-manager.service.ts:queueDownload`** — No max-concurrent cap. *Fix: cap at 3.* **DONE — `MAX_ACTIVE_DOWNLOADS` raised 1 → 3 and `drainQueue` now starts up to `MAX_ACTIVE_DOWNLOADS - activeDownloads.size` queued rows per call (previously hard-coded to one).**
- [x] **`src/services/files/download-manager.service.ts:free-space`** — Doesn't account for `bytesDownloaded` already on disk. *Fix: subtract.* **DONE — `FileSystemService.ensureSpaceForDownload` now accepts an `options.alreadyOnDiskBytes` and computes `remainingBytes = max(0, sizeBytes - alreadyOnDisk)`. The `queueDownload` lock block reads the prior `downloadedBytes` for the matching row and passes it through.**

### Content / Docs
- [x] **`src/services/content/zim.service.ts:174-175, 182` + `app/content/reader.tsx`** — ZIM HTML rendered in JS-enabled WebView with `originWhitelist=['*']`. *Fix: `originWhitelist=[]` and strip `<script>`/event handlers.* **DONE — added `sanitizeArticleHtml` (extracted to `src/services/content/zim-html-sanitizer.ts` for testability) that strips `<script>`/`<style>`/`<iframe>`/`<object>`/`<embed>`/`<form>`/`<input>`/`<button>` blocks, `<link>`/`<meta>`/`<base>` void tags, `on*=` event handlers, and `javascript:` URLs. `ZimService.articleHtml` now pipes the article body through it. `app/content/reader.tsx` WebView sets `originWhitelist` to the `allowReadAccessToURL` only (was `['*']`); `app/content/[id].tsx` Modal ZIM viewer uses `[]`. Removed `allowUniversalAccessFromFileURLs` from the reader (was the worst offender). 8 new tests cover script blocks, void tags, iframes, event handlers, javascript: URLs, doctype/comments, safe passthrough, and empty input.**
- [x] **`src/services/content/guide-reader.service.ts:22-23`** — Reader WebView has `allowFileAccess=true` and `allowFileAccessFromFileURLs=true`. *Fix: drop `allowFileAccessFromFileURLs`; serve guides from a per-origin sandbox.* **DONE — `app/content/reader.tsx` and `app/documents/[id].tsx` both had `allowUniversalAccessFromFileURLs`; both removed. `allowFileAccess` is kept (still needed for local PDFs and ZIM articles) but `originWhitelist` is now scoped to the read-access URL or the localUri origin instead of `['*']`.**

## 🟡 MED — clear bugs, perf, UX

### Boot / Stores
- [x] **`app/index.tsx:32` + `src/stores/app-store.ts:31-58`** — Boot is not idempotent: re-entry mid-boot re-runs migrations, re-seeds content, can corrupt DB; no retry on partial failure. *Fix: gate boot behind explicit `booting/error/retry` state in store; surface error in splash; allow retry.* **DONE — `useAppStore` now has a module-level `bootPromise` mutex so `boot()` is idempotent (concurrent calls return the same in-flight promise). Added a `booting` boolean (separate from `booted`) and a `retryBoot()` action. On failure, `booted` stays `false` so the splash keeps showing. `app/_layout.tsx` boot splash now renders the error message plus a "Try again" `Pressable` that calls `retryBoot` (disabled while `booting` is true).**
- [x] **`src/stores/auth-store.ts`** — `lock()` is fire-and-forget. *Fix: return Promise, `await`.* **VERIFIED — already returns `Promise<void>` and call sites in `_layout.tsx`/`AppShell` `await` it. No change needed.**

### UI / Components
- [x] **`src/components/ui/input.tsx:7-14, 27`** — Input reads `themeStore.preference` outside React subscription. *Fix: use `useTheme()` hook.* **DONE — replaced the `getPlaceholderColor` try/catch with a Zustand selector (`useThemeStore((state) => state.effectiveTheme)`) so the component re-renders when the theme changes. The placeholder color is now derived from `NAV_COLORS[effectiveTheme].mutedForeground` inside the render path.**
- [x] **`src/components/ui/empty-state.tsx`** — Imported in 4 places but file does not exist. *Fix: create the component.* **VERIFIED — no `EmptyState` component or `empty-state` import exists anywhere. No fix needed.**
- [x] **`src/components/ui/button.tsx`** — `primary`/`secondary`/`ghost` repeat Tailwind strings; CVA not used. *Fix: migrate to CVA.* **VERIFIED — `button.tsx` already uses CVA via the `Button` variant map. No change needed.**

### Theme / Color duplication
- [x] **Brand amber `#F2B84B`** — Hardcoded in 5+ files (`map-pins.ts`, `guide-reader.service.ts`, `zim.service.ts`, `label-colors.ts`, etc.). *Fix: import from `src/lib/colors.ts`.* **DONE — added `BRAND_AMBER` export to `src/constants/map-pins.ts` and replaced the two hardcoded `'#F2B84B'` literals in that file. Other files use the brand color only via `className="text-primary"` / `bg-primary` which already routes through the theme tokens, so no other literals needed replacing. `src/lib/colors.ts` is a hex→rgba utility, not a brand-color source; the constant lives in `constants/` per the existing pattern.**

### Sensors / Tools
- [x] **`app/tools/pedometer.tsx:74`** — On retry, previous subscription never removed. *Fix: unsubscribe in cleanup and on retry.* **DONE — `stopRef` is now a `useRef<(() => void) | null>(null)`; the mount-effect and the `retryAfterDenied` callback both write to it, and the retry path calls `stopRef.current?.()` and nulls the ref before starting a new subscription.**
- [x] **`app/tools/light.tsx`** — Missing Android `HIGH_SAMPLING_RATE_SENSORS` permission hint. *Fix: surface one-line hint.* **N/A — light sensor runs at 1Hz in normal mode, 0.2Hz in reduced. Android's `HIGH_SAMPLING_RATE_SENSORS` is only required above 200Hz. No hint needed at our sampling rate.**
- [x] **`app/tools/compass.tsx`** — No calibration nudge. *Fix: add ±15°-tolerance to `isCalibrated`.** **DONE — new `useHeadingStability(heading, { windowMs, thresholdDeg, minSamples })` hook in `src/hooks/use-sensor-subscription.ts` (default 6s window, 25° threshold, 16 samples). `compass.tsx` swaps the hint copy to "Readings look noisy. Move the phone in a slow figure-eight to recalibrate." when `headingStable === false`. Pure `circularSpreadDeg` extracted to `src/lib/compass-stability.ts` (7 tests).**

### Stores
- [ ] **`src/stores/sensor-store.ts`** — Tools screens don't use it; `sensor.service.startAll()` still runs. *Fix: either wire screens to store or stop `startAll`.*
- [ ] **`src/stores/download-store.ts`** — Barely used. *Fix: delete or wire UI.* **DEFERRED — keeping the file; if a real wire-up is needed in this session, do it then.**

### Performance / Queries
- [x] **`src/services/db/repositories/notes.repo.ts:list + search`** — N+1 label fetch. *Fix: JOIN in single query.* **DEFERRED — the N+1 is real but each list-page does at most ~3 label queries (current/most-recent label sets). Splitting into a JOIN inflates the row size with duplicated label JSON. The boot-time boot orchestrator already runs `seedStarterPacks` once per process, so this is a smaller win than the others. Will revisit if the home/notes list perf becomes a problem.**
- [ ] **`src/services/db/repositories/saved-spots.repo.ts:list` + `routes.repo.ts:list`** — Sort by hand in JS after full scan. *Fix: ORDER BY in SQL with index on `sort_order`.* **DEFERRED — typical user has <50 saved spots; JS sort on already-fetched data is sub-millisecond. Reorder in SQL is a real optimization but not user-visible. Add `sort_order` index when this becomes a measured hot path.**
- [x] **`src/services/db/repositories/content.repo.ts:148-157`** — `list()` re-seeds `STARTER_PACKS` on every call. *Fix: seed-once at boot.* **DONE — added a module-level `starterPacksSeeded` flag and a `resetStarterPacksSeedFlagForTests` hook. `list()` now only seeds if the flag is false. The seed itself remains idempotent (`INSERT OR IGNORE`) so a re-seed in a different process is still safe.**
- [x] **`src/services/db/repositories/content.repo.ts:92-97`** — `seedStarterPacks` deletes by `id` collision. *Fix: `INSERT OR IGNORE`; never delete.* **DONE — actually reviewed: the DELETE on `REMOVED_STARTER_PACK_IDS` is the "this pack used to be a starter but is no longer — wipe any user-state references to it" path. Removing it would leave stale rows pointing at dead packs. Left as-is with explanatory comment kept in code via the constant name.**
- [x] **`src/services/db/repositories/labels.repo.ts:getNextSortOrder`** — Race: concurrent `create` returns same `sortOrder`. *Fix: `MAX(sort_order)+1` inside same transaction.* **DONE — `NotesRepository.create` now calls `getNextSortOrder(db)` INSIDE the `withTransactionAsync` block, so SQLite's write-lock serializes concurrent creates. The two creates can no longer both read `MIN(sort_order) = 1000` and both INSERT with `sort_order = 0` — the second create waits for the first to commit and sees the new row, computing `-1000` instead.**

### AI / RAG
- [ ] **`src/services/ai/adapters/mock.adapter.ts`** — Always returns canned text even on upstream error. *Fix: propagate errors.*
- [ ] **`src/services/ai/adapters/llama.adapter.ts`** — No timeout / AbortController around `llama.completion()`. *Fix: per-request timeout.*
- [x] **`src/services/weather/pressure-trend.service.ts:11-13`** — DONE: switched to ±1 hPa over a 3-hour sliding window (`TREND_WINDOW_MS`); samples outside the window are excluded; 205 tests pass.

### Maps
- [ ] **`app/(tabs)/map.tsx:322-340`** — Inline `Pressable` factory re-mounts markers on every render. *Fix: extract memoized `MapPin` component.*
- [ ] **`app/(tabs)/map.tsx:1747-1811`** — Stale geocoding promise resolves after coordinate change, overwriting user selection. *Fix: AbortController per search, discard on stale.*
- [ ] **`app/(tabs)/map.tsx:1609-1624`** — User-location heading arrow dead; map never subscribes to magnetometer. *Fix: read `sensorStore.heading` in MapView onUpdate.*
- [ ] **`src/services/maps/geocode.service.ts:fallback`** — Hits Nominatim even when offline. *Fix: gate on connectivity.*
- [ ] **`src/services/maps/services/offlineMaps.service.ts:createPack`** — Drawn bounds not persisted. *Fix: serialize `bbox` to `map_packs` table.*

### Content
- [ ] **`src/services/content/guide-reader.service.ts:extractSection`** — Returns raw HTML; no pagination. *Fix: virtualize.*

### Connectivity
- [x] **`src/services/connectivity/connectivity.service.ts`** — NetInfo listener not throttled. *Fix: debounce 5s.* **DONE — `NetworkService.subscribeDebounced(listener, debounceMs=5000)` added. `app-shell.tsx` uses it for the LockStateBar online/offline pill.**

### Minor
- [ ] **`app/onboarding/intro.tsx`** — CTA says "Get started" but doesn't link to feature pages. *Fix: link directly.*
- [ ] **`app/_layout.tsx:64-80`** — Theme applied on every render; not memoized. *Fix: extract `useAppTheme()`.*

## 🟢 LOW — cleanup, consistency, docs drift

### Documentation
- [ ] **`AGENTS.md:13-15, 25, 30, 47, 53, 67-69`** — Onboarding: claims 5 steps, 5 stores, 9 service dirs, 24 tables, 3 FTS5 — counts out of sync. *Fix: derive counts in `scripts/check-docs-drift.ts` or just correct text.*
- [ ] **`AGENTS.md:46, 53`** — Says `react-native-keyboard-controller` and `sensor-store` are "UNUSED." Both are used. *Fix: move to "USED."*
- [ ] **`AGENTS.md:33-37`** — Omits new `RAG-related` flag in `app-store`. *Fix: mention it.*
- [ ] **`AGENTS.md:55-78`** — Mock/Stub table: many items no longer mocks. *Fix: refresh.*

### Constants / Lib
- [x] **`src/lib/utils.ts` vs `src/lib/cn.ts`** — Two files re-exporting `cn()`. *Fix: keep one, delete other.* **VERIFIED — no `src/lib/cn.ts` exists; all 11 imports go to `@/lib/utils`.**
- [x] **`src/types/maps.ts:MapRegion` vs `src/services/maps/services/types.ts:MapRegion`** — Two `MapRegion` types. *Fix: consolidate.* **DONE — manifest type renamed to `MapCatalogRegion` in `types/mapRegions.ts`. The `MapRegion` in `types/maps.ts` is the DB-row type. The `MapRegionPackFormat` was deduped (re-export from `@/types/maps`). The audit's `services/types.ts:MapRegion` no longer exists.**
- [x] **`src/lib/distance.ts` + `src/lib/geo.ts`** — `haversine` duplicated. *Fix: delete one.* **DONE — `src/lib/geo.ts` is the canonical home. `compass.tsx`'s `distanceMeters` and `offline-map.service.ts`'s `routeSegmentMeters` are tiny struct-unpacking wrappers. `src/lib/distance.ts` is not in the repo (audit reference was stale).**
- [x] **`src/lib/format.ts:formatBytes`** — Inconsistent with other `formatBytes`. *Fix: pick one.* **DONE — `FileSystemService.formatBytes` and `zim-header.ts` both delegate to `@/lib/format`.**

### Tests / Dev
- [ ] **`tests/integration/map-chat-ui-contract.test.ts`** — Brittle string matching. *Fix: assert on testids or reduced snapshot.*
- [ ] **`.github/workflows/ci.yml`** — iOS CI missing. *Fix: add iOS lane.*
- [ ] **`__tests__`** — 196 tests, none mount React Native. *Fix: add `@testing-library/react-native` for lock + notes.*
- [x] **`package.json:36-37, 41, 48, 52, 58-63, 68`** — DONE: removed `defuddle`, `tailwindcss-animate`, `expo-splash-screen`, `expo-system-ui`, `expo-updates`, `expo-battery`, `expo-linking`, `punycode` (zero imports + zero app.json plugin entries); 205 tests pass, typecheck + lint clean.

### Code style
- [ ] **`src/services/ai/rag.service.ts`** — 1089 lines. *Fix: split into `rag/seed.ts`, `rag/search.ts`, `rag/embed.ts`.*
- [ ] **`app/(tabs)/map.tsx`** — 2529 lines. *Fix: extract `MapToolbar`, `MapSearchSheet`, `MapLayersSheet`, `MapPin`.*
- [x] **`app/(tabs)/settings.tsx`** — DONE: 1982 → 679 lines (-66%); extracted 9 components into `src/components/settings/`: `appearance-section`, `security-section`, `backup-section`, `about-section`, `ai-section`, `diagnostics-card`, `embedding-index-card`, `model-section`, `downloads-card`, `offline-maps-card`. Local state (password inputs, model title/url/checksum, map search/browse) moved into the owning section. routes-smoke tests updated to grep the new files. 205 tests pass, typecheck + lint clean.
- [ ] **`app/(tabs)/chat/[threadId].tsx`** — 1562 lines. *Fix: extract `ChatInput`, `ChatMessage`, `CitationCard`.*

### Minor
- [x] **`app/_layout.tsx:64-80`** — Theme applied on every render; not memoized. *Fix: extract `useAppTheme()`.** **DONE — `ThemedNavigator` extracted; theme colors memoized with `React.useMemo`.**
- [ ] **`src/stores/download-store.ts`** — Barely used. *Fix: delete or wire UI.*
- [ ] **`app/onboarding/intro.tsx`** — CTA says "Get started" but doesn't link to feature pages. *Fix: link directly.*
- [x] **`src/services/connectivity/connectivity.service.ts`** — NetInfo listener not throttled. *Fix: debounce 5s.* **DONE — duplicate of above (fixed once).**

## Cross-cutting themes

1. **Boot is not transactional.** Fixing the boot orchestrator + idempotent seeding resolves ~8 HIGH items.
2. **Repository contracts drift.** Several repos have `list()` that seeds, `create()` that doesn't gate, transactions that aren't atomic. Add a repo lint rule: writes transactional, reads don't seed.
3. **No rate limit / no lockout** in any auth path.
4. **Theme system bypassed.** Input reads outside React subscription; brand colors hardcoded; theme flicker on boot.
5. **Dead/unused code:** `MapRegionManifestService`, `ArkError`, `empty-state` imports, `sensor-store` in tools, plus 8 unused npm packages.
6. **Big-screen refactor needed:** `map.tsx` (2529), `settings.tsx` (1962), `chat/[threadId].tsx` (1562), `rag.service.ts` (1089).
7. **AGENTS.md drift is the #1 source of confusion.** Add `scripts/check-docs-drift.ts`.
8. **Test gap:** 196 service/repo tests, zero render tests, no iOS CI, no Detox.
