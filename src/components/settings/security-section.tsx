import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import type { DiagnosticReport } from '@/types/sensors';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type SecuritySectionProps = {
  vaultProtectionEnabled: boolean;
  vaultUnlocked: boolean;
  autoLockMinutes: number;
  setLockMinutes: (minutes: number) => void | Promise<void>;
  biometricsEnabled: boolean;
  biometricsBusy: boolean;
  toggleBiometrics: () => void | Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    nextPassword: string;
    passwordHint: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  enableVaultProtection: (input: {
    nextPassword: string;
    passwordHint: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  disableVaultProtection: (currentPassword: string) => Promise<{ ok: boolean; reason?: string }>;
  databaseEncryption: DiagnosticReport['databaseEncryption'] | null;
  encryptionBusy: boolean;
  onEnableDatabaseEncryption: () => void;
  onDisableDatabaseEncryption: () => void;
  passwordBusy: boolean;
  onLockPress: () => void;
};

const AUTO_LOCK_OPTIONS = [1, 5, 15, 60] as const;

type PasswordState = {
  vaultUnlocked: boolean;
  currentPassword: string;
  nextPassword: string;
  passwordHint: string;
};

export function SecuritySection({
  vaultProtectionEnabled,
  vaultUnlocked,
  autoLockMinutes,
  setLockMinutes,
  biometricsEnabled,
  biometricsBusy,
  toggleBiometrics,
  changePassword,
  enableVaultProtection,
  disableVaultProtection,
  databaseEncryption,
  encryptionBusy,
  onEnableDatabaseEncryption,
  onDisableDatabaseEncryption,
  passwordBusy,
  onLockPress,
}: SecuritySectionProps) {
  const [passwordState, setPasswordState] = React.useState<PasswordState>(() => ({
    vaultUnlocked,
    currentPassword: '',
    nextPassword: '',
    passwordHint: '',
  }));
  const [securityMessage, setSecurityMessage] = React.useState<string | null>(null);
  const { currentPassword, nextPassword, passwordHint } = passwordState;

  if (passwordState.vaultUnlocked !== vaultUnlocked) {
    setPasswordState({
      vaultUnlocked,
      currentPassword: '',
      nextPassword: '',
      passwordHint: '',
    });
  }

  async function handleChangePassword() {
    setSecurityMessage(null);
    const result = await changePassword({ currentPassword, nextPassword, passwordHint });
    if (!result.ok) {
      setSecurityMessage(result.reason ?? 'Unable to change passphrase.');
      return;
    }
    setPasswordState((current) => ({
      ...current,
      currentPassword: '',
      nextPassword: '',
    }));
    showSheetAlert('Passphrase changed', 'The vault verifier has been updated on this device.');
  }

  async function handleEnableProtection() {
    setSecurityMessage(null);
    const result = await enableVaultProtection({ nextPassword, passwordHint });
    if (!result.ok) {
      setSecurityMessage(result.reason ?? 'Unable to turn on passphrase protection.');
      return;
    }
    setPasswordState((current) => ({ ...current, currentPassword: '', nextPassword: '' }));
    showSheetAlert('Passphrase protection on', 'Secure notes now require the vault passphrase.');
  }

  async function handleDisableProtection() {
    setSecurityMessage(null);
    const result = await disableVaultProtection(currentPassword);
    if (!result.ok) {
      setSecurityMessage(result.reason ?? 'Unable to turn off passphrase protection.');
      return;
    }
    setPasswordState((current) => ({ ...current, currentPassword: '', nextPassword: '' }));
    showSheetAlert('Passphrase protection off', 'Secure notes are available without unlocking.');
  }

  const canEnableDatabaseEncryption =
    databaseEncryption?.runtimeActive && databaseEncryption.databaseState === 'plaintext';
  const canDisableDatabaseEncryption = databaseEncryption?.databaseState === 'encrypted';

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Vault</Text>
            <Text variant="muted">
              {vaultProtectionEnabled
                ? 'Secure notes require an unlocked vault.'
                : 'Passphrase protection is off for fast access.'}
            </Text>
          </View>
          {vaultProtectionEnabled ? (
            <Button size="sm" onPress={onLockPress}>
              <Text>{vaultUnlocked ? 'Lock' : 'Unlock'}</Text>
            </Button>
          ) : null}
        </View>

        {vaultProtectionEnabled ? (
          <View className="gap-2">
            <Text variant="muted">Auto-lock</Text>
            <View className="flex-row flex-wrap gap-2">
              {AUTO_LOCK_OPTIONS.map((minutes) => (
                <Button
                  key={minutes}
                  className="flex-1"
                  size="sm"
                  variant={autoLockMinutes === minutes ? 'default' : 'outline'}
                  onPress={() => setLockMinutes(minutes)}>
                  <Text>{minutes === 60 ? '1 hr' : `${minutes} min`}</Text>
                </Button>
              ))}
            </View>
          </View>
        ) : null}

        {vaultProtectionEnabled ? (
          <Button
            variant="outline"
            disabled={biometricsBusy}
            onPress={() => void toggleBiometrics()}>
            {biometricsBusy ? <ActivityIndicator /> : null}
            <Text>{biometricsEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}</Text>
          </Button>
        ) : null}
      </Card>

      <Card className="gap-3">
        <Text variant="large">Passphrase</Text>
        {!vaultProtectionEnabled ? (
          <>
            <Text variant="muted">
              Add a passphrase when you want note access gated again. Database encryption is a
              separate control below.
            </Text>
            <Input
              value={nextPassword}
              onChangeText={(value) =>
                setPasswordState((current) => ({ ...current, nextPassword: value }))
              }
              placeholder="New passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={passwordHint}
              onChangeText={(value) =>
                setPasswordState((current) => ({ ...current, passwordHint: value }))
              }
              placeholder="Password hint"
            />
            <Button
              variant="outline"
              disabled={passwordBusy || nextPassword.length < 8}
              onPress={() => void handleEnableProtection()}>
              {passwordBusy ? <ActivityIndicator /> : null}
              <Text>Turn On Passphrase</Text>
            </Button>
          </>
        ) : vaultUnlocked ? (
          <>
            <Input
              value={currentPassword}
              onChangeText={(value) =>
                setPasswordState((current) => ({ ...current, currentPassword: value }))
              }
              placeholder="Current passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={nextPassword}
              onChangeText={(value) =>
                setPasswordState((current) => ({ ...current, nextPassword: value }))
              }
              placeholder="New passphrase"
              secureTextEntry
              autoCapitalize="none"
            />
            <Input
              value={passwordHint}
              onChangeText={(value) =>
                setPasswordState((current) => ({ ...current, passwordHint: value }))
              }
              placeholder="Password hint"
            />
            <Button
              variant="outline"
              disabled={passwordBusy || !currentPassword || !nextPassword}
              onPress={() => void handleChangePassword()}>
              {passwordBusy ? <ActivityIndicator /> : null}
              <Text>Change Passphrase</Text>
            </Button>
            <Button
              variant="outline"
              disabled={passwordBusy || !currentPassword}
              onPress={() => void handleDisableProtection()}>
              {passwordBusy ? <ActivityIndicator /> : null}
              <Text>Turn Off Passphrase</Text>
            </Button>
          </>
        ) : (
          <Text variant="muted">Unlock the vault to change your passphrase or recovery hint.</Text>
        )}
        {securityMessage ? <Text className="text-destructive">{securityMessage}</Text> : null}
      </Card>

      <Card className="gap-3">
        <Text variant="large">Database encryption</Text>
        <Text variant="muted">
          {databaseEncryption
            ? databaseEncryption.stateLabel
            : 'Checking database encryption state...'}
        </Text>
        <Text variant="small" className="text-muted-foreground">
          Keep this off for maximum speed and battery. Turn it on when at-rest protection matters.
        </Text>
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            variant="outline"
            disabled={!canEnableDatabaseEncryption || encryptionBusy}
            onPress={onEnableDatabaseEncryption}>
            {encryptionBusy ? <ActivityIndicator /> : null}
            <Text>Encrypt DB</Text>
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={!canDisableDatabaseEncryption || encryptionBusy}
            onPress={onDisableDatabaseEncryption}>
            {encryptionBusy ? <ActivityIndicator /> : null}
            <Text>Use Plaintext</Text>
          </Button>
        </View>
      </Card>
    </>
  );
}
