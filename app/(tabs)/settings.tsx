import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { BATTERY_POLL_INTERVALS_MS } from '@/constants/battery';
import { getPackIcon, getPackModelRoleLabel } from '@/constants/pack-presentation';
import type { MapPreset } from '@/constants/map-presets';
import { THEME_OPTIONS } from '@/constants/theme';
import { BackupService } from '@/services/backup/backup.service';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { formatMapRegionStorage, summarizeMapRegionStorage } from '@/services/maps/map-storage';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { DiagnosticsService } from '@/services/sensors/diagnostics.service';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import type { ContentPack } from '@/types/content';
import type { DownloadRow } from '@/types/downloads';
import type { MapRegion } from '@/types/maps';
import type { DiagnosticReport } from '@/types/sensors';
import { router, useLocalSearchParams } from 'expo-router';
import {
  BatteryCharging,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Download,
  Folder,
  HardDrive,
  Map as MapIcon,
  MoreVertical,
  Pause,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
  Upload,
  Wifi,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

type SettingsTab = 'appearance' | 'security' | 'ai' | 'downloads' | 'maps' | 'advanced';
type DownloadBatchAction = 'pause-all' | 'resume-all' | 'retry-failed' | 'clean-completed';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'security', label: 'Security' },
  { value: 'ai', label: 'AI' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'maps', label: 'Offline Maps' },
  { value: 'advanced', label: 'Advanced' },
];

