import { ArkBrandLockup, Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { THEME_OPTIONS } from '@/constants/theme';
import { ModelManagerService } from '@/services/ai/model-manager.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { FileSystemService } from '@/services/files/filesystem.service';
import { PreferencesService } from '@/services/preferences/preferences.service';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import type { ContentPack } from '@/types/content';
import { Link, useLocalSearchParams } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

type SettingsTab = 'appearance' | 'security' | 'ai' | 'storage';

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

  React.useEffect(() => {
    async function load() {
      const [
        vault,
        biometricState,
        motionState,
        storageState,
        nextModelStatus,
        nextInstalledModels,
        nextActiveModel,
        aiPreferences,
      ] = await Promise.all([
        SettingsRepository.getVaultState(),
        VaultService.getBiometricsEnabled(),
        PreferencesService.getMotionEnabled(),
        FileSystemService.getStorageSummary(),
        ModelManagerService.getStatus(),
        ModelManagerService.listInstalledModels(),
        ModelManagerService.getActiveModel(),
        ModelManagerService.getPreferences(),
      ]);
      setAutoLock(vault.autoLockMinutes);
      setPasswordHint(vault.passwordHint ?? '');
      setBiometricsEnabled(biometricState);
      setMotionEnabled(motionState);
      setStorage(storageState);
      setModelStatus(nextModelStatus);
      setInstalledModels(nextInstalledModels);
      setActiveModel(nextActiveModel);
      setModelPickerEnabled(aiPreferences.modelPickerEnabled);
    }
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
              Database encryption is a development-build task.
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
            <View className="flex-row flex-wrap gap-2">
              <Link href="/(tabs)/library" asChild>
                <Button className="flex-1" variant="outline">
                  <Text>Models</Text>
                </Button>
              </Link>
              <Link href="/tools/diagnostics" asChild>
                <Button className="flex-1" variant="outline">
                  <Text>Diagnostics</Text>
                </Button>
              </Link>
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
              <Text variant="large">Active model</Text>
              <Text variant="muted">
                {activeModel
                  ? activeModel.title
                  : 'Download or import a GGUF model before choosing one.'}
              </Text>
            </View>
            {installedModels.length > 1 ? (
              <View className="gap-2">
                {installedModels.map((model) => (
                  <Button
                    key={model.id}
                    className="justify-start"
                    variant={activeModel?.id === model.id ? 'default' : 'outline'}
                    onPress={() => void selectModel(model)}>
                    <Text numberOfLines={1}>{model.title}</Text>
                  </Button>
                ))}
              </View>
            ) : installedModels.length === 1 ? (
              <View className="border-border rounded-md border px-3 py-2">
                <Text>{installedModels[0]?.title}</Text>
              </View>
            ) : null}
          </Card>
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
