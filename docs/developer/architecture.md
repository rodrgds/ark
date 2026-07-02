# Architecture

Ark keeps screens thin and durable behavior in services, repositories, and stores.

## Major Surfaces

- `app/`: Expo Router routes and screen shells.
- `src/components/`: shared UI, layout, settings, maps, tracks, notes, and cards.
- `src/services/`: domain services for database, security, maps, downloads, AI, content, sensors, tracks, weather, backup, RSS, OCR, and preferences.
- `src/stores/`: Zustand stores for app boot, auth, theme, sensors, and active tracks.
- `modules/`: local Expo native modules for routing, OCR, ZIM, and system colors.
- `docs/`: public documentation site source.

## Boot Contract

Boot opens the local database, prepares app directories, seeds catalogs and guides, recovers downloads, probes native availability, and loads settings. Boot must not require successful network access.

## Data Contract

SQLite is the source of truth for durable app state. Repositories own SQL access. Services own behavior. UI code should not duplicate storage rules.

The current schema baseline is version 2 with 29 base tables and 4 FTS5 virtual tables.

## Native Boundaries

Native modules must fail closed and report capability state. Normal UI should use plain-language labels. Diagnostics can expose engine names and detailed errors.

For the historical architecture notes, see [the original architecture page](/architecture).
