import { Screen } from '@/components/layout/screen';
import { VaultLockSheet } from '@/components/security/vault-lock-sheet';
import { AboutSection } from '@/components/settings/about-section';
import { AiSection } from '@/components/settings/ai-section';
import { AppearanceSection } from '@/components/settings/appearance-section';
import { BackupSection } from '@/components/settings/backup-section';
import { DiagnosticsCard } from '@/components/settings/diagnostics-card';
import { DownloadsCard, type DownloadBatchAction } from '@/components/settings/downloads-card';
import { OfflineMapsCard } from '@/components/settings/offline-maps-card';
import { SecuritySection } from '@/components/settings/security-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { confirmDestructive, showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { BATTERY_POLL_INTERVALS_MS } from '@/constants/battery';
import { BackupService } from '@/services/backup/backup.service';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import type { EmbeddingModelConfig } from '@/services/ai/embedding-models';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { DiagnosticsService } from '@/services/sensors/diagnostics.service';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import { useAuthStore } from '@/stores/auth-store';
import type { ContentPack } from '@/types/content';
import type { DownloadRow } from '@/types/downloads';
import type { MapRegion } from '@/types/maps';
import type { DiagnosticReport } from '@/types/sensors';
import { router, useLocalSearchParams } from 'expo-router';
import { HardDrive, Trash2, Upload } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

type SettingsTab = 'appearance' | 'security' | 'ai' | 'maps' | 'advanced';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'security', label: 'Security' },
  { value: 'ai', label: 'AI' },
  { value: 'maps', label: 'Offline Maps' },
  { value: 'advanced', label: 'Advanced' },
];

