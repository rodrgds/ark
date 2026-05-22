# TODO.md — Ark ordered task list

> Ordered by priority. ~ means partially done. ✗ means not started.
> ✅ = done.

---

## PRIORITY 1 — Launch blockers (bugs + core security)

### Bugs

- [ ] **Keyboard avoiding for vault inputs** — `Screen` and `OnboardingFrame` wrap content in `KeyboardAvoidingView` (iOS: `behavior="padding"`, offset 90), but the onboarding passphrase page still doesn't push content up reliably. The content should scroll up so the user can see the input fields when the keyboard pops up.
- [x] **Hardcoded `placeholderTextColor="#A1A1AA"` in Input** — Fixed. `src/components/ui/input.tsx` now reads theme from Zustand store and returns correct color per theme (light: `#71717A`, dark/oled: `#A1A1AA`).
- [x] **Home screen "Diagnostics in Tools" button is dead** — Fixed. `app/(tabs)/index.tsx` button now links to `/tools/diagnostics`.
- [ ] **No SafeAreaView** — App uses `contentInsetAdjustmentBehavior="automatic"` on ScrollViews but wraps nothing in SafeAreaView. OLED theme will bleed into notch/horns on iPhone X+. Wrap the root layout shell.
- [ ] **"Vault unlocked" header has no top spacing** — The lock state bar sits behind the status bar / notch area. Needs proper padding/margin so it clears the status bar.
- [ ] **Top header pages show URL/path instead of page name** — Many top header bars display the route path (e.g. "/tools/compass") rather than a human-readable title like "Compass". Headers should show proper page names across all screens.

### Security (vault = core product promise)

- [ ] **Activate SQLCipher encryption** — `src/services/db/schema.ts` has `SQLCIPHER_ACTIVE = false`. Plugin is configured in `app.json`. Needs: (1) dev build with SQLCipher native module, (2) generate DB key from vault password at unlock, (3) pragma key call after unlock.
- [ ] **Upgrade password KDF** — Current: 750 iterations of SHA-256 in pure JS (`src/services/security/keychain.service.ts`). Not production-grade. Need argon2/bcrypt/scrypt via native module in dev build. Document: this requires a dev build with a C++ KDF or native crypto.
- [ ] **Wire auto-lock to app lifecycle** — `src/services/security/autolock.service.ts` exists with `enforce()` but is never called. Add an `AppState.addEventListener('change')` in `app/_layout.tsx` that checks `lastActivityAt` and locks if idle > `autoLockMinutes`.
- [ ] **Implement password change** — `VaultService.changePassword()` at `src/services/security/vault.service.ts:65` returns `ok: false` hardcoded. Implement: verify current password, re-derive with same salt + new password, update verifier in SecureStore.
- [ ] **Wire biometric toggle in Settings** — `app/(tabs)/settings.tsx:48-50` is a hardcoded no-op. Needs: read current biometric state from vault, toggle biometric token save/delete in KeychainService, update vault_state.

### Core offline capabilities (the "survival computer" part)

- [ ] **Set up EAS Build for development builds** — Expo Go can't run MapLibre, llama.rn, or SQLCipher. A dev build profile is needed. Document the `eas.json` config and cloud build steps.
- [ ] **Install and wire MapLibre** — Add `@maplibre/maplibre-react-native` to a dev build. Wire `MapService` to return `available: true` when the native module is present. Render actual map in `app/(tabs)/map.tsx`. Use a free vector tile style URL (e.g., OpenMapTiles or Maptiler free tier).
- [ ] **Implement real offline map tile download** — `OfflineMapService.refreshRegion()` at `src/services/maps/offline-map.service.ts` returns `ok: false`. Wire to MapLibre's `OfflineManager.createPack()` with progress callbacks. Store pack IDs. Add "Download this area" UI (rectangle draw or radius circle on map).
- [ ] **Real download system** — `DownloadManagerService` at `src/services/files/download-manager.service.ts` instantly marks downloads completed. Implement: (1) `expo-file-system.createDownloadResumable()`, (2) progress callbacks writing to SQLite, (3) pause/resume/retry, (4) background download support.
- [ ] **Download actual ZIM knowledge files** — Source URLs needed:
  - Wikipedia Simple English: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_YYYY-MM.zim` (~1.4 GB)
  - Wikivoyage English: `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_YYYY-MM.zim` (~180 MB)
  - Medical Wikipedia: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_YYYY-MM.zim` (~100 MB)
  - Implement ZIM reader — either embed Kiwix JS in a WebView or use a native reader lib.
