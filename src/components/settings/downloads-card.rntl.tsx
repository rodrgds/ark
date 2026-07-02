import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { DownloadRow } from '@/types/downloads';
import type { MapRegion } from '@/types/maps';

installCommonRntlMocks(mock);

mock.module('@/services/files/filesystem.service', () => ({
  FileSystemService: {
    formatBytes: (bytes: number) => {
      if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
      if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${bytes} B`;
    },
    getLowStorageWarning: () => null,
  },
}));

const { fireEvent, render, within } = await import('@testing-library/react-native');
const { DownloadsCard } = await import('@/components/settings/downloads-card');

type DownloadsCardProps = React.ComponentProps<typeof DownloadsCard>;

const now = new Date('2026-07-01T12:00:00Z').getTime();

const failedGuideDownload: DownloadRow = {
  id: 'download-guide-1',
  kind: 'guide',
  title: 'Water guide',
  sourceUrl: 'https://example.com/water.pdf',
  localUri: 'file:///downloads/water.pdf',
  status: 'failed',
  progress: 0.42,
  downloadedBytes: 42 * 1024 * 1024,
  totalBytes: 100 * 1024 * 1024,
  error: 'Network interrupted',
  createdAt: now - 1_000,
  updatedAt: now,
};

const routingRegion: MapRegion = {
  id: 'pt-north-centre',
  name: 'North and Centre Portugal',
  provider: 'ark',
  manifestRegionId: 'pt-north-centre',
  manifestVersion: 1,
  styleUrl: null,
  tileUrlTemplate: null,
  packFormat: 'pmtiles',
  packUrl: 'https://example.com/north-centre.pmtiles',
  dataVersion: '2026-06',
  checksumSha256: null,
  checksumSha256Url: null,
  regionUpdatedAt: null,
  north: 42,
  south: 39,
  east: -6,
  west: -9,
  minZoom: 6,
  maxZoom: 14,
  offlinePackId: null,
  status: 'downloaded',
  progress: 1,
  estimatedSizeMb: 450,
  sizeBytes: 450 * 1024 * 1024,
  routingPackUrl: 'https://example.com/pt-north-centre-routing.tar',
  routingGraphUri: null,
  routingStatus: 'failed',
  routingProgress: 0.18,
  routingSizeBytes: 220 * 1024 * 1024,
  routingDataVersion: 'routing-v1',
  routingChecksumSha256: 'sha256',
  createdAt: now - 2_000,
  updatedAt: now,
};

const toggleWifiOnlyDownloads = mock(async () => undefined);
const batchAction = mock(async (_action: string) => undefined);
const retryDownload = mock(async (_download: DownloadRow) => undefined);
const downloadAction = mock(async (_download: DownloadRow, _action: string) => undefined);
const clearSelectedResource = mock(() => undefined);
const deleteMapRegion = mock((_region: MapRegion) => undefined);
const mapRegionAction = mock(async (_region: MapRegion, _action: string) => undefined);
const retryRoutingDownload = mock(async (_region: MapRegion) => undefined);

function renderDownloadsCard(props: Partial<DownloadsCardProps> = {}) {
  return render(
    <DownloadsCard
      downloads={[failedGuideDownload]}
      mapRegions={[routingRegion]}
      storage={null}
      wifiOnlyDownloadsEnabled={true}
      busy={null}
      onToggleWifiOnlyDownloads={toggleWifiOnlyDownloads}
      onBatchAction={batchAction as DownloadsCardProps['onBatchAction']}
      onRetryDownload={retryDownload}
      onDownloadAction={downloadAction as DownloadsCardProps['onDownloadAction']}
      onClearSelectedResource={clearSelectedResource}
      onDeleteMapRegion={deleteMapRegion}
      onMapRegionAction={mapRegionAction as DownloadsCardProps['onMapRegionAction']}
      onRetryRoutingDownload={retryRoutingDownload}
      {...props}
    />
  );
}

describe('DownloadsCard', () => {
  beforeEach(() => {
    toggleWifiOnlyDownloads.mockClear();
    batchAction.mockClear();
    retryDownload.mockClear();
    downloadAction.mockClear();
    clearSelectedResource.mockClear();
    deleteMapRegion.mockClear();
    mapRegionAction.mockClear();
    retryRoutingDownload.mockClear();
  });

  test('opens a notification-selected failed download in the recovery sheet', async () => {
    const view = await renderDownloadsCard({ selectedResourceId: failedGuideDownload.id });

    const sheet = await view.findByLabelText('Water guide');

    expect(within(sheet).getByText('guide · failed')).toBeOnTheScreen();
    expect(within(sheet).getByText('42%')).toBeOnTheScreen();
    expect(within(sheet).getByText('42 MB')).toBeOnTheScreen();
    expect(within(sheet).getByText('100 MB')).toBeOnTheScreen();
    expect(within(sheet).getByText('Network interrupted')).toBeOnTheScreen();

    await fireEvent.press(within(sheet).getByText('Retry'));
    expect(retryDownload).toHaveBeenCalledWith(failedGuideDownload);

    await fireEvent.press(within(sheet).getByText('Cancel'));
    expect(downloadAction).toHaveBeenCalledWith(failedGuideDownload, 'cancel');
  });

  test('opens a notification-selected routing graph in the recovery sheet', async () => {
    const view = await renderDownloadsCard({ selectedResourceId: `routing-${routingRegion.id}` });

    const sheet = await view.findByLabelText('North and Centre Portugal navigation');

    expect(within(sheet).getByText('Navigation graph')).toBeOnTheScreen();
    expect(within(sheet).getByText('failed')).toBeOnTheScreen();
    expect(within(sheet).getByText('18%')).toBeOnTheScreen();
    expect(within(sheet).getByText('220 MB')).toBeOnTheScreen();

    await fireEvent.press(within(sheet).getByText('Retry navigation'));

    expect(retryRoutingDownload).toHaveBeenCalledWith(routingRegion);
    expect(deleteMapRegion).not.toHaveBeenCalled();
  });
});