export default function SettingsScreen() {
  const { tab } = useLocalSearchParams<{
    tab?: SettingsTab | 'downloads' | 'storage' | 'internals';
  }>();
  const preference = useThemeStore((state) => state.preference);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const setPreference = useThemeStore((state) => state.setPreference);
  const vaultUnlocked = useAuthStore((state) => state.unlocked);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('appearance');
  const [autoLock, setAutoLock] = React.useState(5);
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [batteryReduceModeEnabled, setBatteryReduceModeEnabled] = React.useState(false);
  const [wifiOnlyDownloadsEnabled, setWifiOnlyDownloadsEnabled] = React.useState(false);
  const [availableModels, setAvailableModels] = React.useState<ContentPack[]>([]);
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [embeddingModels, setEmbeddingModels] = React.useState<EmbeddingModelConfig[]>([]);
  const [activeEmbeddingModel, setActiveEmbeddingModel] =
    React.useState<EmbeddingModelConfig | null>(null);
  const [embeddingIndexStatus, setEmbeddingIndexStatus] = React.useState<Awaited<
    ReturnType<typeof ModelManagerService.getEmbeddingIndexStatus>
  > | null>(null);
  const [storage, setStorage] = React.useState<Awaited<
    ReturnType<typeof FileSystemService.getStorageSummary>
  > | null>(null);
  const [downloads, setDownloads] = React.useState<DownloadRow[]>([]);
  const [mapRegions, setMapRegions] = React.useState<MapRegion[]>([]);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticReport | null>(null);
  const [modelStatus, setModelStatus] = React.useState<Awaited<
    ReturnType<typeof ModelManagerService.getStatus>
  > | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [aiMessage, setAiMessage] = React.useState<string | null>(null);
  const [backupMessage, setBackupMessage] = React.useState<string | null>(null);
  const [lockSheetOpen, setLockSheetOpen] = React.useState(false);
  const buildTapTimesRef = React.useRef<number[]>([]);

  const chatModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'chat'),
    [availableModels]
  );
  async function load() {
    await OfflineMapService.syncNativePacks().catch(() => undefined);
    const [
      vault,
      biometricState,
      reduceModeState,
      wifiOnlyDownloadsState,
      storageState,
      downloadRows,
      regions,
      diagnosticReport,
      nextModelStatus,
      nextAvailableModels,
      nextInstalledModels,
      nextActiveModel,
      nextEmbeddingModels,
      nextActiveEmbeddingModel,
      nextEmbeddingIndexStatus,
    ] = await Promise.all([
      SettingsRepository.getVaultState(),
      VaultService.getBiometricsEnabled(),
      PreferencesService.getBatteryReduceModeEnabled(),
      PreferencesService.getWifiOnlyDownloadsEnabled(),
      FileSystemService.getStorageSummary(),
      DownloadManagerService.listDownloads(),
      OfflineMapService.listRegions(),
      DiagnosticsService.getReport(),
      ModelManagerService.getStatus(),
      ModelManagerService.listAvailableModels(),
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.listAvailableEmbeddingModels(),
      ModelManagerService.getActiveEmbeddingModel(),
      ModelManagerService.getEmbeddingIndexStatus(),
    ]);
    setAutoLock(vault.autoLockMinutes);
    setBiometricsEnabled(biometricState);
    setBatteryReduceModeEnabled(reduceModeState);
    setWifiOnlyDownloadsEnabled(wifiOnlyDownloadsState);
    setStorage(storageState);
    setDownloads(downloadRows);
    setMapRegions(regions);
    setDiagnostics(diagnosticReport);
    setModelStatus(nextModelStatus);
    setAvailableModels(nextAvailableModels);
    setInstalledModels(nextInstalledModels);
    setActiveModel(nextActiveModel);
    setEmbeddingModels(nextEmbeddingModels);
    setActiveEmbeddingModel(nextActiveEmbeddingModel);
    setEmbeddingIndexStatus(nextEmbeddingIndexStatus);
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const requestedTab =
      tab === 'storage' || tab === 'internals' || tab === 'downloads' ? 'advanced' : tab;
    if (requestedTab && SETTINGS_TABS.some((item) => item.value === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [tab]);

  React.useEffect(() => {
    const hasActiveModelDownload = availableModels.some((model) =>
      ['queued', 'downloading', 'verifying'].includes(model.installStatus)
    );
    const hasActiveDownload = downloads.some((download) =>
      ['queued', 'downloading', 'verifying'].includes(download.status)
    );
    const hasActiveMapDownload = mapRegions.some((region) =>
      ['queued', 'downloading'].includes(region.status)
    );
    if (
      !hasActiveModelDownload &&
      !hasActiveDownload &&
      !hasActiveMapDownload &&
      activeTab !== 'advanced'
    )
      return;
    const interval = setInterval(
      () => {
        void load();
      },
      BATTERY_POLL_INTERVALS_MS.settingsRefresh[batteryReduceModeEnabled ? 'reduced' : 'normal']
    );
    return () => clearInterval(interval);
  }, [activeTab, availableModels, batteryReduceModeEnabled, downloads, mapRegions]);

  async function setLockMinutes(minutes: number) {
    await SettingsRepository.updateVaultState({ autoLockMinutes: minutes });
    setAutoLock(minutes);
  }

  async function changePassword(input: {
    currentPassword: string;
    nextPassword: string;
    passwordHint: string;
  }) {
    setBusy('password');
    try {
      const result = await VaultService.changePassword(input);
      return { ok: result.ok, reason: result.reason };
    } finally {
      setBusy(null);
    }
  }

  async function toggleBiometrics() {
    setBusy('biometrics');
    try {
      const result = await VaultService.setBiometricsEnabled(!biometricsEnabled);
      if (result.ok) setBiometricsEnabled(!biometricsEnabled);
    } finally {
      setBusy(null);
    }
  }

  async function toggleBatteryReduceMode() {
    const next = !batteryReduceModeEnabled;
    setBatteryReduceModeEnabled(next);
    await PreferencesService.setBatteryReduceModeEnabled(next);
    if (next && preference !== 'oled') {
      await setPreference('oled');
    }
  }

  async function toggleWifiOnlyDownloads() {
    const next = !wifiOnlyDownloadsEnabled;
    setWifiOnlyDownloadsEnabled(next);
    await PreferencesService.setWifiOnlyDownloadsEnabled(next);
  }

  async function selectModel(model: ContentPack) {
    await ModelManagerService.setSelectedModel(model.id);
    setActiveModel(model);
    setModelStatus(await ModelManagerService.getStatus());
  }

  async function selectEmbeddingModel(model: EmbeddingModelConfig) {
    setBusy(`embedding-${model.id}`);
    setAiMessage(null);
    try {
      await ModelManagerService.setSelectedEmbeddingModel(model.id);
      await load();
    } catch (modelError) {
      setAiMessage(
        modelError instanceof Error ? modelError.message : 'Unable to update source search.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function importLocalModel() {
    setBusy('model-import');
    setAiMessage(null);
    try {
      await ContentPackService.importLocalModel('chat');
      await load();
    } catch (modelError) {
      setAiMessage(modelError instanceof Error ? modelError.message : 'Unable to import model.');
    } finally {
      setBusy(null);
    }
  }

  async function addModelUrl(input: { title: string; url: string; checksum: string }) {
    setBusy('model-url');
    setAiMessage(null);
    try {
      await ContentPackService.addModelUrl({
        title: input.title,
        sourceUrl: input.url,
        modelRole: 'chat',
        checksum: input.checksum,
      });
      await load();
    } catch (modelError) {
      setAiMessage(modelError instanceof Error ? modelError.message : 'Unable to add model URL.');
    } finally {
      setBusy(null);
    }
  }

  async function runModelAction(model: ContentPack) {
    setBusy(model.id);
    setAiMessage(null);
    try {
      if (
        model.installStatus === 'downloading' ||
        model.installStatus === 'queued' ||
        model.installStatus === 'verifying'
      ) {
        await ContentPackService.cancelPackDownload(model.id);
      } else if (model.installStatus === 'paused') {
        await ContentPackService.resumePackDownload(model.id);
      } else if (model.installed) {
        if (model.modelRole === 'chat') {
          await selectModel(model);
        }
      } else {
        await ContentPackService.installPackWithCompanions(model.id);
      }
      await load();
    } catch (modelError) {
      setAiMessage(
        modelError instanceof Error ? modelError.message : 'Unable to update this model.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function retryDownload(download: DownloadRow) {
    setBusy(`download-${download.id}`);
    try {
      await DownloadManagerService.resumeDownload(download.id);
      await load();
    } catch (error) {
      showSheetAlert(
        'Retry failed',
        error instanceof Error ? error.message : 'Unable to retry this download.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function runDownloadBatchAction(action: DownloadBatchAction) {
    setBusy(`downloads-${action}`);
    try {
      if (action === 'pause-all') {
        await DownloadManagerService.pauseAll();
        await Promise.all(
          mapRegions
            .filter((region) => region.status === 'queued' || region.status === 'downloading')
            .map((region) => OfflineMapService.pauseRegion(region.id).catch(() => null))
        );
      } else if (action === 'resume-all') {
        await DownloadManagerService.resumeAll();
        await Promise.all(
          mapRegions
            .filter((region) => region.status === 'paused')
            .map((region) => OfflineMapService.refreshRegion(region.id).catch(() => null))
        );
      } else if (action === 'retry-failed') {
        await DownloadManagerService.retryFailed();
        await Promise.all(
          mapRegions
            .filter((region) => region.status === 'failed')
            .map((region) => OfflineMapService.refreshRegion(region.id).catch(() => null))
        );
      } else {
        const result = await DownloadManagerService.deleteCompletedWhereSafe();
        showSheetAlert(
          'Download cleanup complete',
          `${result.deleted} completed row${result.deleted === 1 ? '' : 's'} removed. ${
            result.skipped
          } protected row${result.skipped === 1 ? '' : 's'} kept.`
        );
      }
      await load();
    } catch (error) {
      showSheetAlert(
        'Download action failed',
        error instanceof Error ? error.message : 'Unable to update downloads.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function runMapRegionAction(region: MapRegion, action: 'delete' | 'pause' | 'retry') {
    setBusy(`map-${action}-${region.id}`);
    try {
      if (action === 'delete') {
        await OfflineMapService.deleteRegion(region.id);
      } else if (action === 'pause') {
        const result = await OfflineMapService.pauseRegion(region.id);
        if (!result.ok) {
          showSheetAlert('Unable to pause map', result.reason ?? 'Try again from the map screen.');
        }
      } else {
        const result = await OfflineMapService.refreshRegion(region.id);
        if (!result.ok) {
          showSheetAlert(
            'Unable to download map',
            result.reason ?? 'Check connection and storage.'
          );
        }
      }
      await load();
    } catch (error) {
      showSheetAlert(
        'Map storage unavailable',
        error instanceof Error ? error.message : 'Unable to update this map region.'
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmDeleteMapRegion(region: MapRegion) {
    confirmDestructive({
      title: 'Delete offline map?',
      message: `${region.name} will be removed from this device.`,
      onConfirm: () => void runMapRegionAction(region, 'delete'),
    });
  }

  async function removeModel(model: ContentPack) {
    setBusy(`remove-${model.id}`);
    setAiMessage(null);
    try {
      await ContentPackService.removePack(model.id);
      if (activeModel?.id === model.id) {
        await ModelManagerService.setSelectedModel(null);
      }
      await load();
    } catch (modelError) {
      setAiMessage(
        modelError instanceof Error ? modelError.message : 'Unable to remove this model.'
      );
    } finally {
      setBusy(null);
    }
  }

  function handleBuildTap() {
    const now = Date.now();
    const recent = buildTapTimesRef.current.filter((time) => now - time < 1800);
    recent.push(now);
    buildTapTimesRef.current = recent;
    if (recent.length >= 5) {
      buildTapTimesRef.current = [];
      router.push('/easter-egg' as never);
    }
  }

  async function exportBackup(passphrase: string) {
    setBusy('backup-export');
    setBackupMessage(null);
    try {
      const backup = await BackupService.exportToFile(passphrase);
      setBackupMessage(
        `Backup saved: ${backup.manifest.notes.length} notes, ${backup.manifest.documents.length} documents.`
      );
      try {
        await BackupService.shareBackup(backup.uri);
      } catch (shareError) {
        showSheetAlert(
          'Backup saved',
          shareError instanceof Error
            ? shareError.message
            : 'The encrypted backup was saved locally.'
        );
      }
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Unable to export backup.');
    } finally {
      setBusy(null);
    }
  }

  async function importBackup(passphrase: string) {
    setBusy('backup-import');
    setBackupMessage(null);
    try {
      const result = await BackupService.importFromPicker(passphrase);
      if (!result) {
        setBackupMessage('Backup import canceled.');
        return;
      }
      setBackupMessage(
        `Backup imported: ${result.restored.notes} notes, ${result.restored.documents} documents.`
      );
      await load();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Unable to import backup.');
    } finally {
      setBusy(null);
    }
  }

  function confirmImportBackup(passphrase: string) {
    confirmDestructive({
      title: 'Import encrypted backup?',
      message:
        'Ark will merge durable records and overwrite matching notes, documents, routes, saved spots, feeds, and selected settings.',
      confirmLabel: 'Import',
      onConfirm: () => void importBackup(passphrase),
    });
  }

  const nativeMapStorageBytes = mapRegions.reduce(
    (sum, region) => sum + Math.max(0, region.sizeBytes ?? 0),
    0
  );
  const displayDirectorySizes = storage
    ? {
        ...storage.directorySizes,
        maps: Math.max(storage.directorySizes.maps ?? 0, nativeMapStorageBytes),
      }
    : null;
  const displayTotalBytes = storage
    ? storage.totalBytes -
      (storage.directorySizes.maps ?? 0) +
      Math.max(storage.directorySizes.maps ?? 0, nativeMapStorageBytes)
    : 0;

  return (
    <Screen>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-border bg-card rounded-lg border"
        contentContainerStyle={{ gap: 4, padding: 4 }}>
        {SETTINGS_TABS.map((tabItem) => (
          <Button
            key={tabItem.value}
            className="min-w-28 px-3"
            size="sm"
            variant={activeTab === tabItem.value ? 'default' : 'ghost'}
            onPress={() => setActiveTab(tabItem.value)}>
            <Text numberOfLines={1}>{tabItem.label}</Text>
          </Button>
        ))}
      </ScrollView>

      {activeTab === 'appearance' ? (
        <AppearanceSection
          preference={preference}
          setPreference={setPreference}
          batteryReduceModeEnabled={batteryReduceModeEnabled}
          toggleBatteryReduceMode={toggleBatteryReduceMode}
        />
      ) : null}

      {activeTab === 'security' ? (
        <SecuritySection
          vaultUnlocked={vaultUnlocked}
          autoLockMinutes={autoLock}
          setLockMinutes={setLockMinutes}
          biometricsEnabled={biometricsEnabled}
          biometricsBusy={busy === 'biometrics'}
          toggleBiometrics={toggleBiometrics}
          changePassword={changePassword}
          passwordBusy={busy === 'password'}
          onLockPress={() => setLockSheetOpen(true)}
        />
      ) : null}

      <VaultLockSheet visible={lockSheetOpen} onDismiss={() => setLockSheetOpen(false)} />

      {activeTab === 'ai' ? (
        <AiSection
          modelStatus={modelStatus}
          installedModels={installedModels}
          activeModel={activeModel}
          activeEmbeddingModel={activeEmbeddingModel}
          embeddingModels={embeddingModels}
          embeddingIndexStatus={embeddingIndexStatus}
          chatModels={chatModels}
          busy={busy}
          aiMessage={aiMessage}
          importLocalModel={importLocalModel}
          addModelUrl={addModelUrl}
          selectEmbeddingModel={selectEmbeddingModel}
          runModelAction={runModelAction}
          removeModel={removeModel}
        />
      ) : null}

      {activeTab === 'maps' ? (
        <OfflineMapsCard
          mapRegions={mapRegions}
          busy={busy}
          onDownloadPreset={async (preset) => {
            setBusy(`map-download-${preset.id}`);
            try {
              const result = await startPresetRegionDownload(preset, {
                catalogVersion: MapPresetsService.getCatalogMeta().version,
                regions: mapRegions,
                theme: effectiveTheme,
              });
              if (!result.ok && result.queued) {
                showSheetAlert('Map queued', result.reason ?? 'Map download is queued.');
              } else if (!result.ok) {
                showSheetAlert(
                  'Unable to download map',
                  result.reason ?? 'Check connection and storage, then retry.'
                );
              }
              await load();
            } catch (err) {
              showSheetAlert('Error', err instanceof Error ? err.message : 'Download failed');
            } finally {
              setBusy(null);
            }
          }}
          onDeleteRegion={confirmDeleteMapRegion}
        />
      ) : null}

      {activeTab === 'advanced' ? (
        <>
          <BackupSection
            exportBusy={busy === 'backup-export'}
            importBusy={busy === 'backup-import'}
            exportBackup={exportBackup}
            confirmImportBackup={confirmImportBackup}
            message={backupMessage}
          />

          <Card className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="bg-primary/12 size-11 items-center justify-center rounded-xl">
                <Icon as={HardDrive} className="text-primary size-5" />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="muted">Offline storage</Text>
                <Text variant="h3">
                  {storage
                    ? `${FileSystemService.formatBytes(displayTotalBytes)} stored offline`
                    : 'Calculating...'}
                </Text>
                {storage?.freeBytes != null ? (
                  <Text variant="muted">
                    {FileSystemService.formatBytes(storage.freeBytes)} free on this device
                  </Text>
                ) : null}
              </View>
            </View>
            {displayDirectorySizes ? (
              <View className="border-border overflow-hidden rounded-md border">
                {Object.entries(displayDirectorySizes).map(([name, bytes]) => (
                  <View
                    key={name}
                    className="border-border flex-row justify-between gap-3 border-b px-3 py-2 last:border-b-0">
                    <Text className="capitalize">{name}</Text>
                    <Text variant="muted">{FileSystemService.formatBytes(bytes)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>

          <DownloadsCard
            downloads={downloads}
            mapRegions={mapRegions}
            storage={storage}
            wifiOnlyDownloadsEnabled={wifiOnlyDownloadsEnabled}
            busy={busy}
            onToggleWifiOnlyDownloads={toggleWifiOnlyDownloads}
            onBatchAction={runDownloadBatchAction}
            onRetryDownload={retryDownload}
            onDeleteMapRegion={confirmDeleteMapRegion}
            onMapRegionAction={runMapRegionAction}
          />

          <DiagnosticsCard report={diagnostics} />

          <AboutSection version="1.0.0 MVP" onBuildTap={handleBuildTap} />
        </>
      ) : null}

    </Screen>
  );
}
