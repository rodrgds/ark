import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { getPackIcon, getPackModelRoleLabel } from '@/constants/pack-presentation';
import { THEME_OPTIONS } from '@/constants/theme';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { DiagnosticsService } from '@/services/sensors/diagnostics.service';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import type { ContentModelRole, ContentPack } from '@/types/content';
import type { DownloadRow } from '@/types/downloads';
import type { MapRegion } from '@/types/maps';
import type { DiagnosticReport } from '@/types/sensors';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Bot,
  Download,
  HardDrive,
  Map,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

type SettingsTab = 'appearance' | 'security' | 'ai' | 'downloads' | 'internals';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'security', label: 'Security' },
  { value: 'ai', label: 'AI' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'internals', label: 'Internals' },
];

export default function SettingsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: SettingsTab | 'storage' }>();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('appearance');
  const [autoLock, setAutoLock] = React.useState(5);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [nextPassword, setNextPassword] = React.useState('');
  const [passwordHint, setPasswordHint] = React.useState('');
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [motionEnabled, setMotionEnabled] = React.useState(true);
  const [modelPickerEnabled, setModelPickerEnabled] = React.useState(true);
  const [availableModels, setAvailableModels] = React.useState<ContentPack[]>([]);
  const [installedModels, setInstalledModels] = React.useState<ContentPack[]>([]);
  const [activeModel, setActiveModel] = React.useState<ContentPack | null>(null);
  const [activeEmbeddingModel, setActiveEmbeddingModel] = React.useState<ContentPack | null>(null);
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
  const [modelTitle, setModelTitle] = React.useState('');
  const [modelUrl, setModelUrl] = React.useState('');
  const [modelChecksum, setModelChecksum] = React.useState('');
  const [customModelRole, setCustomModelRole] = React.useState<ContentModelRole>('chat');
  const buildTapTimesRef = React.useRef<number[]>([]);

  const chatModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'chat'),
    [availableModels]
  );
  const embeddingModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'embedding'),
    [availableModels]
  );
  async function load() {
    await OfflineMapService.syncNativePacks().catch(() => undefined);
    const [
      vault,
      biometricState,
      motionState,
      storageState,
      downloadRows,
      regions,
      diagnosticReport,
      nextModelStatus,
      nextAvailableModels,
      nextInstalledModels,
      nextActiveModel,
      nextActiveEmbeddingModel,
      nextEmbeddingIndexStatus,
      aiPreferences,
    ] = await Promise.all([
      SettingsRepository.getVaultState(),
      VaultService.getBiometricsEnabled(),
      PreferencesService.getMotionEnabled(),
      FileSystemService.getStorageSummary(),
      DownloadManagerService.listDownloads(),
      OfflineMapService.listRegions(),
      DiagnosticsService.getReport(),
      ModelManagerService.getStatus(),
      ModelManagerService.listAvailableModels(),
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getActiveEmbeddingModel(),
      ModelManagerService.getEmbeddingIndexStatus(),
      ModelManagerService.getPreferences(),
    ]);
    setAutoLock(vault.autoLockMinutes);
    setPasswordHint(vault.passwordHint ?? '');
    setBiometricsEnabled(biometricState);
    setMotionEnabled(motionState);
    setStorage(storageState);
    setDownloads(downloadRows);
    setMapRegions(regions);
    setDiagnostics(diagnosticReport);
    setModelStatus(nextModelStatus);
    setAvailableModels(nextAvailableModels);
    setInstalledModels(nextInstalledModels);
    setActiveModel(nextActiveModel);
    setActiveEmbeddingModel(nextActiveEmbeddingModel);
    setEmbeddingIndexStatus(nextEmbeddingIndexStatus);
    setModelPickerEnabled(aiPreferences.modelPickerEnabled);
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    const requestedTab = tab === 'storage' ? 'internals' : tab;
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
      activeTab !== 'internals' &&
      activeTab !== 'downloads'
    )
      return;
    const interval = setInterval(() => {
      void load();
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, availableModels, downloads, mapRegions]);

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

  async function toggleMotion() {
    const next = !motionEnabled;
    setMotionEnabled(next);
    await PreferencesService.setMotionEnabled(next);
  }

  async function toggleModelPicker() {
    const next = !modelPickerEnabled;
    setModelPickerEnabled(next);
    await ModelManagerService.setModelPickerEnabled(next);
    setModelStatus(await ModelManagerService.getStatus());
  }

  async function selectModel(model: ContentPack) {
    await ModelManagerService.setSelectedModel(model.id);
    setActiveModel(model);
    setModelStatus(await ModelManagerService.getStatus());
  }

  async function selectEmbeddingModel(model: ContentPack) {
    await ModelManagerService.setSelectedEmbeddingModel(model.id);
    setActiveEmbeddingModel(model);
    setEmbeddingIndexStatus(await ModelManagerService.getEmbeddingIndexStatus());
  }

  async function importLocalModel() {
    setBusy('model-import');
    setAiMessage(null);
    try {
      await ContentPackService.importLocalModel(customModelRole);
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
        modelRole: customModelRole,
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
        await ContentPackService.installPack(model.id);
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

  async function retryMapRegion(region: MapRegion) {
    setBusy(`map-${region.id}`);
    try {
      const result = await OfflineMapService.refreshRegion(region.id);
      if (!result.ok) throw new Error(result.reason ?? 'Unable to retry this map download.');
      await load();
    } catch (error) {
      showSheetAlert(
        'Retry failed',
        error instanceof Error ? error.message : 'Unable to retry this map download.'
      );
    } finally {
      setBusy(null);
    }
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
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="h1">Settings</Text>
          <Text variant="muted">Device, vault, and offline runtime controls.</Text>
        </View>
        <Arky pose="signal" size={52} />
      </View>

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
                <Text variant="large">Motion</Text>
                <Text variant="muted">Small transitions and interface feedback.</Text>
              </View>
              <Button
                size="sm"
                variant={motionEnabled ? 'default' : 'outline'}
                onPress={toggleMotion}>
                <Text>{motionEnabled ? 'On' : 'Off'}</Text>
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
                Source search models installed:{' '}
                {embeddingModels.filter((model) => model.installed).length}
              </Text>
              <Text variant="muted">
                Current answer model:{' '}
                {activeModel
                  ? activeModel.title
                  : modelStatus?.chatModelDisabled
                    ? 'Source search only'
                    : 'None installed'}
              </Text>
              <Text variant="muted">
                Current source search model: {activeEmbeddingModel?.title ?? 'Ark hash fallback'}
              </Text>
            </View>
          </Card>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">Answer model selector</Text>
                <Text variant="muted">
                  Show a model switcher in Ask Arky when more than one answer model is installed.
                </Text>
              </View>
              <Button
                size="sm"
                variant={modelPickerEnabled ? 'default' : 'outline'}
                onPress={toggleModelPicker}>
                <Text>{modelPickerEnabled ? 'On' : 'Off'}</Text>
              </Button>
            </View>
          </Card>

          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="large">Add your own model</Text>
              <Text variant="muted">
                Import a GGUF file you already have, or save a custom download URL for later.
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
              <View className="border-border bg-muted/20 flex-row rounded-md border p-1">
                {(['chat', 'embedding'] as const).map((role) => (
                  <Button
                    key={role}
                    className="flex-1"
                    size="sm"
                    variant={customModelRole === role ? 'default' : 'ghost'}
                    onPress={() => setCustomModelRole(role)}>
                    <Text>{role === 'chat' ? 'Answer' : 'Search'}</Text>
                  </Button>
                ))}
              </View>
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
                <Text>{customModelRole === 'chat' ? 'Add answer URL' : 'Add search URL'}</Text>
              </Button>
            </View>
            <Text variant="small" className="text-muted-foreground">
              Choose Answer for Ask Arky replies or Search for local source matching before
              importing a file or adding a URL.
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

          <ModelSection
            title="Source search models"
            description="These help Ark find relevant notes, documents, guides, and Wikipedia articles."
            models={embeddingModels}
            activeModelId={activeEmbeddingModel?.id ?? null}
            busy={busy}
            onPrimaryAction={async (model) => {
              if (model.installed) await selectEmbeddingModel(model);
              else await runModelAction(model);
            }}
            onRemove={removeModel}
          />

          <EmbeddingIndexCard status={embeddingIndexStatus} />

          {aiMessage ? <Text className="text-destructive">{aiMessage}</Text> : null}
        </>
      ) : null}

      {activeTab === 'internals' ? (
        <>
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
          busy={busy}
          onRetryDownload={retryDownload}
          onRetryRegion={retryMapRegion}
        />
      ) : null}
    </Screen>
  );
}

