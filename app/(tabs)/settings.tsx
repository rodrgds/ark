import { Screen } from '@/components/layout/screen';
import { VaultLockSheet } from '@/components/security/vault-lock-sheet';
import { AboutSection } from '@/components/settings/about-section';
import { AiSection } from '@/components/settings/ai-section';
import { AppearanceSection } from '@/components/settings/appearance-section';
import { BackupSection } from '@/components/settings/backup-section';
import { DiagnosticsCard } from '@/components/settings/diagnostics-card';
import {
  DownloadsCard,
  type DownloadBatchAction,
  type DownloadRowAction,
} from '@/components/settings/downloads-card';
import { FieldSection } from '@/components/settings/field-section';
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
import { AiEvaluationService } from '@/services/ai/ai-evaluation.service';
import type { AiEvaluationResult } from '@/services/ai/evaluation';
import type { EmbeddingModelConfig } from '@/services/ai/embedding-models';
import { DatabaseClient } from '@/services/db/client';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import type { FieldPreferences } from '@/services/preferences/preferences.service';
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

type SettingsTab = 'appearance' | 'field' | 'security' | 'ai' | 'maps' | 'advanced';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'field', label: 'Field' },
  { value: 'security', label: 'Security' },
  { value: 'ai', label: 'AI' },
  { value: 'maps', label: 'Offline Maps' },
  { value: 'advanced', label: 'Advanced' },
];

const SETTINGS_FAST_TIMEOUT_MS = 2_500;
const SETTINGS_SLOW_TIMEOUT_MS = 5_000;

type SettledProbe<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'timeout' | 'error'; error?: unknown };

function resolveWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<SettledProbe<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ ok: true, value });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({ ok: false, reason: 'error', error });
      }
    );
  });
}

async function runProbe<T>(
  promise: Promise<T>,
  apply: (value: T) => void,
  options: {
    timeoutMs?: number;
    onFailure?: (result: Exclude<SettledProbe<T>, { ok: true }>) => void;
  } = {}
) {
  const result = await resolveWithin(promise, options.timeoutMs ?? SETTINGS_FAST_TIMEOUT_MS);
  if (result.ok) {
    apply(result.value);
    return;
  }
  options.onFailure?.(result);
}

function createUnavailableModelStatus(): Awaited<ReturnType<typeof ModelManagerService.getStatus>> {
  return {
    adapter: 'mock',
    installedModels: 0,
    installedChatModels: 0,
    installedEmbeddingModels: 1,
    installedVoiceModels: 0,
    availableModels: 0,
    availableChatModels: 0,
    availableEmbeddingModels: 0,
    availableVoiceModels: 0,
    selectedModelId: null,
    selectedEmbeddingModelId: null,
    selectedVoiceModelId: null,
    modelPickerEnabled: true,
    chatModelDisabled: false,
    activeVoiceModelTitle: '',
    voiceReady: false,
    activeModelTitle: '',
    contextTokens: 0,
    maxResponseTokens: 0,
    message:
      'Model status is taking too long to refresh. Built-in source search is still available.',
  };
}

function createUnavailableDiagnosticReport(): DiagnosticReport {
  return {
    sensors: {
      compass: false,
      barometer: false,
      level: false,
      pedometer: false,
      light: false,
      location: false,
    },
    network: 'unknown',
    directories: {},
    sqlCipherActive: false,
    databaseEncryption: {
      active: false,
      runtimeActive: false,
      databaseState: 'unknown',
      stateLabel: 'Needs inspection',
      encryptionEnabled: false,
      keyStored: false,
      keyStrategy: 'Unknown',
      migrationStatus: 'Diagnostics timed out before database encryption could be inspected.',
      existingDataStatus: 'Restart Ark or open Diagnostics again to inspect existing data.',
      passphraseRekeyStatus: 'Passphrase rekey status unavailable.',
      plaintextMigrationImplemented: true,
      vaultPassphraseRekeyImplemented: true,
      note: 'Diagnostics timed out.',
    },
    ftsAvailable: false,
    aiAdapter: 'mock',
    aiStatusMessage: 'Diagnostics timed out before AI status could be inspected.',
    routingEngine: {
      available: false,
      engine: 'valhalla',
      reason: 'Diagnostics timed out before routing engine status could be inspected.',
    },
    routingData: {
      readyCount: 0,
      readyRegionNames: [],
      downloadingCount: 0,
      failedCount: 0,
      missingGraphCount: 0,
      message: 'Diagnostics timed out before navigation data could be inspected.',
    },
  };
}

