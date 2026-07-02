import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { FileSystemService } from '@/services/files/filesystem.service';
import { getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { formatMapRegionStorage, summarizeMapRegionStorage } from '@/services/maps/map-storage';
import type { DownloadRow } from '@/types/downloads';
import type { MapRegion } from '@/types/maps';
import {
  Download,
  Info,
  Map as MapIcon,
  Pause,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wifi,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

export type DownloadBatchAction = 'pause-all' | 'resume-all' | 'retry-failed' | 'clean-completed';
export type DownloadRowAction = 'pause' | 'resume' | 'cancel';

type DownloadsCardProps = {
  downloads: DownloadRow[];
  mapRegions: MapRegion[];
  storage: Awaited<ReturnType<typeof FileSystemService.getStorageSummary>> | null;
  wifiOnlyDownloadsEnabled: boolean;
  busy: string | null;
  selectedResourceId?: string | null;
  onToggleWifiOnlyDownloads: () => Promise<void>;
  onBatchAction: (action: DownloadBatchAction) => Promise<void>;
  onRetryDownload: (download: DownloadRow) => Promise<void>;
  onDownloadAction: (download: DownloadRow, action: DownloadRowAction) => Promise<void>;
  onClearSelectedResource?: () => void;
  onDeleteMapRegion: (region: MapRegion) => void;
  onMapRegionAction: (region: MapRegion, action: 'pause' | 'retry') => Promise<void>;
  onRetryRoutingDownload: (region: MapRegion) => Promise<void>;
};

function DownloadRowView({
  download,
  busy,
  onRetry,
  onOpenDetails,
}: {
  download: DownloadRow;
  busy: boolean;
  onRetry: () => Promise<void>;
  onOpenDetails: () => void;
}) {
  const canRetry = download.status === 'failed' && !!download.sourceUrl && !!download.localUri;
  return (
    <View className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1}>{download.title}</Text>
          <Text variant="small" className="text-muted-foreground capitalize">
            {download.kind} · {download.status.replace('_', ' ')}
          </Text>
        </View>
        <Text variant="small" className="text-muted-foreground">
          {Math.round((download.progress ?? 0) * 100)}%
        </Text>
      </View>
      <Progress value={download.progress ?? 0} />
      {download.totalBytes || download.downloadedBytes ? (
        <Text variant="small" className="text-muted-foreground">
          {download.downloadedBytes
            ? FileSystemService.formatBytes(download.downloadedBytes)
            : '0 B'}
          {download.totalBytes ? ` of ${FileSystemService.formatBytes(download.totalBytes)}` : ''}
        </Text>
      ) : null}
      {download.error ? <Text className="text-destructive text-sm">{download.error}</Text> : null}
      {canRetry ? (
        <View className="flex-row flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onPress={() => void onRetry()}>
            {busy ? <ActivityIndicator /> : <Icon as={RefreshCw} className="size-4" />}
            <Text>Retry</Text>
          </Button>
          <Button size="sm" variant="ghost" onPress={onOpenDetails}>
            <Icon as={Info} className="size-4" />
            <Text>Details</Text>
          </Button>
        </View>
      ) : (
        <Button size="sm" variant="ghost" onPress={onOpenDetails} className="self-start">
          <Icon as={Info} className="size-4" />
          <Text>Details</Text>
        </Button>
      )}
    </View>
  );
}

function MapRegionRow({
  region,
  busy,
  onDelete,
  onAction,
  onOpenDetails,
}: {
  region: MapRegion;
  busy: string | null;
  onDelete: (region: MapRegion) => void;
  onAction: (region: MapRegion, action: 'pause' | 'retry') => Promise<void>;
  onOpenDetails: () => void;
}) {
  const isBusy =
    busy === `map-delete-${region.id}` ||
    busy === `map-pause-${region.id}` ||
    busy === `map-retry-${region.id}`;
  const canPause = region.status === 'downloading' || region.status === 'queued';
  const unsupportedReason = getUnsupportedMapPackReason(region);
  const canRetry = !unsupportedReason && (region.status === 'failed' || region.status === 'paused');
  const percent = Math.round((region.progress ?? 0) * 100);
  const statusLabel = region.status.replace('_', ' ');
  const sizeLabel = formatMapRegionStorage(region);
  return (
    <View className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1}>{region.name}</Text>
          <Text variant="small" className="text-muted-foreground">
            Map · {statusLabel}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Icon as={MapIcon} className="text-muted-foreground size-4" />
          <Text variant="small" className="text-muted-foreground">
            {percent}%
          </Text>
        </View>
      </View>
      <Progress value={region.progress ?? 0} />
      <Text variant="small" className="text-muted-foreground">
        {sizeLabel}
      </Text>
      {unsupportedReason ? (
        <Text variant="small" className="text-muted-foreground">
          {unsupportedReason}
        </Text>
      ) : region.status === 'failed' ? (
        <Text variant="small" className="text-destructive">
          Download failed. Retry when you have a connection and enough storage.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {canRetry ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onPress={() => void onAction(region, 'retry')}>
            {busy === `map-retry-${region.id}` ? (
              <ActivityIndicator />
            ) : (
              <Icon as={RotateCcw} className="size-4" />
            )}
            <Text>{region.status === 'paused' ? 'Resume' : 'Retry'}</Text>
          </Button>
        ) : null}
        {canPause ? (
          <Button
            size="sm"
            variant="outline"
            disabled={isBusy}
            onPress={() => void onAction(region, 'pause')}>
            {busy === `map-pause-${region.id}` ? (
              <ActivityIndicator />
            ) : (
              <Icon as={Pause} className="size-4" />
            )}
            <Text>Pause</Text>
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={isBusy} onPress={() => onDelete(region)}>
          {busy === `map-delete-${region.id}` ? (
            <ActivityIndicator />
          ) : (
            <Icon as={Trash2} className="text-destructive size-4" />
          )}
          <Text className="text-destructive">Delete</Text>
        </Button>
        <Button size="sm" variant="ghost" onPress={onOpenDetails}>
          <Icon as={Info} className="size-4" />
          <Text>Details</Text>
        </Button>
      </View>
    </View>
  );
}

type SelectedResource =
  | { type: 'download'; download: DownloadRow }
  | { type: 'map'; region: MapRegion; focus: 'map' | 'routing' };

function matchMapResource(region: MapRegion, id: string) {
  if (region.id === id) return { type: 'map' as const, region, focus: 'map' as const };
  if (`map-${region.id}` === id) return { type: 'map' as const, region, focus: 'map' as const };
  if (`routing-${region.id}` === id)
    return { type: 'map' as const, region, focus: 'routing' as const };
  return null;
}

function resolveSelectedResource(
  id: string | null,
  downloads: DownloadRow[],
  mapRegions: MapRegion[]
): SelectedResource | null {
  if (!id) return null;
  const download = downloads.find((row) => row.id === id);
  if (download) return { type: 'download', download };
  for (const region of mapRegions) {
    const match = matchMapResource(region, id);
    if (match) return match;
  }
  return null;
}

function statusText(status: string) {
  return status.replace(/_/g, ' ');
}

function formatOptionalBytes(bytes?: number | null) {
  return typeof bytes === 'number' && bytes > 0 ? FileSystemService.formatBytes(bytes) : 'Unknown';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-border flex-row justify-between gap-3 border-b px-3 py-2 last:border-b-0">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
      <Text variant="small" className="min-w-0 flex-1 text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function DownloadsCard({
  downloads,
  mapRegions,
  storage,
  wifiOnlyDownloadsEnabled,
  busy,
  selectedResourceId,
  onToggleWifiOnlyDownloads,
  onBatchAction,
  onRetryDownload,
  onDownloadAction,
  onClearSelectedResource,
  onDeleteMapRegion,
  onMapRegionAction,
  onRetryRoutingDownload,
}: DownloadsCardProps) {
  const [openedResourceId, setOpenedResourceId] = React.useState<string | null>(null);
  const activeRows = downloads.filter((download) => download.status !== 'canceled');
  const activeDownloadRows = activeRows.filter((download) =>
    ['queued', 'downloading', 'verifying'].includes(download.status)
  );
  const pausedRows = activeRows.filter((download) => download.status === 'paused');
  const failedRows = activeRows.filter((download) => download.status === 'failed');
  const completedRows = activeRows.filter((download) => download.status === 'completed');
  const mapBytes = mapRegions.reduce((total, region) => total + (region.sizeBytes ?? 0), 0);
  const totalBytes =
    activeRows.reduce((sum, download) => sum + Math.max(0, download.totalBytes ?? 0), 0) + mapBytes;
  const activeMapRegions = mapRegions.filter(
    (region) =>
      ['queued', 'downloading', 'paused', 'failed', 'downloaded'].includes(region.status) ||
      ['queued', 'downloading', 'paused', 'failed', 'ready'].includes(region.routingStatus)
  );
  const activeMapDownloadRows = mapRegions.filter((region) =>
    ['queued', 'downloading'].includes(region.status)
  );
  const pausedMapRows = mapRegions.filter((region) => region.status === 'paused');
  const failedMapRows = mapRegions.filter((region) => region.status === 'failed');
  const mapStorageLabel = summarizeMapRegionStorage(activeMapRegions);
  const lowStorageWarning = storage ? FileSystemService.getLowStorageWarning(storage) : null;
  const batchBusy = busy?.startsWith('downloads-') ?? false;
  const canPauseAll = activeDownloadRows.length > 0 || activeMapDownloadRows.length > 0;
  const canResumeAll = pausedRows.length > 0 || pausedMapRows.length > 0;
  const canRetryFailed = failedRows.length > 0 || failedMapRows.length > 0;
  const canCleanCompleted = completedRows.length > 0;
  const selectedResource = resolveSelectedResource(openedResourceId, activeRows, activeMapRegions);

  React.useEffect(() => {
    if (!selectedResourceId) return;
    setOpenedResourceId(selectedResourceId);
  }, [selectedResourceId]);

  function closeDetails() {
    setOpenedResourceId(null);
    onClearSelectedResource?.();
  }

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Icon as={Download} className="text-primary size-5" />
              <Text variant="large">Downloads</Text>
            </View>
            <Text variant="muted">
              {activeMapRegions.length
                ? `${activeMapRegions.length} map region${
                    activeMapRegions.length === 1 ? '' : 's'
                  } tracked`
                : 'Guides, models, archives, and map regions stored for offline use.'}
            </Text>
            {mapStorageLabel ? (
              <Text variant="small" className="text-muted-foreground">
                Maps {mapStorageLabel}
              </Text>
            ) : null}
          </View>
          {totalBytes > 0 ? (
            <Text variant="small" className="text-muted-foreground">
              {FileSystemService.formatBytes(totalBytes)}
            </Text>
          ) : null}
        </View>
        <View className="border-border bg-muted/20 flex-row items-center justify-between gap-3 rounded-md border px-3 py-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Icon as={Wifi} className="text-primary size-4" />
            <View className="min-w-0 flex-1">
              <Text>Wi-Fi only</Text>
              <Text variant="small" className="text-muted-foreground">
                Hold queued downloads until Wi-Fi is available.
              </Text>
            </View>
          </View>
          <Button
            size="sm"
            variant={wifiOnlyDownloadsEnabled ? 'default' : 'outline'}
            onPress={() => void onToggleWifiOnlyDownloads()}>
            <Text>{wifiOnlyDownloadsEnabled ? 'On' : 'Off'}</Text>
          </Button>
        </View>
        {lowStorageWarning ? (
          <View className="border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2">
            <Text variant="small" className="text-destructive">
              {lowStorageWarning}
            </Text>
          </View>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          <Button
            className="min-w-28 flex-1"
            size="sm"
            variant="outline"
            disabled={batchBusy || !canPauseAll}
            onPress={() => void onBatchAction('pause-all')}>
            {busy === 'downloads-pause-all' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={Pause} className="size-4" />
            )}
            <Text>Pause all</Text>
          </Button>
          <Button
            className="min-w-28 flex-1"
            size="sm"
            variant="outline"
            disabled={batchBusy || !canResumeAll}
            onPress={() => void onBatchAction('resume-all')}>
            {busy === 'downloads-resume-all' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={Download} className="size-4" />
            )}
            <Text>Resume all</Text>
          </Button>
          <Button
            className="min-w-28 flex-1"
            size="sm"
            variant="outline"
            disabled={batchBusy || !canRetryFailed}
            onPress={() => void onBatchAction('retry-failed')}>
            {busy === 'downloads-retry-failed' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={RefreshCw} className="size-4" />
            )}
            <Text>Retry failed</Text>
          </Button>
          <Button
            className="min-w-28 flex-1"
            size="sm"
            variant="outline"
            disabled={batchBusy || !canCleanCompleted}
            onPress={() => void onBatchAction('clean-completed')}>
            {busy === 'downloads-clean-completed' ? (
              <ActivityIndicator />
            ) : (
              <Icon as={Trash2} className="size-4" />
            )}
            <Text>Clean completed</Text>
          </Button>
        </View>
        {activeRows.length || activeMapRegions.length ? (
          <View className="gap-3">
            {activeRows.map((download) => (
              <DownloadRowView
                key={download.id}
                download={download}
                busy={busy === `download-${download.id}`}
                onRetry={() => onRetryDownload(download)}
                onOpenDetails={() => setOpenedResourceId(download.id)}
              />
            ))}
            {activeMapRegions.map((region) => (
              <MapRegionRow
                key={region.id}
                region={region}
                busy={busy}
                onDelete={onDeleteMapRegion}
                onAction={onMapRegionAction}
                onOpenDetails={() => setOpenedResourceId(region.id)}
              />
            ))}
          </View>
        ) : (
          <Text variant="muted">No downloads have been queued yet.</Text>
        )}
      </Card>

      <DownloadDetailsSheet
        resource={selectedResource}
        busy={busy}
        onDismiss={closeDetails}
        onDownloadAction={onDownloadAction}
        onRetryDownload={onRetryDownload}
        onDeleteMapRegion={onDeleteMapRegion}
        onMapRegionAction={onMapRegionAction}
        onRetryRoutingDownload={onRetryRoutingDownload}
      />
    </>
  );
}

