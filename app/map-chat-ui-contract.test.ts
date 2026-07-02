import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appDir = join(process.cwd(), 'app');
const assetsDir = join(process.cwd(), 'assets');

function chatDetailSource() {
  return [
    readFileSync(join(appDir, 'chat/[threadId].tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/chat/chat-input.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/chat/chat-message.tsx'), 'utf8'),
  ].join('\n');
}

function mapScreenSource() {
  return [
    readFileSync(join(appDir, '(tabs)/map.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/map-screen.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/map-screen-components.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/map-screen-utils.ts'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/map-pin.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/saved-data-panel.tsx'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/components/map/map-toolbar.tsx'), 'utf8'),
  ].join('\n');
}

function tabsLayoutSource() {
  return readFileSync(join(appDir, '(tabs)/_layout.tsx'), 'utf8');
}

describe('map and chat UI contracts', () => {
  test('map uses online base tiles when connected and falls back to local overview offline', () => {
    const source = mapScreenSource();

    expect(source).toContain('DEFAULT_CENTER: LngLat = [0, 20]');
    expect(source).toContain('WORLD_OVERVIEW_ZOOM = 1.1');
    expect(source).toContain('mapCanUseNetwork');
    expect(source).toContain('MapService.getThemedStyle(theme, colors)');
    expect(source).toContain('MapService.getOverviewStyle(theme, colors)');
    expect(source).toContain('MapService.getLocalStyle(theme, colors)');
    expect(source).toContain("mapCanUseNetwork\n        ? 'online-basemap'");
    expect(source).toContain('showWorldOverview={!mapHasBaseTiles}');
    expect(source).toContain('worldOverviewFeatureCollection()');
    expect(source).toContain('No downloaded map regions');
    expect(source).not.toContain('MapService.canReachStyleUrl');
  });

  test('map owns compass visibility so the search bar animates around it', () => {
    const source = mapScreenSource();

    expect(source).toContain('compass={false}');
    expect(source).toContain('bearingDistanceFromNorth(mapBearing)');
    expect(source).toContain('visible ? SEARCH_INSET_WITH_COMPASS : SEARCH_INSET_WITHOUT_COMPASS');
    expect(source).toContain('<CompassButton bearing={mapBearing}');
    expect(source).toContain('style={[{ top: 6 }, animatedSearchStyle]}');
  });

  test('map search dismissal cannot fall through to spot creation', () => {
    const source = mapScreenSource();

    expect(source).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(source).toContain("navigation.addListener('beforeRemove'");
    expect(source).toContain('searchGestureSuppressUntilRef.current = Date.now()');
    expect(source).toContain(
      'if (isSearchActive || Date.now() < suppressLongPressUntilRef.current)'
    );
    expect(source).toContain('onDismissSearch();');
    expect(source).toContain('return;');
  });

  test('hidden top header keeps tab content below the status bar', () => {
    const source = tabsLayoutSource();

    expect(source).toContain('useSafeAreaInsets()');
    expect(source).toContain('height: insets.top');
    expect(source).toContain('topHeaderEnabled ?');
    expect(source).toContain('<LockStateBar />');
  });

  test('map routing and spot creation use explicit long-press and marker sheets', () => {
    const source = mapScreenSource();

    expect(source).toContain('function eventLngLat(event: any): LngLat | null');
    expect(source).toContain('Keyboard.dismiss();');
    expect(source).not.toContain('if (lngLat) onMapPress(lngLat);');
    expect(source).not.toContain('onMapPress={(lngLat) => void startNavigationToMapPoint(lngLat)}');
    expect(source).toContain('setMapActionPoint(lngLat);');
    expect(source).toContain('MapPointActionSheet');
    expect(source).toContain('Route here');
    expect(source).toContain('Save spot');
    expect(source).toContain('MarkerActionSheet');
    expect(source).toContain('setMarkerActionsOpen(true)');
    expect(source).toContain('if (marker) openEditMarker(marker);');
    expect(source).toContain('if (marker) void startNavigationToMarker(marker);');
  });

  test('marker editor choices scroll horizontally instead of wrapping', () => {
    const source = mapScreenSource();

    expect(source).toContain('ScrollView');
    expect(source).toContain('horizontal');
    expect(source).toContain('showsHorizontalScrollIndicator={false}');
    expect(source).toContain('contentContainerStyle={{ gap: 8, paddingRight: 16 }}');
    expect(source).not.toContain(
      '<View className="flex-row flex-wrap gap-2">\\n        {MAP_PIN_TYPES'
    );
    expect(source).not.toContain(
      '<View className="flex-row flex-wrap gap-2">\\n          {colorOptions'
    );
  });

  test('map search includes offline, cached, or online places without selecting fake saved spots', () => {
    const source = mapScreenSource();
    const geocodingSource = readFileSync(
      join(process.cwd(), 'src/services/maps/geocoding.service.ts'),
      'utf8'
    );

    expect(source).toContain("import('@/services/maps/geocoding.service')");
    expect(source).toContain('GeocodingService.search(query, 6, abortController.signal)');
    expect(source).toContain("result.kind === 'place'");
    expect(source).toContain("'Offline place'");
    expect(source).toContain("'Cached place'");
    expect(source).toContain("'Online place'");
    expect(geocodingSource).toContain("kind: 'place'");
    expect(geocodingSource).toContain("placeSource: 'online'");
    expect(geocodingSource).toContain("placeSource: 'cached'");
    expect(geocodingSource).toContain('OfflinePlaceIndexService.indexPhotonResults(results)');
  });

  test('map routing stays usable without native road graphs', () => {
    const mapSource = mapScreenSource();
    const routingSource = readFileSync(
      join(process.cwd(), 'src/services/maps/offline-routing.service.ts'),
      'utf8'
    );
    const nativeRoutingSource = readFileSync(
      join(
        process.cwd(),
        'modules/ark-routing/android/src/main/java/expo/modules/arkrouting/ArkRoutingModule.kt'
      ),
      'utf8'
    );

    expect(mapSource).toContain('SavedRouteRow');
    expect(mapSource).toContain("session.route.routingMode === 'direct'");
    expect(mapSource).toContain('Direct line');
    expect(mapSource).toContain('routeFallbackLabel(session.route)');
    expect(mapSource).toContain('routing engine unavailable');
    expect(routingSource).toContain('routingFallbackReason');
    expect(routingSource).toContain('navigation_graph_missing');
    expect(mapSource).not.toContain('install a dev build for turn-by-turn');
    expect(routingSource).toContain('buildDirectRoute');
    expect(routingSource).toContain("routingMode: 'direct'");
    expect(routingSource).toContain("routingMode: 'routed'");
    expect(routingSource).toContain('routeSegmentProgress');
    expect(routingSource).toContain('Valhalla native routing engine could not be loaded');
    expect(nativeRoutingSource).toContain('Valhalla routing engine library is missing');
    expect(nativeRoutingSource).toContain('"format": "json",\n        "shape_format": "polyline6"');
    expect(nativeRoutingSource).toContain('extractValhallaError(root)');
    expect(nativeRoutingSource).toContain('parseOsrmRoute(routes.getJSONObject(0))');
    expect(nativeRoutingSource).not.toContain('"format": "json"\n        "shape_format"');
    expect(nativeRoutingSource).not.toContain('Install a development build');
  });

  test('offline map and navigation downloads recover from stalled progress', () => {
    const mapDownloadSource = readFileSync(
      join(process.cwd(), 'src/services/maps/offline-map.service.ts'),
      'utf8'
    );
    const routingDownloadSource = readFileSync(
      join(process.cwd(), 'src/services/maps/offline-routing.service.ts'),
      'utf8'
    );

    expect(mapDownloadSource).toContain('const DOWNLOAD_STALL_TIMEOUT_MS = 30_000');
    expect(mapDownloadSource).toContain('const MAX_STALL_RESTARTS = 1');
    expect(mapDownloadSource).toContain('downloadWatchdogs');
    expect(mapDownloadSource).toContain('scheduleDownloadWatchdog(region.id, pack.id');
    expect(mapDownloadSource).toContain('handleDownloadStall');
    expect(mapDownloadSource).toContain(
      "this.notifyRegionDownload(regionId, 'failed', stalledProgress)"
    );
    expect(routingDownloadSource).toContain('const DOWNLOAD_STALL_TIMEOUT_MS = 30_000');
    expect(routingDownloadSource).toContain('RoutingDownloadStalledError');
    expect(routingDownloadSource).toContain('download?.cancelAsync()');
    expect(routingDownloadSource).toContain('attempt < MAX_STALL_RESTARTS');
    expect(routingDownloadSource).toContain('Routing graph download stalled for 30 seconds');
    expect(routingDownloadSource).toContain('DownloadNotificationService.terminal');
  });

  test('chat uses a floating split composer that follows the keyboard', () => {
    const source = chatDetailSource();

    expect(source).toContain('keyboardDidShow');
    expect(source).toContain('keyboardDidHide');
    expect(source).toContain('keyboardOffset');
    expect(source).toContain('ChatInput');
    expect(source).toContain('AnimatedPressable');
    expect(source).toContain('detachedPlusStyle');
    expect(source).toContain('embeddedPlusStyle');
    expect(source).toContain('keyboardOffset.value = withTiming(measuredOffset');
    expect(source).toContain('translateY: -keyboardOffset.value');
    expect(source).toContain('COMPOSER_BOTTOM_GAP');
    expect(source).toContain('DETACHED_PLUS_SIZE = COMPOSER_HEIGHT');
    expect(source).toContain('backgroundColor: colors.card');
    expect(source).toContain('borderColor: colors.border');
    expect(source).toContain('placeholderTextColor={colors.mutedForeground}');
    expect(source).toContain("textAlignVertical={inputExpanded ? 'top' : 'center'}");
    expect(source).toContain('citationLinks={citationLinks}');
    expect(source).toContain('onLinkPress={openSource}');
    expect(source).toContain('EMPTY_THREAD_PROMPTS');
    expect(source).toContain('pendingUserMessage');
    expect(source).not.toContain('.reverse()');
    expect(source).not.toContain('useBottomTabBarHeight');
    expect(source).not.toContain('marginBottom: keyboardOffset');
    expect(source).not.toContain('ArkKeyboardStickyView');
    expect(source).not.toContain('ArkKeyboardAvoidingView');
    expect(source).not.toContain('KeyboardAvoidingView');
    expect(source).not.toContain('keyboardInset');
    expect(source).toContain('modelChoiceDirtyRef');
    expect(source).toContain('if (!threadId && modelChoiceDirtyRef.current) return;');
    expect(source).toContain('className="h-9 w-9 rounded-full"');
  });

  test('chat voice input works around native VAD arguments and streams spoken responses', () => {
    const chat = chatDetailSource();
    const voiceRuntime = readFileSync(
      join(process.cwd(), 'src/services/ai/voice-runtime.service.ts'),
      'utf8'
    );
    const vad = readFileSync(join(process.cwd(), 'src/hooks/use-ark-voice-activity.ts'), 'utf8');
    const tts = readFileSync(join(process.cwd(), 'src/hooks/use-ark-text-to-speech.ts'), 'utf8');
    const recorder = readFileSync(
      join(process.cwd(), 'src/services/audio/speech-recording.service.ts'),
      'utf8'
    );

    expect(chat).toContain('useArkVoiceActivity');
    expect(chat).toContain('useArkSpeechToText');
    expect(voiceRuntime).toContain('WHISPER_TINY_EN');
    expect(chat).toContain('speechToText.transcribe(speechWaveform, {})');
    expect(chat).toContain('0.18 * sampleRate');
    expect(chat).toContain('SpeechRecordingService.stop()');
    expect(chat).toContain('voiceProgress');
    expect(chat).toContain('splitProgress');
    expect(chat).toContain('keyboardProgress.value');
    expect(chat).toContain(
      'waveformSamples.value = [...waveformSamples.value.slice(1), nextLevel]'
    );
    expect(chat).toContain('VoiceWaveform');
    expect(chat).not.toContain('withRepeat(withTiming');
    expect(chat).toContain('cancelVoiceRecording');
    expect(chat).toContain('Read aloud');
    expect(recorder).toContain('AudioRecorder');
    expect(recorder).toContain('sampleRate: SPEECH_SAMPLE_RATE');
    expect(recorder).toContain('buffer.getChannelData(0).slice()');
    expect(recorder).toContain('* 8');
    expect(vad).toContain('nativeModule.generate(waveform, 0)');
    expect(vad).not.toContain('moduleRef.current?.delete()');
    expect(tts).toContain('moduleInstance.streamInsert');
    expect(tts).toContain('for await (const waveform of moduleInstance.stream');
    expect(tts).not.toContain('moduleInstance.forward(normalized');
    expect(tts).not.toContain('moduleRef.current?.delete()');
  });

  test('reader TTS controls distinguish preparing from active playback', () => {
    const tts = readFileSync(join(process.cwd(), 'src/hooks/use-ark-text-to-speech.ts'), 'utf8');
    const contentReader = readFileSync(join(appDir, 'content/reader.tsx'), 'utf8');
    const contentDetail = readFileSync(join(appDir, 'content/[id].tsx'), 'utf8');
    const documentDetail = readFileSync(join(appDir, 'documents/[id].tsx'), 'utf8');
    const webReader = readFileSync(join(appDir, 'content/web-reader.tsx'), 'utf8');
    const chat = chatDetailSource();

    expect(tts).toContain('const isPreparing = isGenerating && !isPlaying;');
    expect(tts).toContain('isPreparing,');
    expect(contentReader).toContain('const readerSpeechPreparing =');
    expect(contentReader).toContain('!reader.speechPlayback.isPlaying;');
    expect(contentReader).toContain('accessibilityLabel="Chapters"');
    expect(contentReader).toContain('accessibilityLabel="Reader actions"');
    expect(chat).toContain('speechPlayback.isPreparing');
    for (const source of [contentDetail, documentDetail, webReader]) {
      expect(source).toContain('speechPlayback.isPreparing');
      expect(source).toContain('!speechPlayback.isPlaying');
      expect(source).not.toContain('disabled={speechPlayback.isGenerating}');
      expect(source).not.toContain('speechPlayback.isGenerating ? (');
    }
    expect(contentReader).toContain(
      "speechPreparing ? 'Preparing voice' : readerSpeaking ? 'Stop reading' : 'Read aloud'"
    );
    expect(documentDetail).toContain(
      "speechPreparing ? 'Preparing voice' : readerSpeaking ? 'Stop reading' : 'Read aloud'"
    );
    expect(documentDetail).toContain('disabled={busy && !readerSpeaking}');
    expect(contentDetail).toContain('speechDisabled={!zimArticle && !zimSpeaking}');
    expect(webReader).toContain('disabled={!article && !speaking}');
  });

  test('document detail keeps secondary actions in a sheet', () => {
    const documentDetail = readFileSync(join(appDir, 'documents/[id].tsx'), 'utf8');

    expect(documentDetail).toContain('function DocumentActionsSheet');
    expect(documentDetail).toContain('title="Document Actions"');
    expect(documentDetail).toContain('accessibilityLabel="Document actions"');
    expect(documentDetail).toContain('MoreHorizontal');
    expect(documentDetail).toContain('Read aloud');
    expect(documentDetail).toContain('Rename');
    expect(documentDetail).toContain('Delete document');
    expect(documentDetail).toContain('Open file');
    expect(documentDetail).not.toContain('accessibilityLabel="Delete document"');
    expect(documentDetail).not.toContain('<Text variant="large">Name</Text>');
  });

  test('zim article actions are grouped and exportable', () => {
    const contentDetail = readFileSync(join(appDir, 'content/[id].tsx'), 'utf8');

    expect(contentDetail).toContain('function ZimArticleActionsSheet');
    expect(contentDetail).toContain('title="Article Actions"');
    expect(contentDetail).toContain('accessibilityLabel="Article actions"');
    expect(contentDetail).toContain('zimArticlePlainText');
    expect(contentDetail).toContain('FileSystem.writeAsStringAsync');
    expect(contentDetail).toContain('Sharing.shareAsync');
    expect(contentDetail).toContain("mimeType: 'text/plain'");
    expect(contentDetail).toContain('Share article');
    expect(contentDetail).toContain('MoreVertical');
    expect(contentDetail).not.toContain('onPress={() => void handleSpeakZimArticle()}');
  });

  test('upright level draws its tube from the measured width', () => {
    const source = readFileSync(join(appDir, 'tools/level.tsx'), 'utf8');

    expect(source).toContain('const tubeCenter = tubeWidth / 2');
    expect(source).toContain('width={tubeWidth}');
    expect(source).toContain('width={tubeWidth - tubeInset * 2}');
    expect(source).not.toContain('viewBox="0 0 360 120"');
  });

  test('settings and the app bar share the animated vault lock sheet', () => {
    const appShell = readFileSync(
      join(process.cwd(), 'src/components/layout/app-shell.tsx'),
      'utf8'
    );
    const settings = readFileSync(join(appDir, '(tabs)/settings.tsx'), 'utf8');
    const lockSheet = readFileSync(
      join(process.cwd(), 'src/components/security/vault-lock-sheet.tsx'),
      'utf8'
    );

    expect(appShell).toContain('<VaultLockSheet');
    expect(appShell).toContain('vaultProtectionEnabled');
    expect(appShell).toContain('!!state.vault?.isInitialized');
    expect(appShell).toContain('{vaultProtectionEnabled ? (');
    expect(appShell).toContain("accessibilityLabel={unlocked ? 'Lock vault' : 'Unlock vault'}");
    expect(appShell).toContain("router.push('/(tabs)/notes')");
    expect(settings).toContain('<VaultLockSheet');
    expect(lockSheet).toContain('Animated.sequence');
    expect(lockSheet).toContain('VaultService.lock()');
  });

  test('map keeps network enabled while native offline packs are active', () => {
    const source = mapScreenSource();

    expect(source).toContain('hasActiveMapDownloads');
    expect(source).toContain('mapCanUseNetwork');
    expect(source).toContain("region.status === 'downloading' || region.status === 'queued'");
    expect(source).toContain(
      'MapService.setNetworkConnected(maplibre, mapCanUseNetwork || hasActiveMapDownloads)'
    );
    expect(source).not.toContain(
      'MapService.setNetworkConnected(maplibre, false);\n      setBusy(null);'
    );
  });

  test('downloaded maps open centered on the downloaded region', () => {
    const source = mapScreenSource();

    expect(source).toContain('primaryDownloadedRegion');
    expect(source).toContain('mapInitialCenter');
    expect(source).toContain('regionInitialZoom(primaryDownloadedRegion)');
    expect(source).toContain('autoFocusedRegionIdRef');
    expect(source).toContain('fitRegion(primaryDownloadedRegion)');
    expect(source).toContain('pendingCameraActionRef');
  });

  test('missing map prompts can use visible MapLibre bounds, not just the center', () => {
    const source = mapScreenSource();

    expect(source).toContain('viewedBounds');
    expect(source).toContain('normalizeMapEventBounds(event.nativeEvent.bounds)');
    expect(source).toContain('MapPresetsService.getRegionsForBoundingBox(viewedBounds)');
  });

  test('map can download the current visible bounds as a custom offline region', () => {
    const source = mapScreenSource();
    const offlineMapSource = readFileSync(
      join(process.cwd(), 'src/services/maps/offline-map.service.ts'),
      'utf8'
    );

    expect(source).toContain('downloadVisibleArea');
    expect(source).toContain('OfflineMapService.createRegionFromViewport');
    expect(source).toContain("busyKey === 'download:visible-area'");
    expect(source).toContain('Download visible area');
    expect(source).toContain("activePanel === 'offline'");
    expect(source).toContain('OfflineMapsPanel');
    expect(offlineMapSource).toContain('createRegionFromViewport');
    expect(offlineMapSource).toContain('visibleAreaName');
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
    const source = mapScreenSource();

    expect(source).toContain('MapLocationService.resolveUserLocation');
    expect(source).not.toContain("import * as Location from 'expo-location'");
    expect(source).not.toContain('Location.requestForegroundPermissionsAsync');
    expect(source).not.toContain('Location.getCurrentPositionAsync');
  });

  test('map catalog cards do not invite unsupported future pack downloads', () => {
    const source = mapScreenSource();

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

  test('map edit overlays use shared bottom sheets while fullscreen escapes native tabs', () => {
    const source = mapScreenSource();

    expect(source).toContain('ArkBottomSheet');
    expect(source).toContain("snapPoints={['58%', '92%']}");
    expect(source).toContain('<Modal');
    expect(source).toContain('presentationStyle="fullScreen"');
    expect(source).toContain('navigationBarTranslucent');
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
    const chatThread = chatDetailSource();
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
