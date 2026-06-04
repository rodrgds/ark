import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(process.cwd(), 'app');
const assetsDir = join(process.cwd(), 'assets');

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

  test('chat uses a floating split composer that follows the keyboard', () => {
    const source = readFileSync(join(appDir, '(tabs)/chat/[threadId].tsx'), 'utf8');

    expect(source).toContain('keyboardDidShow');
    expect(source).toContain('keyboardDidHide');
    expect(source).toContain('keyboardOffset');
    expect(source).toContain('FloatingComposer');
    expect(source).toContain('AnimatedPressable');
    expect(source).toContain('detachedPlusStyle');
    expect(source).toContain('embeddedPlusStyle');
    expect(source).toContain('input.measure');
    expect(source).toContain("Platform.OS === 'android'");
    expect(source).toContain('keyboardOffset.value = withTiming(fallbackOffset');
    expect(source).toContain('inputBottom + COMPOSER_BOTTOM_GAP_FOCUSED - keyboardTop');
    expect(source).toContain('translateY: -keyboardOffset.value');
    expect(source).toContain('COMPOSER_BOTTOM_GAP');
    expect(source).toContain('DETACHED_PLUS_SIZE = COMPOSER_HEIGHT');
    expect(source).toContain('backgroundColor: colors.card');
    expect(source).toContain('borderColor: colors.border');
    expect(source).toContain('placeholderTextColor={themeColors.mutedForeground}');
    expect(source).toContain('EMPTY_THREAD_PROMPTS');
    expect(source).toContain('pendingUserMessage');
    expect(source).not.toContain('.reverse()');
    expect(source).not.toContain('useBottomTabBarHeight');
    expect(source).not.toContain('marginBottom: keyboardOffset');
    expect(source).not.toContain('ArkKeyboardStickyView');
    expect(source).not.toContain('ArkKeyboardAvoidingView');
    expect(source).not.toContain('KeyboardAvoidingView');
    expect(source).not.toContain('keyboardInset');
  });

  test('chat voice input works around native VAD arguments and streams spoken responses', () => {
    const chat = readFileSync(join(appDir, '(tabs)/chat/[threadId].tsx'), 'utf8');
    const vad = readFileSync(join(process.cwd(), 'src/hooks/use-ark-voice-activity.ts'), 'utf8');
    const tts = readFileSync(join(process.cwd(), 'src/hooks/use-ark-text-to-speech.ts'), 'utf8');

    expect(chat).toContain('useArkVoiceActivity');
    expect(chat).toContain('speechToText.transcribe(speechWaveform, {})');
    expect(chat).toContain('0.18 * sampleRate');
    expect(vad).toContain('nativeModule.generate(waveform, 0)');
    expect(tts).toContain('moduleInstance.streamInsert');
    expect(tts).toContain('for await (const waveform of moduleInstance.stream');
    expect(tts).not.toContain('moduleInstance.forward(normalized');
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
    expect(source).toContain('startPresetRegionDownload');
    expect(source).toContain('getUnsupportedMapPackReason');
    expect(source).toContain('if (!result.ok && !result.queued)');
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

  test('bundled map catalog keeps small countries compact and large countries regional', () => {
    const catalog = JSON.parse(readFileSync(join(assetsDir, 'map-catalog.json'), 'utf8')) as {
      regions: Array<{ id: string; tags?: string[] }>;
    };
    const counts = countMapRegionsByCountry(catalog.regions);

    expect(counts.Portugal).toBe(5);
    expect(counts.Spain).toBeGreaterThanOrEqual(6);
    expect(counts.France).toBeGreaterThanOrEqual(6);
    expect(counts['United States']).toBeGreaterThanOrEqual(10);
    expect(counts.Canada).toBeGreaterThanOrEqual(5);
    expect(counts.Brazil).toBeGreaterThanOrEqual(5);
    expect(counts.Australia).toBeGreaterThanOrEqual(5);
    expect(counts.India).toBeGreaterThanOrEqual(6);
  });

  test('map overlays use shared bottom sheets instead of native modals', () => {
    const source = readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8');

    expect(source).toContain('ArkBottomSheet');
    expect(source).toContain("snapPoints={['58%', '92%']}");
    expect(source).not.toContain('<Modal');
    expect(source).not.toContain('KeyboardAvoidingView');
  });

  test('shared bottom sheets use the Software Mansion native sheet', () => {
    const rootLayout = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
    const bottomSheet = readFileSync(
      join(process.cwd(), 'src/components/ui/bottom-sheet.tsx'),
      'utf8'
    );
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');

    expect(rootLayout).toContain("from '@swmansion/react-native-bottom-sheet'");
    expect(rootLayout).toContain('<BottomSheetProvider>');
    expect(bottomSheet).toContain('ModalBottomSheet');
    expect(bottomSheet).toContain("from '@swmansion/react-native-bottom-sheet'");
    expect(packageJson).toContain('"@swmansion/react-native-bottom-sheet"');
    expect(packageJson).not.toContain('"@gorhom/bottom-sheet"');
  });

  test('chat markdown renders static and streaming messages with native markdown', () => {
    const markdownText = readFileSync(
      join(process.cwd(), 'src/components/ui/markdown-text.tsx'),
      'utf8'
    );
    const chatThread = readFileSync(join(appDir, '(tabs)/chat/[threadId].tsx'), 'utf8');
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');

    expect(markdownText).toContain('react-native-enriched-markdown');
    expect(markdownText).toContain('streamingAnimation={streaming}');
    expect(chatThread).toContain('<MarkdownText streaming>');
    expect(packageJson).toContain('"react-native-enriched-markdown"');
    expect(packageJson).not.toContain('"react-native-markdown-display"');
    expect(packageJson).not.toContain('"react-native-streamdown"');
  });
});

function countMapRegionsByCountry(regions: Array<{ id: string; tags?: string[] }>) {
  const countryByPrefix: Record<string, string> = {
    ar: 'Argentina',
    au: 'Australia',
    br: 'Brazil',
    ca: 'Canada',
    de: 'Germany',
    es: 'Spain',
    fr: 'France',
    gb: 'United Kingdom',
    gr: 'Greece',
    ie: 'Ireland',
    in: 'India',
    it: 'Italy',
    jp: 'Japan',
    ma: 'Morocco',
    mx: 'Mexico',
    nz: 'New Zealand',
    pt: 'Portugal',
    tr: 'Turkey',
    uk: 'United Kingdom',
    us: 'United States',
  };
  return regions.reduce<Record<string, number>>((counts, region) => {
    if (region.id.includes('base') || region.id.includes('low-detail')) return counts;
    const prefix = region.id.split('-')[0] ?? '';
    const country =
      countryByPrefix[prefix] ??
      region.tags?.find((tag) => Object.values(countryByPrefix).includes(tag));
    if (country) counts[country] = (counts[country] ?? 0) + 1;
    return counts;
  }, {});
}