function DownloadDetailsSheet({
  resource,
  busy,
  onDismiss,
  onDownloadAction,
  onRetryDownload,
  onDeleteMapRegion,
  onMapRegionAction,
  onRetryRoutingDownload,
}: {
  resource: SelectedResource | null;
  busy: string | null;
  onDismiss: () => void;
  onDownloadAction: (download: DownloadRow, action: DownloadRowAction) => Promise<void>;
  onRetryDownload: (download: DownloadRow) => Promise<void>;
  onDeleteMapRegion: (region: MapRegion) => void;
  onMapRegionAction: (region: MapRegion, action: 'pause' | 'retry') => Promise<void>;
  onRetryRoutingDownload: (region: MapRegion) => Promise<void>;
}) {
  if (!resource) {
    return null;
  }

  if (resource.type === 'download') {
    const { download } = resource;
    const actionBusy = busy === `download-${download.id}`;
    const canPause = download.status === 'queued' || download.status === 'downloading';
    const canResume = download.status === 'paused';
    const canRetry = download.status === 'failed' && !!download.sourceUrl && !!download.localUri;
    const canCancel = download.status !== 'completed' && download.status !== 'canceled';
    return (
      <ArkBottomSheet
        visible
        title={download.title}
        description={`${download.kind} · ${statusText(download.status)}`}
        onDismiss={onDismiss}
        scrollable
        maxDynamicContentSize={560}>
        <View className="gap-3">
          <Progress value={download.progress ?? 0} />
          <View className="border-border overflow-hidden rounded-md border">
            <DetailRow label="Progress" value={`${Math.round((download.progress ?? 0) * 100)}%`} />
            <DetailRow label="Downloaded" value={formatOptionalBytes(download.downloadedBytes)} />
            <DetailRow label="Total" value={formatOptionalBytes(download.totalBytes)} />
            <DetailRow label="Updated" value={new Date(download.updatedAt).toLocaleString()} />
          </View>
          {download.error ? (
            <Text className="text-destructive text-sm">{download.error}</Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {canRetry || canResume ? (
              <Button
                className="min-w-28 flex-1"
                variant="outline"
                disabled={actionBusy}
                onPress={() =>
                  void (canResume
                    ? onDownloadAction(download, 'resume')
                    : onRetryDownload(download))
                }>
                {actionBusy ? <ActivityIndicator /> : <Icon as={RefreshCw} className="size-4" />}
                <Text>{canResume ? 'Resume' : 'Retry'}</Text>
              </Button>
            ) : null}
            {canPause ? (
              <Button
                className="min-w-28 flex-1"
                variant="outline"
                disabled={actionBusy}
                onPress={() => void onDownloadAction(download, 'pause')}>
                {actionBusy ? <ActivityIndicator /> : <Icon as={Pause} className="size-4" />}
                <Text>Pause</Text>
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                className="min-w-28 flex-1"
                variant="ghost"
                disabled={actionBusy}
                onPress={() => void onDownloadAction(download, 'cancel')}>
                {actionBusy ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={Trash2} className="text-destructive size-4" />
                )}
                <Text className="text-destructive">Cancel</Text>
              </Button>
            ) : null}
          </View>
        </View>
      </ArkBottomSheet>
    );
  }

  const { region, focus } = resource;
  const isRouting = focus === 'routing';
  const status = isRouting ? region.routingStatus : region.status;
  const progress = isRouting ? region.routingProgress : region.progress;
  const isBusy =
    busy === `map-pause-${region.id}` ||
    busy === `map-retry-${region.id}` ||
    busy === `map-delete-${region.id}`;
  const canPause = !isRouting && (region.status === 'queued' || region.status === 'downloading');
  const canRetry = !isRouting && (region.status === 'paused' || region.status === 'failed');
  const canDelete = !isRouting;
  const routingRetryBusy = busy === `routing-retry-${region.id}`;
  const canRetryRouting =
    isRouting &&
    Boolean(region.routingPackUrl) &&
    (region.routingStatus === 'failed' ||
      region.routingStatus === 'paused' ||
      region.routingStatus === 'not_downloaded');
  return (
    <ArkBottomSheet
      visible
      title={isRouting ? `${region.name} navigation` : region.name}
      description={isRouting ? 'Navigation graph' : 'Offline map region'}
      onDismiss={onDismiss}
      scrollable
      maxDynamicContentSize={560}>
      <View className="gap-3">
        <Progress value={progress ?? 0} />
        <View className="border-border overflow-hidden rounded-md border">
          <DetailRow label="Status" value={statusText(status)} />
          <DetailRow label="Progress" value={`${Math.round((progress ?? 0) * 100)}%`} />
          <DetailRow
            label={isRouting ? 'Navigation size' : 'Map size'}
            value={
              isRouting
                ? formatOptionalBytes(region.routingSizeBytes)
                : formatMapRegionStorage(region)
            }
          />
          <DetailRow label="Updated" value={new Date(region.updatedAt).toLocaleString()} />
        </View>
        {isRouting && !canRetryRouting && region.routingStatus !== 'ready' ? (
          <Text variant="muted">
            Navigation is already queued or downloading. Leave Ark open until the terminal
            notification arrives.
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          {canRetryRouting ? (
            <Button
              className="min-w-28 flex-1"
              variant="outline"
              disabled={routingRetryBusy}
              onPress={() => void onRetryRoutingDownload(region)}>
              {routingRetryBusy ? (
                <ActivityIndicator />
              ) : (
                <Icon as={RefreshCw} className="size-4" />
              )}
              <Text>Retry navigation</Text>
            </Button>
          ) : null}
          {canRetry ? (
            <Button
              className="min-w-28 flex-1"
              variant="outline"
              disabled={isBusy}
              onPress={() => void onMapRegionAction(region, 'retry')}>
              {busy === `map-retry-${region.id}` ? (
                <ActivityIndicator />
              ) : (
                <Icon as={RefreshCw} className="size-4" />
              )}
              <Text>{region.status === 'paused' ? 'Resume' : 'Retry'}</Text>
            </Button>
          ) : null}
          {canPause ? (
            <Button
              className="min-w-28 flex-1"
              variant="outline"
              disabled={isBusy}
              onPress={() => void onMapRegionAction(region, 'pause')}>
              {busy === `map-pause-${region.id}` ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Pause} className="size-4" />
              )}
              <Text>Pause</Text>
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              className="min-w-28 flex-1"
              variant="ghost"
              disabled={isBusy}
              onPress={() => onDeleteMapRegion(region)}>
              {busy === `map-delete-${region.id}` ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Trash2} className="text-destructive size-4" />
              )}
              <Text className="text-destructive">Delete</Text>
            </Button>
          ) : null}
        </View>
      </View>
    </ArkBottomSheet>
  );
}
