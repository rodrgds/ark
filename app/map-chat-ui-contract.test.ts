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
    expect(source).toContain('if (isSearchActive || Date.now() < suppressLongPressUntilRef.current)');
    expect(source).toContain('onDismissSearch();');
    expect(source).toContain('return;');
  });

  test('chat resizes its scroll area with the keyboard instead of floating the composer', () => {
    const source = readFileSync(join(appDir, '(tabs)/chat.tsx'), 'utf8');

    expect(source).toContain('<KeyboardAvoidingView');
    expect(source).toContain('ref={listRef}');
    expect(source).toContain('ListFooterComponent={sending ? <StreamingBubble');
    expect(source).toContain('onContentSizeChange={() => listRef.current?.scrollToEnd');
    expect(source).not.toContain('useAnimatedKeyboard');
    expect(source).not.toContain('translateY');
  });
});