function DownloadsCard({
  downloads,
  mapRegions,
  busy,
  onRetryDownload,
  onRetryRegion,
}: {
  downloads: DownloadRow[];
  mapRegions: MapRegion[];
  busy: string | null;
  onRetryDownload: (download: DownloadRow) => Promise<void>;
  onRetryRegion: (region: MapRegion) => Promise<void>;
}) {
  const activeRows = downloads.filter((download) => download.status !== 'canceled');
  const totalBytes =
    activeRows.reduce((sum, download) => sum + Math.max(0, download.totalBytes ?? 0), 0) +
    mapRegions.reduce((sum, region) => sum + Math.max(0, region.sizeBytes ?? 0), 0);
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            <Icon as={Download} className="text-primary size-5" />
            <Text variant="large">Downloads</Text>
          </View>
          <Text variant="muted">
            Guides, models, archives, and map regions stored for offline use.
          </Text>
        </View>
        {totalBytes > 0 ? (
          <Text variant="small" className="text-muted-foreground">
            {FileSystemService.formatBytes(totalBytes)}
          </Text>
        ) : null}
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
              busy={busy === `map-${region.id}`}
              onRetry={() => onRetryRegion(region)}
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
  onRetry,
}: {
  region: MapRegion;
  busy: boolean;
  onRetry: () => Promise<void>;
}) {
  return (
    <View className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1}>{region.name}</Text>
          <Text variant="small" className="text-muted-foreground">
            Map · {region.status.replace('_', ' ')}
          </Text>
        </View>
        <Icon as={Map} className="text-muted-foreground size-4" />
      </View>
      <Progress value={region.progress ?? 0} />
      {region.sizeBytes ? (
        <Text variant="small" className="text-muted-foreground">
          {FileSystemService.formatBytes(region.sizeBytes)}
        </Text>
      ) : null}
      {region.status === 'failed' ? (
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
  if (model.installed) return 'Installed';
  return 'Download';
}

function isModelDownloadVisible(model: ContentPack) {
  return ['queued', 'downloading', 'verifying', 'paused'].includes(model.installStatus);
}
