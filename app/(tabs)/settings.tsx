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
import { Link } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

export default function SettingsScreen() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [autoLock, setAutoLock] = React.useState(5);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [nextPassword, setNextPassword] = React.useState('');
  const [passwordHint, setPasswordHint] = React.useState('');
  const [biometricsEnabled, setBiometricsEnabled] = React.useState(false);
  const [motionEnabled, setMotionEnabled] = React.useState(true);
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
      const [vault, biometricState, motionState, storageState, nextModelStatus] = await Promise.all([
        SettingsRepository.getVaultState(),
        VaultService.getBiometricsEnabled(),
        PreferencesService.getMotionEnabled(),
        FileSystemService.getStorageSummary(),
        ModelManagerService.getStatus(),
      ]);
      setAutoLock(vault.autoLockMinutes);
      setPasswordHint(vault.passwordHint ?? '');
      setBiometricsEnabled(biometricState);
      setMotionEnabled(motionState);
      setStorage(storageState);
      setModelStatus(nextModelStatus);
    }
    void load();
  }, []);

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

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-2">
          <Text variant="h1">Settings</Text>
          <Text variant="muted">Configure Arky for your specific offline needs.</Text>
        </View>
        <Arky pose="signal" size={80} />
      </View>
      <Card className="gap-3">
        <Text variant="large">Theme</Text>
        {THEME_OPTIONS.map((option) => (
          <View key={option.value} className="gap-2">
            <Button
              variant={preference === option.value ? 'default' : 'outline'}
              onPress={() => setPreference(option.value)}>
              <Text>{option.label}</Text>
            </Button>
            <Text variant="muted">{option.description}</Text>
          </View>
        ))}
      </Card>
      <Card className="gap-3">
        <Text variant="large">Security</Text>
        <Button
          onPress={() =>
            Alert.alert('Lock vault?', 'Secure notes will require unlock again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Lock', style: 'destructive', onPress: () => VaultService.lock() },
            ])
          }>
          <Text>Lock now</Text>
        </Button>
        <View className="gap-2">
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
          <Input value={passwordHint} onChangeText={setPasswordHint} placeholder="Password hint" />
          <Button
            variant="outline"
            disabled={busy === 'password' || !currentPassword || !nextPassword}
            onPress={changePassword}>
            {busy === 'password' ? <ActivityIndicator /> : null}
            <Text>Change Passphrase</Text>
          </Button>
        </View>
        <Button variant="outline" disabled={busy === 'biometrics'} onPress={toggleBiometrics}>
          {busy === 'biometrics' ? <ActivityIndicator /> : null}
          <Text>{biometricsEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}</Text>
        </Button>
        <Text variant="muted">Auto-lock after inactivity</Text>
        <View className="flex-row flex-wrap gap-2">
          {[1, 5, 15, 60].map((minutes) => (
            <Button
              key={minutes}
              size="sm"
              variant={autoLock === minutes ? 'default' : 'outline'}
              onPress={() => setLockMinutes(minutes)}>
              <Text>{minutes === 60 ? '1 hour' : `${minutes} min`}</Text>
            </Button>
          ))}
        </View>
        {securityMessage ? <Text className="text-destructive">{securityMessage}</Text> : null}
        <Text variant="small" className="text-muted-foreground">
          Device database encryption is a development-build task. Diagnostics shows the current
          runtime state.
        </Text>
      </Card>
      <Card className="gap-3">
        <Text variant="large">Experience</Text>
        <Button variant={motionEnabled ? 'default' : 'outline'} onPress={toggleMotion}>
          <Text>{motionEnabled ? 'Subtle Motion On' : 'Subtle Motion Off'}</Text>
        </Button>
        <Text variant="muted">
          Controls small transitions during onboarding and future interface changes.
        </Text>
      </Card>
      <Card className="gap-3">
        <Text variant="large">Management</Text>
        <View className="gap-1">
          <Text variant="muted">Offline storage</Text>
          <Text variant="h3">{storage?.label ?? 'Calculating...'}</Text>
          {storage?.freeBytes != null ? (
            <Text variant="muted">
              {FileSystemService.formatBytes(storage.freeBytes)} free on this device
            </Text>
          ) : null}
          {storage
            ? Object.entries(storage.directorySizes).map(([name, bytes]) => (
                <Text key={name} variant="muted">
                  {name}: {FileSystemService.formatBytes(bytes)}
                </Text>
              ))
            : null}
        </View>
        <Link href="/(tabs)/library" asChild>
          <Button variant="outline">
            <Text>Content packs</Text>
          </Button>
        </Link>
        <View className="gap-1">
          <Text variant="muted">Local AI</Text>
          <Text>
            {modelStatus
              ? modelStatus.adapter === 'llama'
                ? 'Offline model ready'
                : `${modelStatus.installedModels} model file(s) installed`
              : 'Checking model status...'}
          </Text>
          {modelStatus ? <Text variant="muted">{modelStatus.message}</Text> : null}
        </View>
        <Link href="/(tabs)/map" asChild>
          <Button variant="outline">
            <Text>Map regions</Text>
          </Button>
        </Link>
        <Link href="/tools/diagnostics" asChild>
          <Button variant="outline">
            <Text>Diagnostics</Text>
          </Button>
        </Link>
      </Card>
      <Card className="gap-2">
        <ArkBrandLockup compact />
        <Text variant="muted">Version 1.0.0 MVP</Text>
      </Card>
    </Screen>
  );
}
