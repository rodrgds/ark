import { ArkBrandLockup, Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getPackIcon, getPackModelRoleLabel } from '@/constants/pack-presentation';
import { THEME_OPTIONS } from '@/constants/theme';
import { ContentPackService } from '@/services/content/content-pack.service';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import type { ContentModelRole, ContentPack } from '@/types/content';
import { useLocalSearchParams } from 'expo-router';
import { Bot, Download, ExternalLink, Trash2, Upload } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';

type SettingsTab = 'appearance' | 'security' | 'ai' | 'storage';

const GEMMA_DOCS_URL = 'https://deepmind.google/models/gemma/gemma-4/';
const GEMMA_GGUF_URL = 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF';

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'security', label: 'Security' },
  { value: 'ai', label: 'AI' },
  { value: 'storage', label: 'Storage' },
];

export default function SettingsScreen() {
  const { tab } = useLocalSearchParams<{ tab?: SettingsTab }>();
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
  const [storage, setStorage] = React.useState<Awaited<
    ReturnType<typeof FileSystemService.getStorageSummary>
  > | null>(null);
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

  const chatModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'chat'),
    [availableModels]
  );
  const embeddingModels = React.useMemo(
    () => availableModels.filter((model) => model.modelRole === 'embedding'),
    [availableModels]
  );

  async function load() {
    const [
      vault,
      biometricState,
      motionState,
      storageState,
      nextModelStatus,
      nextAvailableModels,
      nextInstalledModels,
      nextActiveModel,
      aiPreferences,
    ] = await Promise.all([
      SettingsRepository.getVaultState(),
      VaultService.getBiometricsEnabled(),
      PreferencesService.getMotionEnabled(),
      FileSystemService.getStorageSummary(),
      ModelManagerService.getStatus(),
      ModelManagerService.listAvailableModels(),
      ModelManagerService.listInstalledChatModels(),
      ModelManagerService.getActiveModel(),
      ModelManagerService.getPreferences(),
    ]);
    setAutoLock(vault.autoLockMinutes);
    setPasswordHint(vault.passwordHint ?? '');
    setBiometricsEnabled(biometricState);
    setMotionEnabled(motionState);
    setStorage(storageState);
    setModelStatus(nextModelStatus);
    setAvailableModels(nextAvailableModels);
    setInstalledModels(nextInstalledModels);
    setActiveModel(nextActiveModel);
    setModelPickerEnabled(aiPreferences.modelPickerEnabled);
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    if (tab && SETTINGS_TABS.some((item) => item.value === tab)) {
      setActiveTab(tab);
    }
  }, [tab]);

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
      Alert.alert('Passphrase changed', 'The vault verifier has been updated on this device.');
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

  const currentTheme = THEME_OPTIONS.find((option) => option.value === preference);

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
                  Alert.alert('Lock vault?', 'Secure notes will require unlock again.', [
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
                    ? 'Local runtime ready'
                    : `${modelStatus.installedModels} model file(s) installed`
                  : 'Checking model status...'}
              </Text>
              {modelStatus ? <Text variant="muted">{modelStatus.message}</Text> : null}
            </View>
            <View className="bg-muted/40 gap-1 rounded-md px-3 py-3">
              <Text variant="small">Chat models installed: {installedModels.length}</Text>
              <Text variant="small">
                Search models installed: {embeddingModels.filter((model) => model.installed).length}
              </Text>
              {activeModel ? (
                <Text variant="muted">Current chat model: {activeModel.title}</Text>
              ) : null}
            </View>
            <View className="border-border bg-muted/30 gap-3 rounded-md border px-3 py-3">
              <View className="gap-1">
                <Text variant="large">Gemma recommendations</Text>
                <Text variant="muted">
                  Use Gemma 4 E2B Q4_K_M on newer devices with several GB free. Keep Gemma 3 1B for
                  lower-memory phones or quick fallback testing.
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={() => void Linking.openURL(GEMMA_DOCS_URL)}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>Gemma 4 guide</Text>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onPress={() => void Linking.openURL(GEMMA_GGUF_URL)}>
                  <Icon as={ExternalLink} className="size-4" />
                  <Text>GGUF variants</Text>
                </Button>
              </View>
            </View>
          </Card>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">Chat model selector</Text>
                <Text variant="muted">
                  Allow Ask Arky to switch between downloaded GGUF models.
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
                    <Text>{role === 'chat' ? 'Chat' : 'Search'}</Text>
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
                <Text>{customModelRole === 'chat' ? 'Add chat URL' : 'Add search URL'}</Text>
              </Button>
            </View>
            <Text variant="small" className="text-muted-foreground">
              Choose Chat for Ask Arky responses or Search for Nomic/Qwen embedding GGUFs before
              importing a file or adding a URL.
            </Text>
          </Card>

          <ModelSection
            title="Chat models"
            description="These are the only models Ask Arky can switch between."
            models={chatModels}
            activeModelId={activeModel?.id ?? null}
            busy={busy}
            onPrimaryAction={runModelAction}
            onRemove={removeModel}
          />

          <ModelSection
            title="Search models"
            description="These help Ask Arky find relevant notes, documents, guides, and Wikipedia articles. They do not appear in chat model selection."
            models={embeddingModels}
            activeModelId={null}
            busy={busy}
            onPrimaryAction={runModelAction}
            onRemove={removeModel}
          />

          {aiMessage ? <Text className="text-destructive">{aiMessage}</Text> : null}
        </>
      ) : null}

      {activeTab === 'storage' ? (
        <>
          <Card className="gap-3">
            <View className="gap-1">
              <Text variant="muted">Offline storage</Text>
              <Text variant="h3">{storage?.label ?? 'Calculating...'}</Text>
              {storage?.freeBytes != null ? (
                <Text variant="muted">
                  {FileSystemService.formatBytes(storage.freeBytes)} free on this device
                </Text>
              ) : null}
            </View>
            {storage ? (
              <View className="border-border overflow-hidden rounded-md border">
                {Object.entries(storage.directorySizes).map(([name, bytes]) => (
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

          <Card className="gap-2">
            <ArkBrandLockup compact />
            <Text variant="muted">Version 1.0.0 MVP</Text>
          </Card>
        </>
      ) : null}
    </Screen>
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
                </View>
              </View>
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  variant={model.installed && isActive ? 'default' : 'outline'}
                  disabled={primaryBusy || (model.installed && model.modelRole !== 'chat')}
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
  if (model.installStatus === 'downloading' || model.installStatus === 'queued')
    return 'Cancel download';
  if (model.installStatus === 'verifying') return 'Verifying';
  if (model.installStatus === 'paused') return 'Resume';
  if (model.installed && model.modelRole === 'chat') return isActive ? 'In use' : 'Use for chat';
  if (model.installed) return 'Installed';
  return 'Download';
}
