import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type SecuritySectionProps = {
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
  passwordBusy: boolean;
  onLockPress: () => void;
};

const AUTO_LOCK_OPTIONS = [1, 5, 15, 60] as const;

export function SecuritySection({
  vaultUnlocked,
  autoLockMinutes,
  setLockMinutes,
  biometricsEnabled,
  biometricsBusy,
  toggleBiometrics,
  changePassword,
  passwordBusy,
  onLockPress,
}: SecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [nextPassword, setNextPassword] = React.useState('');
  const [passwordHint, setPasswordHint] = React.useState('');
  const [securityMessage, setSecurityMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!vaultUnlocked) {
      setCurrentPassword('');
      setNextPassword('');
      setPasswordHint('');
    }
  }, [vaultUnlocked]);

  async function handleChangePassword() {
    setSecurityMessage(null);
    const result = await changePassword({ currentPassword, nextPassword, passwordHint });
    if (!result.ok) {
      setSecurityMessage(result.reason ?? 'Unable to change passphrase.');
      return;
    }
    setCurrentPassword('');
    setNextPassword('');
    showSheetAlert('Passphrase changed', 'The vault verifier has been updated on this device.');
  }

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Vault</Text>
            <Text variant="muted">Secure notes require an unlocked vault.</Text>
          </View>
          <Button size="sm" onPress={onLockPress}>
            <Text>Lock</Text>
          </Button>
        </View>

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

        <Button variant="outline" disabled={biometricsBusy} onPress={() => void toggleBiometrics()}>
          {biometricsBusy ? <ActivityIndicator /> : null}
          <Text>{biometricsEnabled ? 'Disable Biometrics' : 'Enable Biometrics'}</Text>
        </Button>
      </Card>

      <Card className="gap-3">
        <Text variant="large">Passphrase</Text>
        {vaultUnlocked ? (
          <>
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
              disabled={passwordBusy || !currentPassword || !nextPassword}
              onPress={() => void handleChangePassword()}>
              {passwordBusy ? <ActivityIndicator /> : null}
              <Text>Change Passphrase</Text>
            </Button>
            {securityMessage ? (
              <Text className="text-destructive">{securityMessage}</Text>
            ) : null}
          </>
        ) : (
          <Text variant="muted">Unlock the vault to change your passphrase or recovery hint.</Text>
        )}
        <Text variant="small" className="text-muted-foreground">
          Stronger device encryption is enabled in supported builds.
        </Text>
      </Card>
    </>
  );
}
