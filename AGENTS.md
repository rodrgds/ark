# AGENTS.md — Ark

> Durable operating guide for agents working on Ark. Keep this concise. It is not a changelog:
> record completed work in Git and keep changing release/device status in the linked docs.

## Start Here

1. Run `git status --short --branch`; all existing changes are user-owned until proven otherwise.
2. Run `bun run agent:preflight` for a quick repository snapshot. Use
   `bun run agent:preflight:native` before native diagnosis/builds and
   `bun run agent:preflight:release` before a promoted build or dev-group delivery.
3. Read only the source-of-truth material relevant to the task:
   - Product or UI: `PRODUCT.md`, `DESIGN.md`.
   - Current release/device gaps: `docs/v1-prep-plan.md`, `docs/release-readiness.md`,
     `docs/android-device-smoke.md`.
   - Architecture and setup: `docs/architecture.md`, `docs/developer/`.
   - Native behavior: `app.json`, `plugins/`, `modules/`, `patches/`.
   - Commands and hooks: `package.json`, `devenv.nix`.
4. Treat `TODO.md`, status tables, comments, and old issue text as candidate evidence. Verify each
   claim against implementation, tests, generated config, and current runtime before repeating it.
5. Do not append a session recap to this file. Add only a durable rule, ownership boundary, or
   expensive-to-rediscover fix.

## How The User Works

- A "deep dive", "everything", or "what is missing" request means inspect the complete relevant
  flow, not only one screen. Separate the result into verified implementation gaps, device-only
  proof gaps, tests to run, and stale docs. Audits are read-only until implementation is requested.
- "Fix/implement all of those" after an audit means implement the verified findings and validate
  them; do not spend another turn restating the report or asking avoidable questions.
- Physical-device feedback is the strongest available runtime evidence. A green typecheck, unit
  test, Gradle build, or emulator run does not invalidate a reproducible phone failure.
- The user prefers root-cause repairs and low tech debt. Do not accumulate retries, fallback
  branches, UI suppression, or release-only workarounds when the underlying failure is unknown.
- Ark is still pre-v1 and has one primary tester. Do not add compatibility code for old pre-v1
  databases or backups unless explicitly requested. The current baseline rejects them.
- "Commit and push in chunks" means inspect the whole worktree, keep unrelated user changes, group
  commits by coherent subsystem/behavior, run the relevant gates, push, and confirm the upstream
  state. Never make one giant catch-all commit.
- "Build and send" means use the saved one-command delivery flow, not rediscover the Beeper room or
  manually reconstruct the command.

## Evidence And Claims

Use the strongest accurate label:

| Claim              | Minimum evidence                                                               |
| ------------------ | ------------------------------------------------------------------------------ |
| Implemented        | Source inspection plus focused automated coverage                              |
| Checks pass        | The named command completed in this checkout                                   |
| Native build works | A fresh Gradle/Xcode artifact was created and inspected                        |
| Emulator verified  | The exact flow ran in a booted emulator/simulator                              |
| Device verified    | The exact flow ran on a named physical device/build                            |
| Release ready      | Checks, native artifacts, required device matrix, docs, and distribution proof |

Never call an APK "device proof" merely because it contains expected symbols or installs. Report
what remains unverified whenever hardware, credentials, data packs, or external services are absent.

## Native Root-Cause Loop

Use this order for crashes, black screens, hangs, heat, missing native features, or "worked in dev
but not release":

1. Record device/OS, exact APK variant and commit, last-known-good commit, and minimal reproduction.
2. Run `bun run agent:preflight:native`; confirm disk, connected devices, cache footprint, and Git
   state before an expensive build.
3. Capture the first causal error with Metro/dev logs and `adb logcat` or Xcode. Do not diagnose
   from the final cascade or screenshot alone.
4. Reproduce in both dev and release when behavior differs. For release-only failures, inspect
   minification, Metro bundle freshness, native library/assets packaging, config plugins, and
   patched dependencies before adding app-level fallback code.
5. Fix the canonical source, remove abandoned workarounds, add focused regression coverage, then
   rerun the smallest relevant gate and the actual runtime flow.
6. Build/send only when requested. If a device remains connected, verify launch and the repaired
   flow before delivery.