- [ ] **Actual survival/medical content** — The 8 starter packs in `src/constants/packs.ts` are metadata only. Need real content: (1) First aid checklists (Red Cross public domain), (2) Survival guides (FM 21-76 US Army survival manual is public domain), (3) Medicine/triage reference, (4) Mushroom/plant safety guide. Bundle as Markdown files or fetch from URLs.
- [ ] **Implement RSS feed fetching** — `RssService` at `src/services/rss/rss.service.ts` says "deferred." Add example survival/weather/news feed URLs, implement fetch with expo-file-system, parse with fast-xml-parser (already installed), cache items to rss_items table.

### AI infrastructure

- [ ] **Install llama.rn in dev build** — `LlamaAdapter.isAvailable()` always returns false. Install `llama.rn` (config plugin + native build). Implement: model loading/unloading, token streaming, context window management, memory budgeting.
- [ ] **Implement model download manager** — `ModelManagerService` is a stub. Needs: list available models, download from HuggingFace mirror URLs, verify checksums, store in app models/ directory, track progress in SQLite.
- [ ] **Real weather data** — `WeatherRepository.saveMockPortugalForecast()` inserts hardcoded data. Need: fetch from a free API (Open-Meteo, no API key required) when online, cache with timestamps, show staleness label. Use `https://api.open-meteo.com/v1/forecast` (free, no key).
- [ ] **Upgrade RAG from FTS-only to vector search** — Currently uses FTS5 keyword search. Install `sqlite-vec` or `expo-vector-search` for embedding storage + cosine similarity KNN. Run an embedding model (llama.rn or a small ONNX embedder). Index all notes, guides, wiki content.

---

## PRIORITY 2 — UI/UX quality

### Simplify the UI

- [ ] **Full UI revamp** — The entire UI looks terrible and needs a comprehensive redesign. Every screen needs visual polish: spacing, typography, card design, layout, and consistency across all tabs.
- [ ] **Update color scheme to final palette** — Current colors are placeholders. Need to define and apply the actual brand color scheme across all components and themes (OLED, dark, light).
- [ ] **Set up logo and branding** — Replace text-based "Ark" headers with the actual logo. Add proper app icon assets, splash screen, and branded header components.
- [ ] **Make OLED the recommended default theme** — OLED theme saves battery (true black pixels are off). Set OLED as the default, and label it as "OLED (Recommended — saves battery)" in the theme picker.

- [ ] **Redesign Home screen** — `app/(tabs)/index.tsx` currently has 5 action cards + a "Status" card + a "Native capability notes" card + branding. Too much. Proposed:
  - Keep: Ark branding header (smaller), quick status bar (online/offline dot + vault icon + weather one-liner)
  - Reduce to 3 action cards: "Ask Ark", "Open Map", "New Note"
  - Remove: "Compass" card (it's in Tools tab), "Download Pack" card (it's in Library tab), "Diagnostics in Tools" dead button
  - Add: a small "Offline storage" summary showing total KB/MB downloaded
- [ ] **Clean up Tools screen** — `app/(tabs)/tools.tsx` has 9 cards, 3 are placeholders. Proposed:
  - Keep only working sensors: Compass, Barometer, Level, Pedometer, Light, Diagnostics
  - Move "Coordinates" placeholder → actually wire up expo-location to show lat/lon
  - Move "Emergency checklist" → actually build a simple checklist editor
  - Move "Offline weather cache" → show actual cached forecast freshness (not placeholder text)
