We are no longer building Ark as a hackathon prototype. Treat this as a long-term production app.

Ark is an Expo/React Native mobile app: an offline-first, local-first emergency and survival toolkit. The navigation/maps feature should not try to compete with Google Maps, Apple Maps, or Maps.me as a full navigation product. It should be a crisis-focused offline situational map: “Where am I?”, “What is near me?”, “What regions do I have downloaded?”, “What safe places have I saved?”, and “Can I still use this map without internet?”

I want you to remake the navigation/maps system with the best realistic architecture:

Use MapLibre React Native as the core map renderer, not react-native-maps / Google Maps / Apple Maps. Ark needs true offline-first map support, custom styling, downloadable regions, and long-term control over map data.

Important context:
- This is an Expo app, so MapLibre must be integrated through Expo dev builds / EAS, not Expo Go.
- The map system should be designed around offline downloadable regions.
- For MVP, use MapLibre’s offline pack/download capabilities if practical.
- Long-term, design the architecture so we can later move to self-hosted OpenStreetMap-derived vector tiles generated with Planetiler/OpenMapTiles/PMTiles/MBTiles, served through our own CDN or server.
- Do not bundle world maps inside the app binary.
- Use OpenStreetMap-derived data as the conceptual source for map data.
- The user should be able to download regions, delete regions, see storage usage, and be prompted when viewing/navigating into an unknown region.

Main product direction:
Ark maps should be minimal, fast, readable, and useful in emergencies. Prioritize:
- User location
- Compass/bearing if available
- GPS coordinates
- Saved emergency pins
- Home / meeting points
- Hospitals
- Pharmacies
- Police/fire stations
- Water sources/rivers/lakes
- Roads
- Footpaths/trails
- Buildings
- Terrain/forest/land use where useful
- Downloaded/offline region state

Do NOT prioritize:
- Turn-by-turn navigation
- Traffic
- Public transport
- Reviews/ratings
- Restaurant/shop browsing
- Tourist attractions
- Satellite imagery
- 3D buildings
- Social/community features
- Anything that requires internet to be useful during a crisis

I want a clean production-minded implementation, not a quick patch.

Please inspect the existing project structure first and adapt to the current architecture. Preserve existing patterns where reasonable. If the app already has services, stores, database layers, settings screens, file/download managers, or storage abstractions, reuse them instead of inventing parallel systems.

Tasks:

1. Audit current navigation/maps implementation
- Find all existing navigation/map-related screens, components, services, stores, constants, hardcoded map options, and types.
- Identify where map regions are currently hardcoded.
- Identify what should be replaced, kept, or migrated.
- Do not delete useful existing UI/logic unless replacing it cleanly.

2. Add/prepare MapLibre React Native
- Integrate @maplibre/maplibre-react-native properly for an Expo dev build/EAS environment.
- Add any required native config/plugin setup if needed.
- Make sure the app still builds.
- If full native setup cannot be completed safely, add the code structure and clear TODOs for the exact native/EAS setup required.
- Avoid relying on Expo Go.

3. Create a proper maps domain architecture
Create a dedicated maps/navigation domain with clear separation between:
- Map rendering
- Region manifest
- Offline download management
- Saved pins/places
- User location
- Map storage metadata
- UI screens/components

Use TypeScript types such as:

type MapRegion = {
  id: string;
  name: string;
  countryCode?: string;
  parentId?: string;
  level: 'world' | 'country' | 'region' | 'city';
  bbox: [number, number, number, number]; // west, south, east, north
  center: [number, number]; // longitude, latitude
  minZoom: number;
  maxZoom: number;
  estimatedSizeMb?: number;
  styleUrl?: string;
  tileUrlTemplate?: string;
  updatedAt?: string;
};

type DownloadedMapRegion = {
  regionId: string;
  downloadedAt: string;
  sizeMb?: number;
  status: 'downloaded' | 'downloading' | 'failed' | 'queued';
  progress?: number;
  offlinePackName?: string;
};

type SavedMapPin = {
  id: string;
  title: string;
  description?: string;
  type: 'home' | 'meeting_point' | 'hospital' | 'pharmacy' | 'police' | 'fire_station' | 'water' | 'shelter' | 'custom';
  coordinate: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
  isEmergencyPin?: boolean;
};

