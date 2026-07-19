import { Button } from '@/components/ui/button';
import { AppHeaderActionsSlot } from '@/components/layout/app-header-actions';
import { FunctionSearchButton } from '@/components/layout/function-search';
import { VaultLockSheet } from '@/components/security/vault-lock-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { NetworkService } from '@/services/connectivity/network.service';
import { router } from 'expo-router';
import { Lock, Unlock } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LockStateBar() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const vaultProtectionEnabled = useAppStore((state) => !!state.vault?.isInitialized);
  const [confirmLockOpen, setConfirmLockOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean | null>(null);
  const networkStatusClass =
    isOnline === null ? 'bg-muted-foreground' : isOnline ? 'bg-green-500' : 'bg-red-500';
  const networkStatusLabel = isOnline === null ? 'Checking' : isOnline ? 'Online' : 'Offline';

  React.useEffect(() => {
    void NetworkService.getState().then((state) => {
      setIsOnline(NetworkService.isOnline(state));
    });
    return NetworkService.subscribeDebounced((state) => {
      setIsOnline(NetworkService.isOnline(state));
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} className="border-border bg-card border-b">
      <View className="flex-row items-center justify-between gap-3 px-4 py-2">
        {vaultProtectionEnabled ? (
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel={unlocked ? 'Lock vault' : 'Unlock vault'}
            onPress={() => {
              if (unlocked) {
                setConfirmLockOpen(true);
                return;
              }
              router.push('/(tabs)/notes');
            }}
            className="h-11 w-11 rounded-full">
            <Icon
              as={unlocked ? Lock : Unlock}
              className={unlocked ? 'text-primary size-4' : 'text-muted-foreground size-4'}
            />
          </Button>
        ) : (
          <View className="h-11 w-11" />
        )}

        <View className="flex-row items-center gap-2">
          <AppHeaderActionsSlot />
          <FunctionSearchButton />
          <View className="flex-row items-center gap-1.5">
            <View className={`h-2 w-2 rounded-full ${networkStatusClass}`} />
            <Text variant="small" className="text-muted-foreground text-[10px] font-bold uppercase">
              {networkStatusLabel}
            </Text>
          </View>
        </View>
      </View>

      {vaultProtectionEnabled ? (
        <VaultLockSheet visible={confirmLockOpen} onDismiss={() => setConfirmLockOpen(false)} />
      ) : null}
    </SafeAreaView>
  );
}
