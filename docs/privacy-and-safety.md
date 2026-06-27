# Privacy and safety

Ark's product promise depends on being honest about privacy, security, and critical-use limits.

## Privacy posture

Ark is designed as a local-first app:

- No account is required for core use.
- No backend is required for app launch.
- Notes, imported documents, saved spots, routes, settings, RSS cache, download metadata, and indexes are stored locally.
- Backups are user-initiated local files.
- AI/RAG is designed to work over local files when native model support is available.

## Network access

Network access should be user-directed or cache-directed:

- Downloading content packs, map packs, routing packs, and model packs.
- Refreshing weather forecasts or RSS feeds.
- Resolving remote catalogs/manifests.
- Using optional online map/geocoder sources.
- Opening OS handoff links.
- Registering custom model/content URLs.

Core boot must continue to work when all of these fail.

## Sensitive data

Treat these as sensitive:

- Vault notes and note metadata.
- Imported documents and OCR output.
- Saved spots, coordinates, and routes.
- Backups.
- Chat prompts and local AI history.
- Downloaded private/custom files.

Do not add logging that prints these values. Dev logs should stay structural: IDs, counts, durations, and non-sensitive status codes.

## Safety copy

Use conservative wording for:

- Medical and first aid content.
- Foraging and food safety.
- Weather and disaster forecasts.
- AI-generated answers.
- Personal safety and conflict content.
- Navigation/routing in dangerous conditions.

Ark can help users prepare and retrieve information offline. It must not imply guaranteed safety, medical authority, official emergency status, or edible plant/mushroom identification.

## Data sources and licensing

Third-party guides, models, maps, RSS feeds, APIs, ZIM archives, and PDFs keep their own licenses and terms. `LICENSE` covers this repository's code and project-owned assets only.

Before adding a curated source, verify:

- The source is reputable enough for the use case.
- Downloading/offline caching is allowed.
- Attribution requirements are understood.
- Checksums or stable versioning exist where practical.
- The content does not create obvious safety risk.

## Release implication

A beta release can be public, but it should be framed as a preparedness/offline toolkit under active development, not a finished emergency product. Keep the README, screenshots, release notes, and Reddit post aligned with that.