4. Replace hardcoded map options with a region manifest system
- Create a local fallback manifest bundled with the app for initial development.
- Structure it so we can later fetch an updated manifest from our server/CDN when online and cache it locally.
- The app should continue to work with only the local fallback manifest.
- Start with a few real example regions, especially Portugal/Lisbon/Porto if relevant to the current app, but design it for worldwide expansion.
- Do not hardcode all countries manually inside UI components.
- Add utility functions:
  - getRegionForCoordinate(lat, lon, regions)
  - getRegionsForBoundingBox(bbox, regions)
  - isCoordinateInsideRegion(lat, lon, region)
  - getDownloadedRegionForCoordinate(lat, lon)
  - sortRegionsByDistanceFromCoordinate(...)
  - findChildRegions(parentId)
  - findParentRegion(regionId)

5. Add Maps.me-like missing region detection
When the user pans/views a location or when their GPS location moves into an area that is not downloaded:
- Detect the best matching region from the manifest.
- If that region is not downloaded, show a non-annoying prompt:
  “Offline map missing”
  “You are viewing Lisbon District. Download this region for offline use?”
  Include estimated size if available.
- Add throttling/debouncing so the prompt does not spam the user while panning.
- Let the user dismiss for now.
- Remember recently dismissed region prompts for the session.
- Provide a way to download from the prompt.

6. Build offline map region management
Create or update a settings/storage screen for maps:
- List downloaded regions.
- Show download status/progress.
- Show estimated/actual size.
- Allow deleting a downloaded region.
- Show failed downloads with retry.
- Show queued/downloading/downloaded states.
- Make this integrate with any existing app storage/download manager if present.

7. Implement emergency map screen UX
Create/remake the main map screen with:
- OLED/dark crisis-first design.
- MapLibre map view.
- Current user location.
- GPS coordinates display.
- Offline/downloaded status indicator.
- Button to center on user.
- Button to add/save current location as a pin.
- Button to open downloaded regions/manage maps.
- Button/toggle for emergency pins.
- Minimal controls; avoid clutter.
- Clear empty/error states when location permission is denied or map data is missing.
- Good loading states.

8. Implement saved places / emergency pins
Users should be able to:
- Save current location as a pin.
- Manually create a pin from the map center.
- Choose pin type.
- Rename pin.
- Delete pin.
- Mark a pin as emergency-important.
- View pins offline.
- Persist pins locally.
- Show pins on the map with clear icons/markers.
- Support at least: home, meeting point, hospital, pharmacy, police, fire station, water, shelter, custom.

Do not build complex POI search yet unless existing infrastructure already supports it. For now, user-saved pins are more important than full offline search.

9. Add low-power / crisis considerations
- Respect the app’s OLED black/dark theme.
- Avoid unnecessary GPS polling.
- Do not constantly download or update in the background.
- Do not animate heavily.
- Make offline status obvious.
- Ensure the map screen remains useful with no internet.
- Avoid anything that drains battery without clear benefit.

10. Design for future self-hosted vector tiles
Even if the MVP uses MapLibre OfflineManager and a third-party/dev tile source, structure the code so we can later support:
- Ark-hosted vector tiles
- MBTiles/PMTiles region files
- CDN-hosted region packs
- A remote region manifest
- Checksums/versioning for region packs
- Updating downloaded regions when newer map data exists

Add TODO comments only where genuinely useful, not everywhere.

11. Error handling and permissions
Handle:
- Location permission denied
- Location unavailable
- Offline with no downloaded map
- Region manifest missing/corrupt
- Download failure
- Insufficient storage if detectable
- Map style/tile load error
- Unsupported platform/native module missing

The user-facing copy should be calm and practical, not technical.

12. Testing
Add unit tests for pure utility functions:
- bbox coordinate matching
- region lookup
- parent/child region lookup
- downloaded-region matching
- prompt throttling/session dismissal logic if implemented as pure logic

Do not over-test native MapLibre rendering. Focus tests on our logic.

13. Code quality requirements
- TypeScript strictness where possible.
- No large duplicated constants inside components.
- No business logic buried directly in UI components.
- Components should be small and readable.
- Keep naming consistent with the existing project.
- Avoid adding unnecessary libraries.
- Avoid building a giant abstraction that slows development.
- Keep the MVP realistic and production-oriented.

Expected output:
- A working or near-working MapLibre-based map/navigation feature.
- A clean maps domain structure.
- Region manifest support.
- Downloaded map management.
- Missing-region prompt behavior.
- Saved emergency pins.
- Offline/crisis-focused map UI.
- Tests for region utility logic.
- A short summary of what changed, what files were touched, and any setup steps still required for EAS/dev builds.

Before coding, inspect the repo and make a concise implementation plan. Then implement it.