Generated `android/` and `ios/` files are evidence, not the sole source of a fix. Native changes must
live in `app.json`, `plugins/`, `modules/`, dependency patches, or another declarative owner and
survive prebuild. Ark's normal scripts use `expo prebuild --no-clean` because SDK 57 defaults to
clean regeneration; do not run a clean prebuild casually.

## Canonical Ownership

| Area                 | Primary owners                                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| App shell/navigation | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, Expo Router routes                 |
| Shared UI/keyboard   | `src/components/ui/`, `src/components/layout/`                                  |
| Product screens      | thin routes in `app/`, larger implementations in `src/components/`              |
| Settings             | `app/(tabs)/settings.tsx`, `src/components/settings/`                           |
| Data/schema          | `src/services/db/`, repositories only for screen-facing DB access               |
| Security/backup      | `src/services/security/`, `src/services/backup/`                                |
| AI/RAG/voice         | `src/services/ai/`, `src/services/ai/rag/`, `src/components/chat/`              |
| Maps/routing         | `src/services/maps/`, `src/components/map/`, `modules/ark-routing/`             |
| Content/ZIM/OCR      | `src/services/content/`, `modules/ark-zim/`, `modules/ark-ocr/`                 |
| Downloads/files      | `src/services/files/`, `src/components/settings/downloads-card.tsx`             |
| Tracks               | `src/services/tracks/`, `src/components/tracks/`, `app/tracks/`                 |
| Theme                | `src/constants/theme.ts`, `src/stores/theme-store.ts`, `global.css`             |
| Native config        | `app.json`, `plugins/`, local `modules/`, `patches/`                            |
| Hooks                | `devenv.nix`; generated `.githooks/` and `.pre-commit-config.yaml` stay ignored |

Keep orchestration out of route files when an owning service/component/hook exists. The map and
Settings implementations are already large; move new domain state/actions to their owner instead
of growing central screens.

## Product Contracts

- Ark is "Noé's Ark for the offline age": a serious, calm, offline-first survival computer, not a
  playful camping app. It should remain useful after initial downloads with no network.
- Production targets are iOS and Android development/release builds. Expo Go is not a production
  verification environment for MapLibre, llama.rn, SQLCipher, routing, ZIM, OCR, or ExecuTorch.
- Fresh installs default to System theme + System accent. Android uses Material You colors when
  available and Moss as deterministic fallback. OLED is selectable; Battery Reduce Mode may use it.
- Default visible tabs are Chat, Tracks, Map, Library, Settings. Tools and Notes remain available
  but hidden by default. Native tabs are capped at five; persisted preferences must be sanitized.
- Passphrase protection is optional and gates secure notes. It does not imply that documents,
  chats, tracks, maps, or RSS are locked. Optional SQLCipher protects the whole database.
- Fresh databases use the current v2 baseline; old pre-v2 databases should be cleared. Backup v3
  rejects older backups rather than carrying pre-release migration debt.
- AI answers, RAG, maps, routing, sensors, downloaded content, and backups are local-first. Network
  use and incomplete native proof must be described precisely in UI and public copy.

## UI Rules From Device Feedback

- Preserve Ark's established restrained visual system. Use `PRODUCT.md` and `DESIGN.md`; do not
  invent a second aesthetic during a bug fix.
- Use semantic theme classes. Native APIs, WebViews, maps, navigation, and other concrete-color
  consumers should subscribe to `useThemeStore((state) => state.colors)`. Verify Light, Dark, OLED,
  System, and changed accents when the surface is theme-sensitive.
- Fix shared failures at the shared contract. Cursor/selection issues go first to
  `src/components/ui/input.tsx`; sheet/inset/keyboard failures go first to shared bottom-sheet and
  keyboard primitives; tab-shell failures go first to tab preference/layout owners.
- Shared `Input` deliberately lets native `TextInput` own text while focused. Do not restore a
  controlled `value` update on each render and reintroduce Android cursor jumps.
- Bottom-sheet actions must stay reachable above Android/iOS insets and the keyboard. Use the
  shared pinned `footer`, nested scrolling, and keyboard-aware primitives; test tall content and
  low-screen controls, not only the initial sheet frame.
- Settings probes must load independently with bounded timeouts and visible fallbacks. Never gate
  the entire page behind one native/storage/model `Promise.all` or leave endless "Checking..."
  states.
- Onboarding should queue work and advance; it must not await multi-minute map/model downloads.
  Active UI must consider both map-tile and routing-graph states.
