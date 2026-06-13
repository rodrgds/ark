import { describe, expect, test } from 'bun:test';
import {
  getMapPackFormatLabel,
  getUnsupportedMapPackReason,
  isMapPackDownloadSupported,
} from '@/services/maps/map-pack-format';

describe('map pack format support', () => {
  test('allows default MapLibre offline packs', () => {
    expect(isMapPackDownloadSupported({})).toBe(true);
    expect(isMapPackDownloadSupported({ packFormat: 'maplibre_offline_pack' })).toBe(true);
    expect(getUnsupportedMapPackReason({ packFormat: 'maplibre_offline_pack' })).toBeNull();
  });

  test('explains future pack formats without treating them as native downloads', () => {
    expect(isMapPackDownloadSupported({ packFormat: 'pmtiles' })).toBe(false);
    expect(getMapPackFormatLabel('pmtiles')).toBe('PMTiles');
    expect(getUnsupportedMapPackReason({ packFormat: 'pmtiles' })).toContain(
      'this app version can only download MapLibre offline packs'
    );
    expect(getUnsupportedMapPackReason({ packFormat: 'mbtiles' })).toContain('MBTiles');
    expect(getUnsupportedMapPackReason({ packFormat: 'vector_tiles' })).toContain(
      'Vector tile pack'
    );
  });
});
