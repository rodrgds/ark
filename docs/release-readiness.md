# Ark release readiness

This checklist tracks store-facing and open-source release risk for Ark's offline-first mobile build.

## Privacy and data safety

- Ark has no backend account system and no cloud sync.
- Durable user data is local: vault notes, imported documents, saved map spots, routes, recorded tracks/markers/photos, RSS subscriptions, weather cache, and download metadata.
- Encrypted backups are user-initiated `.arkbackup` files. Backup payloads exclude models, maps, guide packs, ZIM archives, embeddings, OCR indexes, caches, and download queues.
- Local AI and source search run from installed on-device files when a native build supports them. The deterministic fallback source matcher does not call a network service.
- External network access is user-directed or cache-directed: content downloads, map pack downloads, RSS refresh, weather cache refresh, custom model URLs, optional online map/geocoder access, and OS handoff links.

## Permissions

- Location: save current position, center offline maps, create offline map regions, and record active tracks.
- Motion and activity: compass, level, pedometer, and sensor tools.
- Microphone: short voice prompts for offline transcription.
- Camera and photo library: optional track photos, saved spot photos, and Ask Arky image attachments.
- Biometrics: protect the local vault unlock flow.
- Background location is enabled only for active track recording; background audio and microphone recording are not enabled.

## Offline launch

- App boot opens the local database, prepares folders, seeds local catalogs/guides, recovers queued downloads, checks native module availability, and loads local settings.
- Boot must not require successful network access.
- Queued downloads may retry after boot, but download failures must be recorded without blocking app launch.

## Native and low-end Android risk

- Native-heavy features still need real device verification: SQLCipher, MapLibre offline packs, Valhalla routing, Tracks background location, ArkZim, ArkOcr, llama.rn, and ExecuTorch embedding packs.
- Battery Reduce Mode is the default mitigation for low-end devices: reduced polling, reduced motion, quieter haptics, deferred indexing catch-up, and no AI/model preload.
- CI now compiles the generated iOS simulator app on macOS, but this is build proof only.
- Android debug CI must build an APK artifact before release candidates are cut.
- Android device proof should follow `docs/android-device-smoke.md` so SQLCipher migration/rekey,
  MapLibre packs, routing, OCR/PDF readers, ZIM, local AI/RAG, backups, and theme/accent checks are
  captured consistently.

## Open-source beta readiness

- README is public-facing and links the user, developer, and release docs.
- VitePress documentation exists under `docs/`; `bun run docs:build` is the docs release gate.
- The Cloudflare Pages workflow builds docs artifacts on PRs and deploys to the `ark-docs` Pages
  project on `main` when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, and `CODE_OF_CONDUCT.md` exist.
- Issue and PR templates exist under `.github/`.
- `package.json` has public project metadata and is marked `1.0.0`.
- Core README screenshots exist under `docs/screenshots/`; refresh them after major UI changes and avoid private notes, coordinates, documents, or chats.
- Public GitHub releases should include Android APK assets, `SHA256SUMS.txt`, and a short known-limitations section.

## F-Droid preparation

- Android package ID is `app.ark.offline`; Android `versionCode` is `1`.
- Fastlane metadata exists under `fastlane/metadata/android/en-US/`.
- Draft fdroiddata metadata exists at `fdroid/metadata/app.ark.offline.yml`, intentionally disabled
  until the first tagged Android release candidate has a real `fdroidserver` scanner pass.
- F-Droid details and likely scanner hot spots are tracked in `docs/release/fdroid.md`.

## Store follow-ups before submission

- Fill Play Console data safety with local-only storage, optional user-initiated network downloads, no account, and no sale/sharing of personal data.
- Fill App Store privacy labels consistently with local notes/documents/tracks, optional location/photos/microphone use, background location for active recordings, and user-directed downloads.
- Verify fresh install, migration from the previous database version, no-internet launch, vault unlock, backup export/import, and low-storage download handling on at least one low-end Android device.
