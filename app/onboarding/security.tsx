import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { BiometricsService } from '@/services/security/biometrics.service';
import { VaultService } from '@/services/security/vault.service';
import * as React from 'react';
import { View } from 'react-native';

export default function SecurityScreen() {
  const [password, setPassword] = React.useState('');
  const [hint, setHint] = React.useState('');
  const [biometrics, setBiometrics] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    BiometricsService.getStatus().then((status) =>
      setAvailable(status.available && status.enrolled)
    );
  }, []);

  async function initialize() {
    const result = await VaultService.initializeVault(password, hint, biometrics && available);
    if (!result.ok) {
      setError(result.reason ?? 'Unable to create vault.');
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <OnboardingFrame
      title="Create your vault"
      nextHref="/onboarding/permissions"
      onNext={initialize}>
      <Card className="gap-3">
        <Text variant="muted">
          Choose a passphrase you can remember under pressure. Ark never stores the raw passphrase.
        </Text>
        <Input
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Vault passphrase"
          autoCapitalize="none"
        />
        <Input value={hint} onChangeText={setHint} placeholder="Password hint (optional)" />
        <Button
          variant={biometrics ? 'default' : 'outline'}
          onPress={() => setBiometrics((value) => !value)}
          disabled={!available}>
          <Text>
            {available
              ? biometrics
                ? 'Biometrics enabled'
                : 'Enable biometric unlock'
              : 'Biometrics unavailable'}
          </Text>
        </Button>
        {error ? <Text className="text-destructive">{error}</Text> : null}
      </Card>
      <View>
        <Text variant="muted">Biometrics are optional and can be changed later in Settings.</Text>
      </View>
    </OnboardingFrame>
  );
}
