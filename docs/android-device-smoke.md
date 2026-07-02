# Android device smoke checklist

Use this for the OnePlus/Android v1-prep pass. Record the APK SHA-256, device model, Android
version, and whether the run is a clean install or an upgraded install with existing app data.

## Setup

- Install the release or dev APK and start with network on.
- Confirm Settings > Advanced > Diagnostics loads without blocking app boot.
- Turn airplane mode on once the initial catalogs/settings have loaded, then relaunch Ark and
  confirm Home, Notes, Library, Map, Tools, and Settings still open.
- Keep any DB backup path reported by SQLCipher encryption/decryption until restart and data checks
  are complete.

## Security and database

- Fresh install: skip passphrase protection, finish onboarding, restart Ark, and confirm notes open
  without unlock and Diagnostics reports `Plaintext database` when SQLCipher is available.
- Settings > Security: turn on passphrase protection, restart, confirm protected notes require
  unlock, then turn passphrase protection off and confirm notes open without unlock again.
- Settings > Security: use `Encrypt DB`, restart, and confirm notes, documents, chats, maps, and
  settings still load; then use `Use Plaintext`, restart, and confirm the same data still loads.
- Encrypted install: change the vault passphrase, force-close/restart, confirm the old passphrase
  fails and the new passphrase unlocks.
- Autolock: with passphrase protection on, set a short timeout, background longer than the timeout,
  return to Ark, and confirm protected notes require unlock.

## Downloads and maps

- Start a guide/model/ZIM download, pause, resume, cancel, and retry a failed item from Settings >
  Advanced > Downloads.
- Tap a running, paused, and failed download notification; it should open the matching detail sheet.
- Download a preset map, force-close/restart, enable airplane mode, and confirm the downloaded
  region, saved pins, and region status remain usable.
- From the map Offline Maps sheet, run `Download visible area`; verify the saved region bounds match
  the current viewport closely enough.
- Search places with network on, then repeat offline; online places should become cached places
  only after they were seen online.

## Navigation

- Download a map preset that includes navigation data.
- In Diagnostics, confirm `Routing engine: active` and `Routing data: ready` before road routing.
- Build a route between saved spots inside the downloaded region.
- Confirm road routing uses the graph when available; otherwise, the direct-line fallback reason
  should name the missing condition.

## Knowledge packs and readers

- Open installed guide PDFs and verify chapter jumps in Hesperian First Aid, Where There Is No
  Doctor, and FM 21-76.
- Open a real ZIM archive, search/open an article, follow an in-article link, use Back, and verify
  tables/infoboxes remain readable in dark theme.
- Use the reader actions sheets for guide, ZIM, and document read-aloud; TTS should show
  Preparing only before audio starts, then Stop or Stop reading while speaking.
- Import a searchable PDF, a scanned PDF, and an image with text. Verify OCR/text status, retry, and
  document RAG citations.
- In document detail, keep Open file as the primary action and verify read aloud, rename, and delete
  from Document Actions.

## AI and source search

- Install or import one GGUF answer model and send a short Ask Arky prompt.
- Stop an in-flight response and verify only that thread is canceled.
- Switch source search from Fast to Thorough, watch rebuild progress/coverage, then test failed
  rebuild rollback if possible.
- Tap chat citations for guide, document, ZIM, note, RSS, and map sources.
- Confirm `ark-hash-v2` only appears when Battery Reduce Mode makes the fallback relevant.

## Backup and appearance

- Export an encrypted backup with notes, documents, chat, saved map spots/routes, RSS feeds, and
  settings.
- On a clean install, import that backup and confirm durable records return while caches/downloads
  do not.
- Test OLED, Dark, Light, System theme, and accent swatches; verify contrast on Android Material You
  System accent.

## Still not proved by this checklist

- iOS Valhalla routing now compiles/links in the simulator native build, but remains unproved until a device route with a ready graph passes.
- OpenFreeMap Liberty/Dark is the built-in production fallback style; full OSM-derived
  POI/PMTiles coverage is still a separate data-pipeline decision beyond the bundled/cached place
  index.
- Device-root vs vault-derived SQLCipher keying remains a production security decision even if
  optional SQLCipher proof passes.
