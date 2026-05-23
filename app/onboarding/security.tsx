import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { BiometricsService } from '@/services/security/biometrics.service';
import { VaultService } from '@/services/security/vault.service';
import * as React from 'react';
import { View } from 'react-native';

export default function SecurityScreen() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [hint, setHint] = React.useState('');
  const [biometrics, setBiometrics] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const trimmedPassword = password.trim();
  const passwordsMatch = trimmedPassword.length > 0 && password === confirmPassword;
  const canContinue = trimmedPassword.length >= 8 && passwordsMatch;

  React.useEffect(() => {
    BiometricsService.getStatus().then((status) =>
      setAvailable(status.available && status.enrolled)
    );
  }, []);

  async function initialize() {
    if (password !== confirmPassword) {
      setError('Passphrases do not match.');
      return false;
    }
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
      title="Secure your vault"
      nextHref="/onboarding/permissions"
      nextLabel="Set Passphrase"
      nextDisabled={!canContinue}
      hideBranding
      arkyPose="secure"
      step={2}
      totalSteps={7}
      onNext={initialize}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          Choose a passphrase you can remember under pressure. You will need it to unlock your
          notes and private files.
        </Text>

        <Input
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Vault passphrase"
          autoCapitalize="none"
        />
        <Input
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm passphrase"
          autoCapitalize="none"
        />
        <Input value={hint} onChangeText={setHint} placeholder="Hint (optional)" />

        {!passwordsMatch && confirmPassword.length > 0 ? (
          <Text className="text-destructive text-sm">Passphrases do not match.</Text>
        ) : null}
        {trimmedPassword.length > 0 && trimmedPassword.length < 8 ? (
          <Text className="text-destructive text-sm">
            Use at least 8 characters for the vault passphrase.
          </Text>
        ) : null}

        <Button
          variant={biometrics ? 'default' : 'outline'}
          onPress={() => setBiometrics((value) => !value)}
          disabled={!available}
          className="rounded-xl">
          <Text>
            {available
              ? biometrics
                ? 'Biometrics enabled'
                : 'Enable biometric unlock'
              : 'Biometrics unavailable'}
          </Text>
        </Button>

        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      </View>
    </OnboardingFrame>
  );
}