- Use Expo Router `VectorIcon` for native tab icons. Eager icon-source generation has caused slow
  post-onboarding tab paint and device heat.
- Icon-only controls need accessibility labels and at least a 44x44 touch target. Check safe areas,
  keyboard avoidance, overflow, action visibility, and console/device logs on affected screens.

## SDK 57 And Native Gotchas

- Current cohort: Expo 57.0.6, React Native 0.86.0, React 19.2.3, TypeScript 6.0.3,
  Expo Router 57.0.6, Uniwind 1.6.3.
- Import `ThemeProvider`, `DarkTheme`, and `DefaultTheme` from `expo-router`, not directly from
  `@react-navigation/native`; production bundles reject the latter.
- Keep the TenTap React 19 peer patch, root `react-dom` override, and SDK-managed Expo peers. Avoid
  direct `expo-modules-core` dependencies in app/local-module manifests unless Doctor requires it.
- Keep Worklets bundle mode and the Uniwind patch that resolves React Native through
  `react-native/index`. Recursive resolution can cause release startup stack overflows around
  `NativeModules`, `copyComponentProperties`, or `ActivityIndicator`.
- `plugins/with-ark-gradle-memory.js` owns the 12 GiB Gradle heap. Native builds can also consume
  large space in `.cxx`, Gradle, and intermediates; the preflight and `build-send` disk guard exist
  because "No space left on device" has masqueraded as a source failure.
- After changing a patched native dependency, force the Metro bundle and release assembly:
  `cd android && ./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks && ./gradlew :app:assembleRelease`.

## Verification

Use focused checks first, then scale with blast radius:

```sh
bun run typecheck
bun run lint
bun run test
bun run check
bun run check:docs
bun run docs:build
bun run verify
```

- `bun run verify` is the source/docs gate; it does not perform native builds or device tests.
- After dependency or Expo config changes, run `npx expo-doctor` in addition to repository checks.
- Add focused tests for defects. In this Bun + RNTL setup, prefer `const view = await render(...)`
  and query through `view`; the global `screen` helper has failed with "render function has not
  been called".
- Add new lucide icons to the shared RNTL icon mock when a mount-tested surface uses them.
- For CI failures, inspect each job log first and separate code failure from toolchain/environment
  failure. Keep working until requested checks are green, not merely locally patched.
- Prefer focused unit/RNTL coverage for narrow state machines. Use broad route/device QA when the
  user asks for "all screens", "everything", production readiness, or cross-platform consistency.
- Run native, device, prebuild, Gradle, deployment, release, or external-send commands only when the
  user requests that scope.

## Delivery

- Dev-group release build and send: `bun run build-send`.
- Dev/debug build and send: `bun run build-send:dev`.
- The script builds the correct APK, verifies the artifact exists, computes SHA-256, adopts the
  local Beeper session if needed, and sends to the saved WhatsApp dev group. Do not repeat the room
  ID or manual command in task reasoning.
- Before a promoted public build: run `bun run agent:preflight:release`, the proportional source
  gates, create fresh native artifacts, inspect them, and distinguish build proof from device smoke.
- When Git publication is requested, recheck the final diff and worktree after formatting/build
  generation, commit by subsystem, push, and confirm upstream. Do not stage unrelated user work.

## Current Truthfulness Boundaries

The main unresolved risk is physical-device proof, not basic code presence. Before production
claims, use the current checklists for SQLCipher migration/rekey, MapLibre downloads/restart,
Valhalla routes with real graphs, large ZIM archives, OCR/PDF extraction, llama/ExecuTorch memory
and cancellation, background tracks, large download recovery, TTS lifecycle, backups, and iOS
native paths. `docs/v1-prep-plan.md` and `docs/android-device-smoke.md` own the changing matrix.

## Writing And Product Copy

- Keep copy concise, concrete, calm, and task-first. Remove explanatory text that does not help the
  user act.
- Prefer familiar words and active voice. Avoid stock metaphors, marketing filler, and exposed
  engine jargon.
- Preserve exact technical, safety, medical, legal, API, command, citation, and proper-noun wording
  where precision requires it.
- Never imply that an unavailable, cached, fallback, unverified, or partial capability is healthy
  or production-ready. Healthy configuration states should stay quiet; show actionable problems.
