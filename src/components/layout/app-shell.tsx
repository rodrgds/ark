import { Button } from '@/components/ui/button';
import { AppHeaderActionsSlot } from '@/components/layout/app-header-actions';
import { FunctionSearchButton } from '@/components/layout/function-search';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/stores/auth-store';
import { VaultService } from '@/services/security/vault.service';
import { NetworkService } from '@/services/connectivity/network.service';
import { Lock, Unlock } from 'lucide-react-native';
import * as React from 'react';
import { Animated, View, Easing, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LockStateBar() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [confirmLockOpen, setConfirmLockOpen] = React.useState(false);
  const [locking, setLocking] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean | null>(null);
  const anim = React.useRef(new Animated.Value(0)).current;
  const networkStatusClass =
    isOnline === null ? 'bg-muted-foreground' : isOnline ? 'bg-green-500' : 'bg-red-500';
  const networkStatusLabel = isOnline === null ? 'Checking' : isOnline ? 'Online' : 'Offline';

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '12deg'],
  });

  React.useEffect(() => {
    if (!confirmLockOpen) {
      setLocking(false);
      anim.setValue(0);
    }
  }, [anim, confirmLockOpen]);

  function runLockAnimation() {
    if (locking) return;
    setLocking(true);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setConfirmLockOpen(false);
      setLocking(false);
      VaultService.lock();
    });
  }
  React.useEffect(() => {
    void NetworkService.getState().then((state) => {
      setIsOnline(NetworkService.isOnline(state));
    });
    return NetworkService.subscribe((state) => {
      setIsOnline(NetworkService.isOnline(state));
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} className="border-border bg-card border-b">
      <View className="flex-row items-center justify-between gap-3 px-4 py-2">
        <Button
          size="icon"
          variant="ghost"
          accessibilityLabel={unlocked ? 'Lock vault' : 'Vault locked'}
          disabled={!unlocked}
          onPress={() => setConfirmLockOpen(true)}
          className="h-9 w-9 rounded-full">
          <Icon
            as={Lock}
            className={unlocked ? 'text-primary size-4' : 'text-muted-foreground size-4'}
          />
        </Button>

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

      <ArkBottomSheet
        visible={confirmLockOpen}
        title="Lock vault?"
        description="Secure notes will require unlock again."
        onDismiss={() => setConfirmLockOpen(false)}>
        <View className="w-full items-center gap-4">
          <Pressable onPress={runLockAnimation} disabled={locking} hitSlop={12}>
            <Animated.View
              className="bg-card border-border h-28 w-28 items-center justify-center rounded-full border-2"
              style={{ transform: [{ scale }, { rotate }] }}>
              <Icon
                as={locking ? Lock : Unlock}
                className={locking ? 'text-primary size-10' : 'text-muted-foreground size-10'}
              />
            </Animated.View>
          </Pressable>
          <Text variant="small" className="text-muted-foreground text-center">
            Tap the vault control to lock this session.
          </Text>
        </View>
      </ArkBottomSheet>
    </SafeAreaView>
  );
}
