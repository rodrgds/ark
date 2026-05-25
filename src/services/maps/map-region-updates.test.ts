import { describe, expect, test } from 'bun:test';
import { getMapRegionUpdateState } from '@/services/maps/map-region-updates';

describe('map region update detection', () => {
  test('detects newer downloaded region data from checksums and data versions', () => {
    const state = getMapRegionUpdateState(
      {
        checksumSha256: 'old-checksum',
        dataVersion: '2026-04',
        manifestVersion: 4,
        regionUpdatedAt: '2026-04-01',
        status: 'downloaded',
      },
      {
        checksumSha256: 'new-checksum',
        dataVersion: '2026-05',
        updatedAt: '2026-05-01',
      },
      5
    );

    expect(state.available).toBe(true);
    expect(state.reasons).toContain('checksum');
    expect(state.reasons).toContain('data_version');
    expect(state.reasons).toContain('region_updated_at');
  });

  test('does not flag queued or unverifiable regions as updateable', () => {
    expect(
      getMapRegionUpdateState(
        {
          checksumSha256: 'old-checksum',
          dataVersion: '2026-04',
          manifestVersion: 4,
          regionUpdatedAt: '2026-04-01',
          status: 'queued',
        },
        {
          checksumSha256: 'new-checksum',
          dataVersion: '2026-05',
          updatedAt: '2026-05-01',
        },
        5
      ).available
    ).toBe(false);

    expect(
      getMapRegionUpdateState(
        {
          checksumSha256: null,
          dataVersion: null,
          manifestVersion: null,
          regionUpdatedAt: null,
          status: 'downloaded',
        },
        {
          checksumSha256: 'new-checksum',
          dataVersion: '2026-05',
          updatedAt: '2026-05-01',
        },
        5
      ).available
    ).toBe(false);
  });
});
