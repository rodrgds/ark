import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { APP_NAME, APP_SLOGAN } from '@/constants/app';
import { THEME_OPTIONS } from '@/constants/theme';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { VaultService } from '@/services/security/vault.service';
import { useThemeStore } from '@/stores/theme-store';
import { Link } from 'expo-router';
import * as React from 'react';

export default function SettingsScreen() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [autoLock, setAutoLock] = React.useState(5);

  React.useEffect(() => {
    SettingsRepository.getVaultState().then((vault) => setAutoLock(vault.autoLockMinutes));
  }, []);

  async function setLockMinutes(minutes: number) {
    await SettingsRepository.updateVaultState({ autoLockMinutes: minutes });
    setAutoLock(minutes);
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text variant="large">Theme</Text>
        {THEME_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={preference === option.value ? 'default' : 'outline'}
            onPress={() => setPreference(option.value)}>
            <Text>{option.label}</Text>
          </Button>
        ))}
      </Card>
      <Card className="gap-3">
        <Text variant="large">Security</Text>
        <Button onPress={() => VaultService.lock()}>
          <Text>Lock now</Text>
        </Button>
        <Button variant="outline">
          <Text>Change password placeholder</Text>
        </Button>
        <Button variant="outline">
          <Text>Enable/disable biometrics placeholder</Text>
        </Button>
        <Text variant="muted">Auto-lock timeout: {autoLock} minutes</Text>
        <Button variant="outline" onPress={() => setLockMinutes(autoLock === 5 ? 15 : 5)}>
          <Text>Toggle 5/15 minutes</Text>
        </Button>
      </Card>
      <Card className="gap-3">
        <Text variant="large">Management</Text>
        <Link href="/(tabs)/library" asChild>
          <Button variant="outline">
            <Text>Content packs</Text>
          </Button>
        </Link>
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
        <Text variant="large">{APP_NAME}</Text>
        <Text variant="muted">{APP_SLOGAN}</Text>
        <Text variant="muted">Version 1.0.0 MVP</Text>
      </Card>
    </Screen>
  );
}
