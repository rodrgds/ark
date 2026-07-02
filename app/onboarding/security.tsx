import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { OnboardingFrame } from '@/components/onboarding/onboarding-frame';
import { BiometricsService } from '@/services/security/biometrics.service';
import { VaultService } from '@/services/security/vault.service';
import * as React from 'react';
import { TextInput, View } from 'react-native';

export default function SecurityScreen() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [hint, setHint] = React.useState('');
  const [biometrics, setBiometrics] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const confirmInputRef = React.useRef<TextInput>(null);
  const hintInputRef = React.useRef<TextInput>(null);
  const hasPassphrase = password.trim().length > 0;
  const passwordMeetsLength = hasPassphrase && password.length >= 8;
  const passwordsMatch = hasPassphrase && password === confirmPassword;
  const canContinue = !hasPassphrase || (passwordMeetsLength && passwordsMatch);

  React.useEffect(() => {
    BiometricsService.getStatus().then((status) =>
      setAvailable(status.available && status.enrolled)
    );
  }, []);

  async function initialize() {
    if (!hasPassphrase) {
      const result = await VaultService.disableVaultProtection();
      if (!result.ok) setError(result.reason ?? 'Unable to skip passphrase protection.');
      return result.ok;
    }
    if (!passwordMeetsLength) {
      setError('Use at least 8 characters for the vault passphrase.');
      return false;
    }
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
      nextLabel={hasPassphrase ? 'Set Passphrase' : 'Skip for now'}
      nextDisabled={!canContinue}
      hideBranding
      arkyPose="secure"
      step={2}
      totalSteps={8}
      onNext={initialize}>
      <View className="gap-4">
        <Text className="text-foreground leading-6">
          A passphrase is optional. Turn it on when privacy matters; skip it when fast access and
          battery life matter more. You can change this later in Settings.
        </Text>

        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            Vault passphrase
          </Text>
          <Input
            secureTextEntry
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
            }}
            placeholder="Enter passphrase"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            textContentType="newPassword"
            onSubmitEditing={() => confirmInputRef.current?.focus()}
          />
        </View>

        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            Confirm passphrase
          </Text>
          <Input
            ref={confirmInputRef}
            secureTextEntry
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setError(null);
            }}
            placeholder="Re-enter passphrase"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            textContentType="newPassword"
            onSubmitEditing={() => hintInputRef.current?.focus()}
          />
        </View>

        <View className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            Recovery hint
          </Text>
          <Input
            ref={hintInputRef}
            value={hint}
            onChangeText={setHint}
            placeholder="Optional"
            returnKeyType="done"
          />
        </View>

        {!passwordsMatch && confirmPassword.length > 0 ? (
          <Text className="text-destructive text-sm">Passphrases do not match.</Text>
        ) : null}
        {hasPassphrase && !passwordMeetsLength ? (
          <Text className="text-destructive text-sm">
            Use at least 8 characters for the vault passphrase.
          </Text>
        ) : null}

        <Button
          variant={biometrics ? 'default' : 'outline'}
          onPress={() => setBiometrics((value) => !value)}
          disabled={!available || !hasPassphrase}
          className="rounded-xl">
          <Text>
            {!hasPassphrase
              ? 'Add a passphrase to use biometrics'
              : available
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