export default function SettingsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: SettingsTab | 'storage' | 'internals' }>();
  const preference = useThemeStore((state) => state.preference);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('appearance');
  const [autoLock, setAutoLock] = React.useState(5);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [nextPassword, setNextPassword] = React.useState('');
  const [passwordHint, setPasswordHint] = React.useState('');
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [batteryReduceModeEnabled, setBatteryReduceModeEnabled] = React.useState(false);
  const [wifiOnlyDownloadsEnabled, setWifiOnlyDownloadsEnabled] = React.useState(false);
  const [availableModels, setAvailableModels] = React.useState<ContentPack[]>([]);
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
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
  const [securityMessage, setSecurityMessage] = React.useState<string | null>(null);
  const [aiMessage, setAiMessage] = React.useState<string | null>(null);
  const [backupPassphrase, setBackupPassphrase] = React.useState('');
  const [backupMessage, setBackupMessage] = React.useState<string | null>(null);
  const [modelTitle, setModelTitle] = React.useState('');
  const [modelUrl, setModelUrl] = React.useState('');
  const [modelChecksum, setModelChecksum] = React.useState('');
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
      ModelManagerService.getEmbeddingIndexStatus(),
    ]);
    setAutoLock(vault.autoLockMinutes);
    setPasswordHint(vault.passwordHint ?? '');
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
    setEmbeddingIndexStatus(nextEmbeddingIndexStatus);
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const requestedTab = tab === 'storage' || tab === 'internals' ? 'advanced' : tab;
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
      activeTab !== 'advanced' &&
      activeTab !== 'downloads'
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

  async function changePassword() {
    setBusy('password');
    setSecurityMessage(null);
    try {
      const result = await VaultService.changePassword({
        currentPassword,
        nextPassword,
        passwordHint,
      });
      if (!result.ok) {
        setSecurityMessage(result.reason ?? 'Unable to change passphrase.');
        return;
      }
      setCurrentPassword('');
      setNextPassword('');
      showSheetAlert('Passphrase changed', 'The vault verifier has been updated on this device.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleBiometrics() {
    setBusy('biometrics');
    setSecurityMessage(null);
    try {
      const result = await VaultService.setBiometricsEnabled(!biometricsEnabled);
      if (!result.ok) {
        setSecurityMessage(result.reason ?? 'Unable to update biometric unlock.');
        return;
      }
      setBiometricsEnabled(!biometricsEnabled);
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

  async function addModelUrl() {
    setBusy('model-url');
    setAiMessage(null);
    try {
      await ContentPackService.addModelUrl({
        title: modelTitle,
        sourceUrl: modelUrl,
        modelRole: 'chat',
        checksum: modelChecksum,
      });
      setModelTitle('');
      setModelUrl('');
      setModelChecksum('');
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
    showSheetAlert('Delete offline map?', `${region.name} will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runMapRegionAction(region, 'delete'),
      },
    ]);
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

  async function exportBackup() {
    setBusy('backup-export');
    setBackupMessage(null);
    try {
      const backup = await BackupService.exportToFile(backupPassphrase);
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

  async function importBackup() {
    setBusy('backup-import');
    setBackupMessage(null);
    try {
      const result = await BackupService.importFromPicker(backupPassphrase);
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

  function confirmImportBackup() {
    showSheetAlert(
      'Import encrypted backup?',
      'Ark will merge durable records and overwrite matching notes, documents, routes, saved spots, feeds, and selected settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import', style: 'destructive', onPress: () => void importBackup() },
      ]
    );
  }

  const currentTheme = THEME_OPTIONS.find((option) => option.value === preference);
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
        <>
          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="large">Theme</Text>
              <Text variant="muted">{currentTheme?.description}</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {THEME_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  className="min-w-20 flex-1"
                  size="sm"
                  variant={preference === option.value ? 'default' : 'outline'}
                  onPress={() => setPreference(option.value)}>
                  <Text>{option.label.replace(' (Recommended - saves battery)', '')}</Text>
                </Button>
              ))}
            </View>
          </Card>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={BatteryCharging} className="text-primary size-5" />
                  <Text variant="large">Battery Reduce Mode</Text>
                </View>
                <Text variant="muted">
                  Limits motion and haptics, slows live polling, pauses automatic OCR/index
                  catch-up, and prefers OLED.
                </Text>
              </View>
              <Button
                size="sm"
                variant={batteryReduceModeEnabled ? 'default' : 'outline'}
                onPress={toggleBatteryReduceMode}>
                <Text>{batteryReduceModeEnabled ? 'On' : 'Off'}</Text>
              </Button>
            </View>
          </Card>
        </>
      ) : null}

      {activeTab === 'security' ? (
        <>
          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">Vault</Text>
                <Text variant="muted">Secure notes require an unlocked vault.</Text>
              </View>
              <Button
                size="sm"
                onPress={() =>
                  showSheetAlert('Lock vault?', 'Secure notes will require unlock again.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Lock', style: 'destructive', onPress: () => VaultService.lock() },
                  ])
                }>
                <Text>Lock</Text>
              </Button>
            </View>

            <View className="gap-2">
              <Text variant="muted">Auto-lock</Text>
              <View className="flex-row flex-wrap gap-2">
                {[1, 5, 15, 60].map((minutes) => (
                  <Button
                    key={minutes}
                    className="flex-1"
                    size="sm"
                    variant={autoLock === minutes ? 'default' : 'outline'}
                    onPress={() => setLockMinutes(minutes)}>
                    <Text>{minutes === 60 ? '1 hr' : `${minutes} min`}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <Button variant="outline" disabled={busy === 'biometrics'} onPress={toggleBiometrics}>
              {busy === 'biometrics' ? <ActivityIndicator /> : null}
              <Text>{biometricsEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}</Text>
            </Button>
          </Card>

          <Card className="gap-3">
            <Text variant="large">Passphrase</Text>
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={nextPassword}
              onChangeText={setNextPassword}
              placeholder="New passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={passwordHint}
              onChangeText={setPasswordHint}
              placeholder="Password hint"
            />
            <Button
              variant="outline"
              disabled={busy === 'password' || !currentPassword || !nextPassword}
              onPress={changePassword}>
              {busy === 'password' ? <ActivityIndicator /> : null}
              <Text>Change Passphrase</Text>
            </Button>
            {securityMessage ? <Text className="text-destructive">{securityMessage}</Text> : null}
            <Text variant="small" className="text-muted-foreground">
              Stronger device encryption is enabled in supported builds.
            </Text>
          </Card>
        </>
      ) : null}

      {activeTab === 'ai' ? (
        <>
          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="large">Local AI</Text>
              <Text>
                {modelStatus
                  ? modelStatus.adapter === 'llama'
                    ? 'Offline answers ready'
                    : `${modelStatus.installedModels} answer model(s) installed`
                  : 'Checking model status...'}
              </Text>
              {modelStatus ? <Text variant="muted">{modelStatus.message}</Text> : null}
            </View>
            <View className="bg-muted/40 gap-1 rounded-md px-3 py-3">
              <Text variant="small">Answer models installed: {installedModels.length}</Text>
              <Text variant="small">
                Source search: ExecuTorch multi-qa MiniLM
              </Text>
              <Text variant="muted">
                Current answer model:{' '}
                {activeModel
                  ? activeModel.title
                  : modelStatus?.chatModelDisabled
                    ? 'Source search only'
                    : 'None installed'}
              </Text>
              <Text variant="muted">Current source search model: built-in mobile embeddings</Text>
            </View>
          </Card>

          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="large">Add your own model</Text>
              <Text variant="muted">
                Import a GGUF answer model you already have, or save a custom download URL for
                later.
              </Text>
            </View>
            <Button
              variant="outline"
              disabled={busy === 'model-import'}
              onPress={() => void importLocalModel()}>
              {busy === 'model-import' ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Upload} className="size-4" />
              )}
              <Text>Import GGUF file</Text>
            </Button>
            <View className="gap-2">
              <Input value={modelTitle} onChangeText={setModelTitle} placeholder="Model name" />
              <Input
                value={modelUrl}
                onChangeText={setModelUrl}
                placeholder="https://.../model.gguf"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Input
                value={modelChecksum}
                onChangeText={setModelChecksum}
                placeholder="Checksum (optional)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                variant="outline"
                disabled={busy === 'model-url' || !modelUrl.trim()}
                onPress={() => void addModelUrl()}>
                {busy === 'model-url' ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={Bot} className="size-4" />
                )}
                <Text>Add answer URL</Text>
              </Button>
            </View>
            <Text variant="small" className="text-muted-foreground">
              Source search uses built-in Ark ExecuTorch embeddings; custom GGUF imports are for
              Ask Arky answer-writing models.
            </Text>
          </Card>

          <ModelSection
            title="Answer models"
            description="These write Ask Arky responses after Ark searches local sources."
            models={chatModels}
            activeModelId={activeModel?.id ?? null}
            busy={busy}
            onPrimaryAction={runModelAction}
            onRemove={removeModel}
          />

          <EmbeddingIndexCard status={embeddingIndexStatus} />

          {aiMessage ? <Text className="text-destructive">{aiMessage}</Text> : null}
        </>
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
          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="large">Encrypted Backup</Text>
              <Text variant="muted">
                Exports notes, imported documents, saved spots, routes, feeds, checklist state, and
                selected settings. Models, maps, guide packs, indexes, caches, and download queues
                stay out.
              </Text>
            </View>
            <Input
              value={backupPassphrase}
              onChangeText={setBackupPassphrase}
              placeholder="Backup passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <View className="flex-row flex-wrap gap-2">
              <Button
                className="min-w-36 flex-1"
                variant="outline"
                disabled={busy === 'backup-export' || backupPassphrase.trim().length < 8}
                onPress={() => void exportBackup()}>
                {busy === 'backup-export' ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={Download} className="size-4" />
                )}
                <Text>Export .arkbackup</Text>
              </Button>
              <Button
                className="min-w-36 flex-1"
                variant="outline"
                disabled={busy === 'backup-import' || backupPassphrase.trim().length < 8}
                onPress={confirmImportBackup}>
                {busy === 'backup-import' ? (
                  <ActivityIndicator />
                ) : (
                  <Icon as={Upload} className="size-4" />
                )}
                <Text>Import .arkbackup</Text>
              </Button>
            </View>
            {backupMessage ? <Text variant="muted">{backupMessage}</Text> : null}
          </Card>

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

          <Pressable onPress={handleBuildTap}>
            <Card className="gap-2">
              <Text variant="large">Build</Text>
              <Text variant="muted">Version 1.0.0 MVP</Text>
              <Text variant="small" className="text-muted-foreground">
                Tap build number five times for test utilities.
              </Text>
            </Card>
          </Pressable>
        </>
      ) : null}

      {activeTab === 'downloads' ? (
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
      ) : null}
    </Screen>
  );
}

function DownloadsCard({
  downloads,
  mapRegions,
  storage,
  wifiOnlyDownloadsEnabled,
  busy,
  onToggleWifiOnlyDownloads,
  onBatchAction,
  onRetryDownload,
  onDeleteMapRegion,
  onMapRegionAction,
}: {
  downloads: DownloadRow[];
  mapRegions: MapRegion[];
  storage: Awaited<ReturnType<typeof FileSystemService.getStorageSummary>> | null;
  wifiOnlyDownloadsEnabled: boolean;
  busy: string | null;
  onToggleWifiOnlyDownloads: () => Promise<void>;
  onBatchAction: (action: DownloadBatchAction) => Promise<void>;
  onRetryDownload: (download: DownloadRow) => Promise<void>;
  onDeleteMapRegion: (region: MapRegion) => void;
  onMapRegionAction: (region: MapRegion, action: 'pause' | 'retry') => Promise<void>;
}) {
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
  const activeMapRegions = mapRegions.filter((region) =>
    ['queued', 'downloading', 'paused', 'failed', 'downloaded'].includes(region.status)
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
  return (
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
      {activeRows.length || mapRegions.length ? (
        <View className="gap-3">
          {activeRows.map((download) => (
            <DownloadRowView
              key={download.id}
              download={download}
              busy={busy === `download-${download.id}`}
              onRetry={() => onRetryDownload(download)}
            />
          ))}
          {mapRegions.map((region) => (
            <MapRegionRow
              key={region.id}
              region={region}
              busy={busy}
              onDelete={onDeleteMapRegion}
              onAction={onMapRegionAction}
            />
          ))}
        </View>
      ) : (
        <Text variant="muted">No downloads have been queued yet.</Text>
      )}
    </Card>
  );
}

function DownloadRowView({
  download,
  busy,
  onRetry,
}: {
  download: DownloadRow;
  busy: boolean;
  onRetry: () => Promise<void>;
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
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onPress={() => void onRetry()}
          className="self-start">
          {busy ? <ActivityIndicator /> : <Icon as={RefreshCw} className="size-4" />}
          <Text>Retry</Text>
        </Button>
      ) : null}
    </View>
  );
}

function MapRegionRow({
  region,
  busy,
  onDelete,
  onAction,
}: {
  region: MapRegion;
  busy: string | null;
  onDelete: (region: MapRegion) => void;
  onAction: (region: MapRegion, action: 'pause' | 'retry') => Promise<void>;
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
      </View>
    </View>
  );
}

function DiagnosticsCard({ report }: { report: DiagnosticReport | null }) {
  if (!report) {
    return (
      <Card>
        <Text variant="muted">Loading diagnostics...</Text>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Icon as={Smartphone} className="text-primary size-5" />
        <Text variant="large">Diagnostics</Text>
      </View>
      <View className="gap-1">
        <Text>Network: {report.network}</Text>
        <Text>Search index: {report.ftsAvailable ? 'available' : 'not available'}</Text>
        <Text>Vault protection: {report.sqlCipherActive ? 'active' : 'limited'}</Text>
        <Text>AI engine: {report.aiAdapter}</Text>
        <Text variant="muted">{report.aiStatusMessage}</Text>
        <Text variant="muted">{report.databaseEncryption.migrationStatus}</Text>
      </View>
      <View className="border-border overflow-hidden rounded-md border">
        {Object.entries(report.sensors).map(([name, available]) => (
          <View
            key={name}
            className="border-border flex-row justify-between border-b px-3 py-2 last:border-b-0">
            <Text className="capitalize">{name}</Text>
            <Text variant="muted">{available ? 'available' : 'not available'}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function EmbeddingIndexCard({
  status,
}: {
  status: Awaited<ReturnType<typeof ModelManagerService.getEmbeddingIndexStatus>> | null;
}) {
  if (!status) return null;

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">Search index coverage</Text>
        <Text variant="muted">
          Coverage shows which indexed chunks have vectors for each search model.
        </Text>
      </View>
      <View className="gap-3">
        {status.map((model) => (
          <View key={model.id} className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1}>{model.title}</Text>
                <Text variant="small" className="text-muted-foreground">
                  {model.active ? 'Active' : model.installed ? 'Installed' : 'Not installed'} ·{' '}
                  {Math.round(model.complete * 100)}%
                </Text>
              </View>
              <Text variant="small" className="text-muted-foreground">
                {model.embedded}/{model.total}
              </Text>
            </View>
            <Progress value={model.complete} />
            <View className="flex-row flex-wrap gap-2">
              {model.domains.map((domain) => (
                <Text key={domain.domain} variant="small" className="text-muted-foreground">
                  {domain.domain}: {domain.embedded}/{domain.total}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ModelSection({
  title,
  description,
  models,
  activeModelId,
  busy,
  onPrimaryAction,
  onRemove,
}: {
  title: string;
  description: string;
  models: ContentPack[];
  activeModelId: string | null;
  busy: string | null;
  onPrimaryAction: (model: ContentPack) => Promise<void>;
  onRemove: (model: ContentPack) => Promise<void>;
}) {
  if (!models.length) return null;

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">{title}</Text>
        <Text variant="muted">{description}</Text>
      </View>
      <View className="gap-3">
        {models.map((model) => {
          const roleLabel = getPackModelRoleLabel(model);
          const isActive = activeModelId === model.id;
          const primaryBusy = busy === model.id;
          const removeBusy = busy === `remove-${model.id}`;
          return (
            <View key={model.id} className="bg-muted/30 gap-3 rounded-lg px-3 py-3">
              <View className="flex-row gap-3">
                <View className="bg-primary/12 size-11 items-center justify-center rounded-xl">
                  <Icon as={getPackIcon(model)} className="text-primary size-5" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text variant="large" className="min-w-0 flex-1">
                      {model.title}
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      {model.estimatedSize}
                    </Text>
                  </View>
                  {roleLabel ? (
                    <Text className="text-primary text-xs font-medium">{roleLabel}</Text>
                  ) : null}
                  <Text variant="muted">{model.description}</Text>
                  {model.sourceLabel ? (
                    <Text variant="small" className="text-muted-foreground">
                      {model.sourceLabel}
                    </Text>
                  ) : null}
                  {isModelDownloadVisible(model) ? (
                    <View className="gap-1 pt-1">
                      <Progress value={model.progress ?? 0} />
                      <Text variant="small" className="text-muted-foreground">
                        {model.installStatus === 'verifying'
                          ? 'Verifying download'
                          : `${Math.round((model.progress ?? 0) * 100)}% downloaded`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  variant={model.installed && isActive ? 'default' : 'outline'}
                  disabled={primaryBusy}
                  onPress={() => void onPrimaryAction(model)}>
                  {primaryBusy ? <ActivityIndicator /> : <Icon as={Download} className="size-4" />}
                  <Text>{primaryLabel(model, isActive)}</Text>
                </Button>
                {(model.installed ||
                  model.installStatus === 'downloading' ||
                  model.installStatus === 'queued' ||
                  model.installStatus === 'verifying' ||
                  model.installStatus === 'paused') && (
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={removeBusy}
                    onPress={() => void onRemove(model)}>
                    {removeBusy ? <ActivityIndicator /> : <Icon as={Trash2} className="size-4" />}
                  </Button>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function primaryLabel(model: ContentPack, isActive: boolean) {
  if (model.installStatus === 'downloading' || model.installStatus === 'queued') {
    return `Cancel ${Math.round((model.progress ?? 0) * 100)}%`;
  }
  if (model.installStatus === 'verifying') return 'Verifying';
  if (model.installStatus === 'paused') return 'Resume';
  if (model.installed && model.modelRole === 'chat') return isActive ? 'In use' : 'Use for chat';
  if (model.installed && model.modelRole === 'embedding') {
    return isActive ? 'In use' : 'Use for search';
  }
  if (model.installed && model.modelRole === 'voice') return isActive ? 'In use' : 'Use for voice';
  if (model.installed) return 'Installed';
  return 'Download';
}

function isModelDownloadVisible(model: ContentPack) {
  return ['queued', 'downloading', 'verifying', 'paused'].includes(model.installStatus);
}

type MapCountryGroup = {
  key: string;
  name: string;
  letter: string;
  presets: MapPreset[];
  regions: MapRegion[];
  downloadedRegions: MapRegion[];
};

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina',
  AU: 'Australia',
  BR: 'Brazil',
  CA: 'Canada',
  DE: 'Germany',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  IE: 'Ireland',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  MA: 'Morocco',
  MX: 'Mexico',
  NZ: 'New Zealand',
  PT: 'Portugal',
  TR: 'Turkey',
  UK: 'United Kingdom',
  US: 'United States',
};

function OfflineMapsCard({
  mapRegions,
  busy,
  onDownloadPreset,
  onDeleteRegion,
}: {
  mapRegions: MapRegion[];
  busy: string | null;
  onDownloadPreset: (preset: MapPreset) => Promise<void>;
  onDeleteRegion: (region: MapRegion) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [browseMode, setBrowseMode] = React.useState(false);
  const [selectedCountryKey, setSelectedCountryKey] = React.useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = React.useState<MapRegion | null>(null);
  const presets = React.useMemo(() => MapPresetsService.listPresets(), []);
  const searchText = search.trim().toLowerCase();
  const showingCatalog = browseMode || searchText.length > 0;
  const groups = React.useMemo(() => buildMapCountryGroups(presets, mapRegions), [mapRegions, presets]);

  const visibleGroups = React.useMemo(() => {
    let nextGroups = groups;
    if (searchText) {
      nextGroups = groups
        .map((group) => ({
          ...group,
          presets: group.presets.filter((preset) => mapPresetMatches(preset, searchText, group.name)),
        }))
        .filter(
          (group) =>
            group.name.toLowerCase().includes(searchText) ||
            group.presets.length ||
            group.downloadedRegions.some((region) => region.name.toLowerCase().includes(searchText))
        );
    }
    if (showingCatalog) return nextGroups;
    return nextGroups.filter((group) => group.downloadedRegions.length > 0);
  }, [groups, searchText, showingCatalog]);

  const selectedGroup = selectedCountryKey
    ? groups.find((group) => group.key === selectedCountryKey) ?? null
    : null;
  const detailRegions = selectedGroup ? getGroupRows(selectedGroup, showingCatalog, searchText) : [];
  const customDownloadedRegions = mapRegions.filter(
    (region) =>
      region.status === 'downloaded' &&
      !presets.some((preset) => preset.id === region.manifestRegionId || preset.name === region.name)
  );
  const visibleCustomRegions = customDownloadedRegions.filter(
    (region) => !searchText || region.name.toLowerCase().includes(searchText)
  );

  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Icon as={MapIcon} className="text-primary size-5" />
            <Text variant="large">Offline Maps</Text>
          </View>
          <Text variant="muted">
            {showingCatalog
              ? 'Search and add bundled map regions.'
              : 'Downloaded map packs stored on this device.'}
          </Text>
        </View>
        <Button
          size="sm"
          variant={showingCatalog ? 'outline' : 'default'}
          onPress={() => {
            setSelectedCountryKey(null);
            setBrowseMode((current) => !current);
          }}>
          <Text>{showingCatalog && !searchText ? 'Downloaded' : 'Add map'}</Text>
        </Button>
      </View>

      <View className="bg-muted/45 flex-row items-center gap-2 rounded-lg px-3 py-2">
        <Icon as={Search} className="text-muted-foreground size-5" />
        <Input
          className="h-8 flex-1 border-0 bg-transparent px-0"
          placeholder="Search countries and maps"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            if (value.trim()) setSelectedCountryKey(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} className="p-1">
            <Icon as={X} className="text-muted-foreground size-4" />
          </Pressable>
        ) : null}
      </View>

      {selectedGroup ? (
        <View className="gap-3">
          <Button
            className="self-start"
            size="sm"
            variant="ghost"
            onPress={() => setSelectedCountryKey(null)}>
            <Icon as={ChevronLeft} className="size-4" />
            <Text>{selectedGroup.name}</Text>
          </Button>
          <View className="gap-2">
            {detailRegions.length ? (
              detailRegions.map(({ preset, region }) => (
                <MapPresetRow
                  key={preset.id}
                  busy={
                    busy === `map-download-${preset.id}` ||
                    (region ? Boolean(busy?.endsWith(region.id)) : false)
                  }
                  preset={preset}
                  region={region}
                  onDownload={() => onDownloadPreset(preset)}
                  onOpenRegion={() => region && setSelectedRegion(region)}
                />
              ))
            ) : (
              <Text variant="muted">
                {showingCatalog
                  ? 'No maps match this search.'
                  : 'No downloaded maps in this folder yet.'}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View className="border-border overflow-hidden rounded-lg border">
          {visibleGroups.length || visibleCustomRegions.length ? (
            <>
              {visibleGroups.map((group) => (
                <MapCountryRow
                  key={group.key}
                  group={group}
                  showCatalog={showingCatalog}
                  onPress={() => setSelectedCountryKey(group.key)}
                />
              ))}
              {visibleCustomRegions.map((region) => (
                <MapDownloadedRegionRow
                  key={region.id}
                  region={region}
                  onOpen={() => setSelectedRegion(region)}
                />
              ))}
            </>
          ) : (
            <View className="gap-2 px-3 py-4">
              <Text>No downloaded maps yet.</Text>
              <Text variant="muted">Use Add map or search to choose a region.</Text>
            </View>
          )}
        </View>
      )}

      <MapRegionDetailsSheet
        region={selectedRegion}
        preset={selectedRegion ? findPresetForRegion(selectedRegion, presets) : null}
        onDismiss={() => setSelectedRegion(null)}
        onDelete={(region) => {
          setSelectedRegion(null);
          onDeleteRegion(region);
        }}
      />
    </Card>
  );
}

function MapCountryRow({
  group,
  showCatalog,
  onPress,
}: {
  group: MapCountryGroup;
  showCatalog: boolean;
  onPress: () => void;
}) {
  const downloadedCount = group.downloadedRegions.length;
  const totalCount = group.presets.length;
  return (
    <Pressable
      className="border-border bg-card flex-row items-center gap-3 border-b px-3 py-3 last:border-b-0"
      onPress={onPress}>
      <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
        <Text className="text-primary font-semibold">{group.letter}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Icon as={Folder} className="text-muted-foreground size-4" />
          <Text className="font-medium" numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <Text variant="small" className="text-muted-foreground">
          {downloadedCount
            ? `${downloadedCount} of ${totalCount} downloaded`
            : showCatalog
              ? `${totalCount} map${totalCount === 1 ? '' : 's'} available`
              : 'Downloaded maps'}
        </Text>
      </View>
    </Pressable>
  );
}

function MapPresetRow({
  busy,
  preset,
  region,
  onDownload,
  onOpenRegion,
}: {
  busy: boolean;
  preset: MapPreset;
  region?: MapRegion | null;
  onDownload: () => Promise<void>;
  onOpenRegion: () => void;
}) {
  const downloaded = region?.status === 'downloaded';
  const downloading = region?.status === 'downloading';
  const queued = region?.status === 'queued';
  const unsupportedReason = getUnsupportedMapPackReason(preset);
  return (
    <View className="border-border bg-muted/25 gap-2 rounded-lg border px-3 py-3">
      <View className="flex-row items-start gap-3">
        <View className="bg-background size-10 items-center justify-center rounded-md">
          <Icon as={downloaded ? CheckCircle2 : MapIcon} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-medium" numberOfLines={1}>
            {preset.name}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
            {preset.description}
          </Text>
          <Text variant="small" className="text-muted-foreground">
            {region ? region.status.replace('_', ' ') : preset.estimatedSize}
          </Text>
        </View>
        {downloaded && region ? (
          <Button size="icon" variant="ghost" onPress={onOpenRegion}>
            <Icon as={MoreVertical} className="size-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy || !!unsupportedReason} onPress={() => void onDownload()}>
            {busy ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
            <Text>
              {downloading
                ? `${Math.round((region?.progress ?? 0) * 100)}%`
                : queued
                  ? 'Queued'
                  : 'Get'}
            </Text>
          </Button>
        )}
      </View>
      {region && !downloaded ? <Progress value={region.progress ?? 0} /> : null}
      {unsupportedReason ? (
        <Text variant="small" className="text-muted-foreground">
          {unsupportedReason}
        </Text>
      ) : null}
    </View>
  );
}

function MapDownloadedRegionRow({
  region,
  onOpen,
}: {
  region: MapRegion;
  onOpen: () => void;
}) {
  return (
    <View className="border-border flex-row items-center gap-3 border-b px-3 py-3 last:border-b-0">
      <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
        <Text className="text-primary font-semibold">{region.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-medium" numberOfLines={1}>
          {region.name}
        </Text>
        <Text variant="small" className="text-muted-foreground">
          {formatMapRegionStorage(region)}
        </Text>
      </View>
      <Button size="icon" variant="ghost" onPress={onOpen}>
        <Icon as={MoreVertical} className="size-4" />
      </Button>
    </View>
  );
}

function MapRegionDetailsSheet({
  region,
  preset,
  onDismiss,
  onDelete,
}: {
  region: MapRegion | null;
  preset: MapPreset | null;
  onDismiss: () => void;
  onDelete: (region: MapRegion) => void;
}) {
  return (
    <ArkBottomSheet visible={!!region} onDismiss={onDismiss} snapPoints={['48%']}>
      {region ? (
        <View className="gap-4">
          <View className="gap-1">
            <Text variant="h3">{region.name}</Text>
            <Text variant="muted">{formatMapRegionStorage(region)}</Text>
          </View>
          <View className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
            <Text variant="small" className="text-muted-foreground">
              Regions contained
            </Text>
            <Text>
              {preset
                ? preset.description
                : regionBoundsLabel(region) ?? 'Custom saved map region.'}
            </Text>
            {preset?.tags.length ? (
              <Text variant="small" className="text-muted-foreground">
                {preset.tags.slice(0, 5).join(' · ')}
              </Text>
            ) : null}
          </View>
          <Button variant="destructive" onPress={() => onDelete(region)}>
            <Icon as={Trash2} className="size-4" />
            <Text>Delete map</Text>
          </Button>
        </View>
      ) : (
        <View />
      )}
    </ArkBottomSheet>
  );
}

function buildMapCountryGroups(presets: MapPreset[], regions: MapRegion[]): MapCountryGroup[] {
  const groups = new Map<string, MapCountryGroup>();
  for (const preset of presets) {
    if (isStructuralMapPreset(preset)) continue;
    const countryName = countryNameForPreset(preset);
    const key = countryName.toLowerCase();
    const group =
      groups.get(key) ??
      {
        key,
        name: countryName,
        letter: countryName.charAt(0).toUpperCase(),
        presets: [],
        regions: [],
        downloadedRegions: [],
      };
    group.presets.push(preset);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.presets.sort((a, b) => levelSort(a) - levelSort(b) || a.name.localeCompare(b.name));
    group.regions = regions.filter((region) => {
      return group.presets.some(
        (preset) => preset.id === region.manifestRegionId || preset.name === region.name
      );
    });
    group.downloadedRegions = group.regions.filter((region) => region.status === 'downloaded');
  }

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function getGroupRows(group: MapCountryGroup, showCatalog: boolean, searchText: string) {
  return group.presets
    .filter((preset) => {
      const region = findRegionForPreset(preset, group.regions);
      if (!showCatalog && region?.status !== 'downloaded') return false;
      return !searchText || mapPresetMatches(preset, searchText, group.name);
    })
    .map((preset) => ({ preset, region: findRegionForPreset(preset, group.regions) }));
}

function findRegionForPreset(preset: MapPreset, regions: MapRegion[]) {
  return regions.find(
    (region) => region.manifestRegionId === preset.id || region.name === preset.name
  );
}

function findPresetForRegion(region: MapRegion, presets: MapPreset[]) {
  return presets.find((preset) => preset.id === region.manifestRegionId || preset.name === region.name) ?? null;
}

function mapPresetMatches(preset: MapPreset, searchText: string, countryName: string) {
  return [countryName, preset.name, preset.description, ...preset.tags]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(searchText));
}

function countryNameForPreset(preset: MapPreset) {
  if (preset.countryCode && COUNTRY_NAMES[preset.countryCode]) return COUNTRY_NAMES[preset.countryCode];
  const tagCountry = preset.tags.find((tag) => Object.values(COUNTRY_NAMES).includes(tag));
  if (tagCountry) return tagCountry;
  if (preset.tags.includes('Iberia')) return 'Iberia';
  return 'Other Regions';
}

function isStructuralMapPreset(preset: MapPreset) {
  return preset.id.includes('base') || preset.id.includes('low-detail');
}

function levelSort(preset: MapPreset) {
  if (preset.level === 'country') return 0;
  if (preset.level === 'region') return 1;
  return 2;
}

function regionBoundsLabel(region: MapRegion) {
  if (
    region.north == null ||
    region.south == null ||
    region.east == null ||
    region.west == null
  ) {
    return null;
  }
  return `${region.south.toFixed(2)}, ${region.west.toFixed(2)} to ${region.north.toFixed(2)}, ${region.east.toFixed(2)}`;
}