- [ ] **Reduce Library filter chips** — 8 chips (All + 7 categories). Merge "RSS" and "AI Models" and "Personal Documents" into "Other" if empty. Or use a dropdown instead of horizontal scroll chips.
- [ ] **Add images/content previews for library packs** — Content packs in the library have no visual representation. Add cover images, thumbnails, or icons for each pack type (Wikipedia, survival guides, medical, etc.) so the library is visually scannable.
- [ ] **Improve Chat UX** — `app/(tabs)/chat.tsx` has messages and input in the same ScrollView. Should split: messages in a FlatList (inverted for bottom-anchored scroll), input fixed at bottom. Add loading indicator while mock/model responds. Add "clear thread" button.
- [ ] **Improve Map fallback UX** — `app/(tabs)/map.tsx` shows "MapLibre is not installed" which is hostile. Show a more helpful state: an illustration, explanation that maps work offline after a dev build, link to setup instructions.
- [ ] **Improve Notes editor — full redesign** — `app/(tabs)/notes.tsx` has single-line title and body inputs that look terrible. Needs: multiline rich body editor with substantial height (not a tiny input), Markdown preview toggle, proper formatting toolbar (bold, italic, headings, lists), tags input (comma-separated or chip-based), created/updated timestamps, word/character count. The current editor is barely usable.
- [ ] **Fix theme-adaptive `placeholderTextColor`** — `src/components/ui/input.tsx:5` hardcode `#A1A1AA`. Create a small hook that reads effective theme and returns the correct muted-foreground color from theme constants.

### Placeholders → real implementations

- [ ] **Wire up document import UI** — `src/services/files/import.service.ts` uses `DocumentPicker` but no screen calls it. Add "Import file" button to Library screen or a new "Documents" tab. Create a simple file list with open/view actions.
- [ ] **Wire up ZIM reader** — `ZimService.getStatus()` returns placeholder. Options: (a) embed Kiwix JS bundle in a WebView — simplest, works cross-platform, (b) use a native ZIM reader library if available. WebView approach: ship `kiwix-js` as bundled HTML/JS assets, open local ZIM via WebView.
- [ ] **Wire up actual biometric toggle** — Settings screen buttons are no-ops. `BiometricsService` already has enroll/status checks. Need: UI to show current state, enable (save biometric token), disable (delete token).
- [ ] **Wire up actual password change** — Settings screen has "Change password placeholder" button. Implement the flow in VaultService: verify current password → derive new verifier → update SecureStore.
- [ ] **Wire up model manager** — Replace the stub `ModelManagerService` with: list available models from a manifest, show download/install status, allow delete, show model size warnings (models are 500MB-4GB).
- [ ] **Wire up sensor store or delete it** — `src/stores/sensor-store.ts` has live value setters/getters but no screen subscribes. Either: (a) have each tool screen write to it on sensor update (useful for cross-screen sensor awareness), or (b) delete it and keep local `useState` pattern.

---

## PRIORITY 3 — Code quality & cleanup

### Delete dead code

- [ ] **Delete `components/ui/` at project root** — This is a duplicate of `src/components/ui/`. The tsconfig `@/` → `src/` alias means these are never imported. Slightly different variants cause confusion. `rm -rf components/ui/`.
- [ ] **Delete or wire unused `react-native-keyboard-controller`** — Installed in package.json but never imported anywhere. We use built-in `KeyboardAvoidingView`. Remove: `bun remove react-native-keyboard-controller`.
- [ ] **Audit unused `@rn-primitives/*` packages** — 20+ primitives packages are installed. Check which are actually imported (likely only `portal` and `slot`). Remove unused ones.
- [ ] **Delete unused DB tables or implement their UI** — Tables with zero usage: `documents`, `map_markers`, `routes`, `rss_feeds`, `rss_items`. Either build screens that use them or drop them from migrations.
- [ ] **Delete unused `download-store.ts`** — `src/stores/download-store.ts` loads downloads but no component reads from the store. Components call `DownloadManagerService` directly. Either wire the store or delete it.
- [ ] **Enable zod validation** — `zod` v4 is installed, barely used. Add schemas for note creation inputs, vault password requirements, content pack selection, chat message payloads.

