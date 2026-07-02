# Maps and Navigation

Ark separates map readiness from navigation readiness. A downloaded map can render offline, while turn-by-turn road routing also needs a matching routing graph.

## Download A Region

1. Open Map or Settings > Offline Maps.
2. Search for a preset region, use your current viewport, or pick a recommended region.
3. Check the total size. Regions with navigation include map tiles plus routing data.
4. Start the download and leave Ark open until the terminal state is visible.
5. Restart Ark and verify the region still appears as ready.

## Use Offline

- Saved places, route drafts, downloaded regions, and cached place names are available offline.
- Online Photon place search enriches the local cache when the network is available.
- Reverse geocoding reuses cached names and bundled catalog names before falling back to generic area copy.

## Routing Status

- `Navigation ready`: routing graph exists and the native engine is available.
- `Map ready`: tiles are present, but routing data may still be missing.
- `Direct line fallback`: Ark could not calculate a road route and records the reason.

Real-device route proof is still required before road routing is called production-ready.