export default function SettingsScreen() {
  const { tab, downloadId } = useLocalSearchParams<{
    tab?: SettingsTab | 'downloads' | 'storage' | 'internals';
    downloadId?: string;
  }>();
  const selectedDownloadResourceId =
    typeof downloadId === 'string' && downloadId.length > 0 ? downloadId : null;
  const preference = useThemeStore((state) => state.preference);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const accentPreference = useThemeStore((state) => state.accentPreference);
  const themeColors = useThemeStore((state) => state.colors);
  const systemAccentAvailable = useThemeStore((state) => state.systemAccentAvailable);
  const systemAccentColors = useThemeStore((state) => state.systemAccentColors);
  const setPreference = useThemeStore((state) => state.setPreference);
  const setAccentPreference = useThemeStore((state) => state.setAccentPreference);
  const vaultUnlocked = useAuthStore((state) => state.unlocked);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('appearance');
  const [vaultProtectionEnabled, setVaultProtectionEnabled] = React.useState(false);
  const [autoLock, setAutoLock] = React.useState(5);
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [batteryReduceModeEnabled, setBatteryReduceModeEnabled] = React.useState(false);
  const [wifiOnlyDownloadsEnabled, setWifiOnlyDownloadsEnabled] = React.useState(false);
  const [topHeaderEnabled, setTopHeaderEnabled] = React.useState(true);
  const [fieldPreferences, setFieldPreferences] = React.useState<FieldPreferences | null>(null);
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
  const [storageUnavailable, setStorageUnavailable] = React.useState(false);
  const [downloads, setDownloads] = React.useState<DownloadRow[]>([]);
  const [mapRegions, setMapRegions] = React.useState<MapRegion[]>([]);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticReport | null>(null);
  const [aiEvaluationResults, setAiEvaluationResults] = React.useState<AiEvaluationResult[] | null>(
    null
  );
  const [modelStatus, setModelStatus] = React.useState<Awaited<
    ReturnType<typeof ModelManagerService.getStatus>
  > | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [aiMessage, setAiMessage] = React.useState<string | null>(null);
  const [backupMessage, setBackupMessage] = React.useState<string | null>(null);
  const [lockSheetOpen, setLockSheetOpen] = React.useState(false);
  const buildTapTimesRef = React.useRef<number[]>([]);
  const loadInFlightRef = React.useRef<Promise<void> | null>(null);

  const chatModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'chat'),
    [availableModels]
  );
  async function load() {
    if (loadInFlightRef.current) return loadInFlightRef.current;
    const task = loadSettingsOnce();
    loadInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (loadInFlightRef.current === task) loadInFlightRef.current = null;
    }
  }

  async function loadSettingsOnce() {
    const apply = <T,>(setter: (value: T) => void) => setter;

    void resolveWithin(OfflineMapService.syncNativePacks(), SETTINGS_FAST_TIMEOUT_MS).then(
      (result) => {
        if (!result.ok) return;
        void runProbe(OfflineMapService.listRegions(), apply(setMapRegions));
      }
    );

    await Promise.all([
      runProbe(
        SettingsRepository.getVaultState(),
        (vault) => {
          setVaultProtectionEnabled(vault.isInitialized);
          setAutoLock(vault.autoLockMinutes);
        },
        { timeoutMs: SETTINGS_FAST_TIMEOUT_MS }
      ),
      runProbe(VaultService.getBiometricsEnabled(), apply(setBiometricsEnabled)),
      runProbe(
        PreferencesService.getBatteryReduceModeEnabled(),
        apply(setBatteryReduceModeEnabled)
      ),
      runProbe(
        PreferencesService.getWifiOnlyDownloadsEnabled(),
        apply(setWifiOnlyDownloadsEnabled)
      ),
      runProbe(PreferencesService.getTopHeaderEnabled(), apply(setTopHeaderEnabled)),
      runProbe(PreferencesService.getFieldPreferences(), apply(setFieldPreferences)),
      runProbe(
        FileSystemService.getStorageSummary(),
        (storageState) => {
          setStorage(storageState);
          setStorageUnavailable(false);
        },
        {
          timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
          onFailure: () => setStorageUnavailable(true),
        }
      ),
      runProbe(DownloadManagerService.listDownloads(), apply(setDownloads)),
      runProbe(OfflineMapService.listRegions(), apply(setMapRegions)),
      runProbe(DiagnosticsService.getReport(), apply(setDiagnostics), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
        onFailure: () => setDiagnostics(createUnavailableDiagnosticReport()),
      }),
      runProbe(ModelManagerService.getStatus(), apply(setModelStatus), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
        onFailure: () => setModelStatus(createUnavailableModelStatus()),
      }),
      runProbe(ModelManagerService.listAvailableModels(), apply(setAvailableModels), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
      }),
      runProbe(ModelManagerService.listInstalledChatModels(), apply(setInstalledModels), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
      }),
      runProbe(ModelManagerService.getActiveModel(), apply(setActiveModel), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
      }),
      runProbe(ModelManagerService.listAvailableEmbeddingModels(), apply(setEmbeddingModels)),
      runProbe(ModelManagerService.getActiveEmbeddingModel(), apply(setActiveEmbeddingModel), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
      }),
      runProbe(ModelManagerService.getEmbeddingIndexStatus(), apply(setEmbeddingIndexStatus), {
        timeoutMs: SETTINGS_SLOW_TIMEOUT_MS,
      }),
    ]);
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
    const hasActiveRoutingDownload = mapRegions.some((region) =>
      ['queued', 'downloading'].includes(region.routingStatus)
    );
    if (
      !hasActiveModelDownload &&
      !hasActiveDownload &&
      !hasActiveMapDownload &&
      !hasActiveRoutingDownload &&
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

  async function enableVaultProtection(input: { nextPassword: string; passwordHint: string }) {
    setBusy('password');
    try {
      const result = await VaultService.initializeVault(input.nextPassword, input.passwordHint);
      if (result.ok) {
        setVaultProtectionEnabled(true);
        await load();
      }
      return { ok: result.ok, reason: result.reason };
    } finally {
      setBusy(null);
    }
  }

  async function disableVaultProtection(currentPassword: string) {
    setBusy('password');
    try {
      const result = await VaultService.disableVaultProtection(currentPassword);
      if (result.ok) {
        setVaultProtectionEnabled(false);
        setBiometricsEnabled(false);
        await load();
      }
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

  async function toggleTopHeader() {
    const next = !topHeaderEnabled;
    setTopHeaderEnabled(next);
    await PreferencesService.setTopHeaderEnabled(next);
  }

  async function toggleWifiOnlyDownloads() {
    const next = !wifiOnlyDownloadsEnabled;
    setWifiOnlyDownloadsEnabled(next);
    await PreferencesService.setWifiOnlyDownloadsEnabled(next);
  }

  async function updateFieldPreferences(patch: Partial<FieldPreferences>) {
    const next = await PreferencesService.setFieldPreferences(patch);
    setFieldPreferences(next);
  }

  function confirmDatabaseMigration() {
    showSheetAlert(
      'Encrypt database?',
      'Ark will export this plaintext database to an encrypted SQLCipher copy, keep a plaintext backup, and reopen with the stored device key.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Encrypt DB', onPress: () => void migratePlaintextDatabase() },
      ]
    );
  }

  async function migratePlaintextDatabase() {
    setBusy('db-migration');
    try {
      const result = await DatabaseClient.migratePlaintextDatabaseToEncrypted();
      await load();
      showSheetAlert(
        result.reopenedEncrypted ? 'Database encrypted' : 'Migration needs verification',
        result.reopenedEncrypted
          ? `Ark reopened the encrypted database. Plaintext backup kept at ${result.backupPath}.`
          : `Ark kept a plaintext backup at ${result.backupPath}. Restart Ark and check Diagnostics before deleting it.`
      );
    } catch (err) {
      showSheetAlert(
        'Database migration failed',
        err instanceof Error ? err.message : 'Ark could not encrypt the existing database.'
      );
    } finally {
      setBusy(null);
    }
  }

  function confirmDisableDatabaseEncryption() {
    showSheetAlert(
      'Use plaintext database?',
      'Ark will export the encrypted database to a plaintext copy, keep an encrypted backup, and reopen without SQLCipher. This improves access speed and battery use but removes database-at-rest encryption.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use plaintext',
          style: 'destructive',
          onPress: () => void migrateEncryptedDatabaseToPlaintext(),
        },
      ]
    );
  }

  async function migrateEncryptedDatabaseToPlaintext() {
    setBusy('db-migration');
    try {
      const result = await DatabaseClient.migrateEncryptedDatabaseToPlaintext();
      await load();
      showSheetAlert(
        result.reopenedPlaintext ? 'Database encryption off' : 'Migration needs verification',
        result.reopenedPlaintext
          ? `Ark reopened without SQLCipher. Encrypted backup kept at ${result.backupPath}.`
          : `Encrypted backup kept at ${result.backupPath}. Restart Ark and check Diagnostics.`
      );
    } catch (err) {
      showSheetAlert(
        'Database migration failed',
        err instanceof Error ? err.message : 'Ark could not export the database to plaintext.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function selectModel(model: ContentPack) {
    await ModelManagerService.setSelectedModel(model.id);
    setActiveModel(model);
    setModelStatus(await ModelManagerService.getStatus());
  }

  async function selectEmbeddingModel(model: EmbeddingModelConfig) {
    setBusy(`embedding-${model.id}`);
    setAiMessage(null);
    const previousEmbeddingModel = activeEmbeddingModel;
    setActiveEmbeddingModel(model);
    try {
      await ModelManagerService.setSelectedEmbeddingModel(model.id, {
        onRebuildProgress: async () => {
          setEmbeddingIndexStatus(await ModelManagerService.getEmbeddingIndexStatus());
        },
      });
      await load();
    } catch (modelError) {
      setActiveEmbeddingModel(previousEmbeddingModel);
      setEmbeddingIndexStatus(await ModelManagerService.getEmbeddingIndexStatus());
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

  async function runDownloadAction(download: DownloadRow, action: DownloadRowAction) {
    setBusy(`download-${download.id}`);
    try {
      if (action === 'pause') {
        await DownloadManagerService.pauseDownload(download.id);
      } else if (action === 'resume') {
        await DownloadManagerService.resumeDownload(download.id);
      } else {
        await DownloadManagerService.cancelDownload(download.id);
      }
      await load();
    } catch (error) {
      showSheetAlert(
        'Download action failed',
        error instanceof Error ? error.message : 'Unable to update this download.'
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

  async function retryRoutingDownload(region: MapRegion) {
    setBusy(`routing-retry-${region.id}`);
    try {
      const result = await OfflineMapService.downloadRoutingPack(region.id);
      if (!result.ok) {
        showSheetAlert(
          'Unable to download navigation',
          result.reason ?? 'Check connection and storage.'
        );
      }
      await load();
    } catch (error) {
      showSheetAlert(
        'Navigation download failed',
        error instanceof Error ? error.message : 'Unable to retry navigation data.'
      );
    } finally {
      setBusy(null);
    }
  }

  function clearSelectedDownloadResource() {
    if (!selectedDownloadResourceId) return;
    router.setParams({ downloadId: '' });
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

  async function runAiEvaluation() {
    setBusy('ai-evaluation');
    setAiEvaluationResults(null);
    try {
      setAiEvaluationResults(await AiEvaluationService.runAll());
    } finally {
      setBusy(null);
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
          effectiveTheme={effectiveTheme}
          accentPreference={accentPreference}
          colors={themeColors}
          systemAccentAvailable={systemAccentAvailable}
          systemAccentColors={systemAccentColors}
          setPreference={setPreference}
          setAccentPreference={setAccentPreference}
          batteryReduceModeEnabled={batteryReduceModeEnabled}
          toggleBatteryReduceMode={toggleBatteryReduceMode}
          topHeaderEnabled={topHeaderEnabled}
          toggleTopHeader={toggleTopHeader}
        />
      ) : null}

      {activeTab === 'field' ? (
        <FieldSection preferences={fieldPreferences} onChange={updateFieldPreferences} />
      ) : null}

      {activeTab === 'security' ? (
        <SecuritySection
          vaultProtectionEnabled={vaultProtectionEnabled}
          vaultUnlocked={vaultUnlocked}
          autoLockMinutes={autoLock}
          setLockMinutes={setLockMinutes}
          biometricsEnabled={biometricsEnabled}
          biometricsBusy={busy === 'biometrics'}
          toggleBiometrics={toggleBiometrics}
          changePassword={changePassword}
          enableVaultProtection={enableVaultProtection}
          disableVaultProtection={disableVaultProtection}
          databaseEncryption={diagnostics?.databaseEncryption ?? null}
          encryptionBusy={busy === 'db-migration'}
          onEnableDatabaseEncryption={confirmDatabaseMigration}
          onDisableDatabaseEncryption={confirmDisableDatabaseEncryption}
          passwordBusy={busy === 'password'}
          onLockPress={() => {
            if (vaultUnlocked) {
              setLockSheetOpen(true);
              return;
            }
            router.push('/(tabs)/notes');
          }}
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
                    : storageUnavailable
                      ? 'Storage scan unavailable'
                      : 'Calculating...'}
                </Text>
                {storage?.freeBytes != null ? (
                  <Text variant="muted">
                    {FileSystemService.formatBytes(storage.freeBytes)} free on this device
                  </Text>
                ) : storageUnavailable ? (
                  <Text variant="muted">
                    Ark could not finish the storage scan. Downloads and maps still work.
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
            selectedResourceId={selectedDownloadResourceId}
            onToggleWifiOnlyDownloads={toggleWifiOnlyDownloads}
            onBatchAction={runDownloadBatchAction}
            onRetryDownload={retryDownload}
            onDownloadAction={runDownloadAction}
            onClearSelectedResource={clearSelectedDownloadResource}
            onDeleteMapRegion={confirmDeleteMapRegion}
            onMapRegionAction={runMapRegionAction}
            onRetryRoutingDownload={retryRoutingDownload}
          />

          <DiagnosticsCard
            report={diagnostics}
            migrationBusy={busy === 'db-migration'}
            onMigratePlaintextDatabase={confirmDatabaseMigration}
            aiEvaluationBusy={busy === 'ai-evaluation'}
            aiEvaluationResults={aiEvaluationResults}
            onRunAiEvaluation={() => void runAiEvaluation()}
          />

          <AboutSection version="1.0.0 MVP" onBuildTap={handleBuildTap} />
        </>
      ) : null}
    </Screen>
  );
}