### UX polish

- [ ] **Add tab bar badges** — Show unread RSS count, pending download count, vault lock status on tab bar icons.
- [ ] **Add pull-to-refresh** — Home screen (refresh network/weather/downloads), Library (refresh pack list), Notes (reload notes list).
- [ ] **Add empty states** — Notes tab when no notes exist, Chat when no messages, Library when no packs installed. Currently screens just show nothing.
- [ ] **Add loading skeletons** — While database queries run (notes list, chat history, content packs), show skeleton placeholders instead of a blank screen.
- [ ] **Add haptic feedback** — expo-haptics is installed. Add subtle haptics for: vault lock/unlock, note save, chat message send, tool sensor reading snapshots.
- [ ] **Add confirmation dialogs** — Before deleting notes/packs/regions, before locking vault.

### Testing

- [ ] **Repository unit tests** — Test all 9 repositories against in-memory SQLite. Verify CRUD, FTS search, soft delete, migration integrity.
- [ ] **Service integration tests** — Vault init/unlock/lock flow, AI send message flow with mock adapter, RAG indexing and search, content pack install flow.
- [ ] **Component smoke tests** — Each screen renders without crashing in mock environment. Onboarding 5-step flow completes.
- [ ] **Onboarding E2E test** — Full flow: intro → vault creation → permissions → pack selection → finish → tabs visible.

### Documentation

- [ ] **EAS Build setup guide** — Step-by-step for creating a development build with MapLibre + llama.rn + SQLCipher.
- [ ] **Map tile source configuration** — How to get a free Maptiler/OpenMapTiles API key, configure the style URL, set up offline regions.
- [ ] **Model download setup** — Where to find GGUF models, size recommendations per device class, how to configure download URLs.
- [ ] **Content pack URLs** — Document all real download URLs for ZIM files, PDF guides, Markdown bundles that users can install.

---

## Content download URLs (reference)

These are the actual URLs to configure once the download system is real:

### ZIM files (Wikipedia/Wikivoyage)
- Wikipedia Simple English: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_nopic_YYYY-MM.zim`
- Wikipedia Medical: `https://download.kiwix.org/zim/wikipedia/wikipedia_en_medicine_nopic_YYYY-MM.zim`  
- Wikivoyage English: `https://download.kiwix.org/zim/wikivoyage/wikivoyage_en_all_nopic_YYYY-MM.zim`

### Survival/Medical (public domain texts)
- US Army FM 21-76 Survival Manual (public domain): PDF available from army.mil or various mirror sites. ~15 MB.
- Where There Is No Doctor (Hesperian): Not public domain, but the organization provides digital copies for developing regions.
- Red Cross First Aid: Multiple public domain sources available.

### Weather (free API, no key required)
- Open-Meteo: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&daily=...` (free, no API key, no account needed)

### Map tiles
- Maptiler free tier (requires API key): `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles: `https://tiles.openmaptiles.org/styles/` (free tier available)

### AI models (for llama.rn)
- Qwen2.5 1.5B Q4_0 GGUF (~1 GB): Good starting model for mobile. From HuggingFace.
- SmolLM2 1.7B Q4_0 GGUF (~1.2 GB): Alternative. Good instruction following.
- Gemma 3 4B Q4_0 GGUF (~2.5 GB): Larger, for devices with 6GB+ RAM.

---

## Summary: what to ship in MVP v1.0

**Must have:**
1. Bug fixes above (keyboard, dead button, safe area)
2. Security baseline (SQLCipher + proper KDF in dev build)
3. Real content packs with actual downloadable content
4. Dev build setup with MapLibre rendering

**Should have:**
5. AI with real LLM in dev build
6. Offline map tile downloads
7. Real weather cache (Open-Meteo)
8. RSS feed fetching
9. ZIM reader

**Nice to have:**
10. Vector search RAG
11. Vision model integration (mushroom ID, etc.)
12. Voice dictation (whisper.rn)
13. Cleaned up UI (decluttered home/tools/library)
14. Tests
