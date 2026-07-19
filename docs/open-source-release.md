# Open-source beta release checklist

Use this checklist before sharing Ark publicly on Reddit, Hacker News, app directories, or a release announcement.

## Repository

- [x] Public repository.
- [x] Public-facing README with badges, logo, status, docs, setup, and limitations.
- [x] License file.
- [x] Contributing guide.
- [x] Security policy.
- [x] Code of conduct.
- [ ] Chat and Notes screenshots recaptured from reviewed synthetic data.
- [x] Issue templates enabled.
- [x] First GitHub release/tag created (`v1.0.0`).
- [x] Release APK attached with checksums.

## Product positioning

Use this one-liner:

> Ark is Noé's Ark for the offline age: a local-first mobile survival computer with maps, knowledge, notes, AI, and practical tools that keep working when the network does not.

Avoid claiming:

- Production-grade encryption until native keying and SQLCipher are verified.
- Medical authority.
- Guaranteed disaster safety.
- Complete offline navigation on every platform.
- Fully embedded ZIM reading on every platform.
- Mature local AI quality.

## Screenshots

Reviewed screenshots live under `docs/screenshots/`. Library and Map remain published; Chat and
Notes were removed pending a clean recapture:

- `library.png`
- `map.png`
- `chat.png` (pending)
- `notes.png` (pending)

See `docs/screenshots.md` for exact capture notes.

## Reddit post angle

Best angle:

> I built an open-source offline-first survival toolkit for mobile after thinking about outages where the internet is not available. It bundles maps, guides, secure notes, local search/RAG, and phone sensor tools. It is beta-stage and I am looking for Android testers and offline-map/local-AI feedback.

Do not overpitch it as a finished emergency app. Ask for testing on devices, feedback on offline flows, and suggestions for reliable public-domain/open-license preparedness sources.

## Beta verification

Before tagging a beta:

- [ ] Fresh install works offline after first boot.
- [ ] Onboarding completes without account/network dependency.
- [ ] Vault setup, unlock, failed-attempt lockout, auto-lock, password change, and backup export/import work.
- [ ] Notes create/edit/search/delete/favorite/index flows work.
- [ ] Content pack download, pause, resume, cancel, delete, and open work.
- [ ] Low-storage path does not corrupt download state.
- [ ] Map renders in dev build and downloaded region survives restart/airplane mode.
- [ ] Routing pack downloads, Diagnostics shows navigation data ready, and Android can calculate at least one local route.
- [ ] RSS/weather refresh fails gracefully offline.
- [ ] AI chat works with fallback and with one installed GGUF model on a target Android device.
- [ ] Diagnostics accurately reports unavailable native modules.
- [ ] `bun run check` passes.

## Release notes template

```md
## Ark beta <version>

Ark is an offline-first survival computer for mobile: maps, knowledge, notes, AI, and tools that keep working without internet.

### What works

- ...

### Known limitations

- ...

### Install / build

- ...

### Testing wanted

- Android device/build reports.
- Offline map/routing behavior.
- Content pack download reliability.
- Local AI/model loading feedback.
```
