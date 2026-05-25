import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(process.cwd(), 'app');

describe('map and chat UI contracts', () => {
  test('map defaults to a local low-detail world overview without online style upgrades', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('DEFAULT_CENTER: LngLat = [0, 20]');
    expect(source).toContain('WORLD_OVERVIEW_ZOOM = 1.1');
    expect(source).toContain('MapService.getOverviewStyle(theme)');
    expect(source).toContain('worldOverviewFeatureCollection()');
    expect(source).toContain('No downloaded map regions');
    expect(source).not.toContain('MapService.getThemedStyle(theme)');
    expect(source).not.toContain('MapService.canReachStyleUrl');
  });

  test('map owns compass visibility so the search bar animates around it', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('compass={false}');
    expect(source).toContain('bearingDistanceFromNorth(mapBearing)');
    expect(source).toContain('visible ? SEARCH_INSET_WITH_COMPASS : SEARCH_INSET_WITHOUT_COMPASS');
    expect(source).toContain('<CompassButton bearing={mapBearing}');
    expect(source).toContain('style={[{ top: 6 }, animatedSearchStyle]}');
  });

  test('map search dismissal cannot fall through to spot creation', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(source).toContain("navigation.addListener('beforeRemove'");
    expect(source).toContain('searchGestureSuppressUntilRef.current = Date.now()');
    expect(source).toContain(
      'if (isSearchActive || Date.now() < suppressLongPressUntilRef.current)'
    );
    expect(source).toContain('onDismissSearch();');
    expect(source).toContain('return;');
  });

  test('chat resizes its scroll area with the keyboard instead of floating the composer', () => {
    const source = readFileSync(join(appDir, '(tabs)/chat.tsx'), 'utf8');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('keyboardWillChangeFrame');
    expect(source).toContain('const overlap = Math.max(0, windowHeight - keyboardTop)');
    expect(source).toContain('paddingBottom: keyboardInset > 0 ? keyboardInset + 8');
    expect(source).not.toContain('useAnimatedKeyboard');
    expect(source).not.toContain('translateY');
  });

  test('map keeps network enabled while native offline packs are active', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('hasActiveMapDownloads');
    expect(source).toContain("region.status === 'downloading' || region.status === 'queued'");
    expect(source).toContain('MapService.setNetworkConnected(maplibre, hasActiveMapDownloads)');
    expect(source).not.toContain(
      'MapService.setNetworkConnected(maplibre, false);\n      setBusy(null);'
    );
  });

  test('downloaded maps open centered on the downloaded region', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('primaryDownloadedRegion');
    expect(source).toContain('mapInitialCenter');
    expect(source).toContain('regionInitialZoom(primaryDownloadedRegion)');
    expect(source).toContain('autoFocusedRegionIdRef');
    expect(source).toContain('fitRegion(primaryDownloadedRegion)');
    expect(source).toContain('pendingCameraActionRef');
  });

  test('missing map prompts can use visible MapLibre bounds, not just the center', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('viewedBounds');
    expect(source).toContain('normalizeMapEventBounds(event.nativeEvent.bounds)');
    expect(source).toContain('MapPresetsService.getRegionsForBoundingBox(viewedBounds)');
  });

  test('map onboarding starts from manifest-backed region downloads', () => {
    const source = readFileSync(join(appDir, 'onboarding/maps.tsx'), 'utf8');

    expect(source).toContain('MapPresetsService.refreshCatalog');
    expect(source).toContain('MapLocationService.getGrantedLocation');
    expect(source).toContain('ensurePresetRegionDownload');
    expect(source).toContain('getUnsupportedMapPackReason');
    expect(source).toContain('if (!result.ok)');
    expect(source).not.toContain("from 'expo-location'");
    expect(source).not.toContain("new Set(['portugal-overview'])");
  });

  test('map screen delegates GPS permission and fix retrieval to the maps domain', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('MapLocationService.resolveUserLocation');
    expect(source).not.toContain("import * as Location from 'expo-location'");
    expect(source).not.toContain('Location.requestForegroundPermissionsAsync');
    expect(source).not.toContain('Location.getCurrentPositionAsync');
  });

  test('map catalog cards do not invite unsupported future pack downloads', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('getUnsupportedMapPackReason(preset)');
    expect(source).toContain("? 'Planned'");
    expect(source).toContain('disabled={(downloaded && !updateAvailable) || busy || unsupported}');
  });
});
