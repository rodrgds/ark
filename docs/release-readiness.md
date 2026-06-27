# Ark release readiness

This checklist tracks store-facing and open-source release risk for Ark's offline-first mobile build.

## Privacy and data safety

- Ark has no backend account system and no cloud sync.
- Durable user data is local: vault notes, imported documents, saved map spots, routes, RSS subscriptions, weather cache, and download metadata.
- Encrypted backups are user-initiated `.arkbackup` files. Backup payloads exclude models, maps, guide packs, ZIM archives, embeddings, OCR indexes, caches, and download queues.
- Local AI and source search run from installed on-device files when a native build supports them. The deterministic fallback source matcher does not call a network service.
- External network access is user-directed or cache-directed: content downloads, map pack downloads, RSS refresh, weather cache refresh, custom model URLs, optional online map/geocoder access, and OS handoff links.

## Permissions

- Location: save current position, center offline maps, and create offline map regions.
- Motion and activity: compass, level, pedometer, and sensor tools.
- Microphone: short voice prompts for offline transcription.
- Camera and photo library: optional saved spot photos and Ask Arky image attachments.
- Biometrics: protect the local vault unlock flow.
- Background recording, background audio, and background location are not enabled.

## Offline launch

- App boot opens the local database, prepares folders, seeds local catalogs/guides, recovers queued downloads, checks native module availability, and loads local settings.
- Boot must not require successful network access.
- Queued downloads may retry after boot, but download failures must be recorded without blocking app launch.

## Native and low-end Android risk

- Native-heavy features still need real device verification: SQLCipher, MapLibre offline packs, ArkZim, ArkOcr, llama.rn, and embedding packs.
- Battery Reduce Mode is the default mitigation for low-end devices: reduced polling, reduced motion, quieter haptics, deferred indexing catch-up, and no AI/model preload.
- Android debug CI must build an APK artifact before release candidates are cut.

## Open-source beta readiness

- README is public-facing and links the core docs.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` exist.
- Issue and PR templates exist under `.github/`.
- `package.json` has public project metadata and is marked `1.0.0-beta.0`.
- Real screenshots are still pending; do not link placeholders from the README.
- First public release should include an install/build path and a short known-limitations section.

## Store follow-ups before submission

- Fill Play Console data safety with local-only storage, optional user-initiated network downloads, no account, and no sale/sharing of personal data.
- Fill App Store privacy labels consistently with local notes/documents, optional location/photos/microphone use, and user-directed downloads.
- Verify fresh install, migration from the previous database version, no-internet launch, vault unlock, backup export/import, and low-storage download handling on at least one low-end Android device.
