import { Button } from '@/components/ui/button';
import { ArkMark } from '@/components/brand/ark-logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/stores/auth-store';
import { VaultService } from '@/services/security/vault.service';
import NetInfo from '@react-native-community/netinfo';
import { Lock, Unlock } from 'lucide-react-native';
import * as React from 'react';
import { Animated, View, Easing, Modal, Pressable} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LockStateBar() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [confirmLockOpen, setConfirmLockOpen] = React.useState(false);
  const [locking, setLocking] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

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
  const [isOnline, setIsOnline] = React.useState<boolean | null>(true);

  React.useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected);
    });
  }, []);

  return (
    <SafeAreaView edges={['top']} className="border-border bg-card border-b">
      <View className="flex-row items-center justify-between gap-3 px-4 py-2">
        <View className="flex-row items-center gap-2">
          <ArkMark size={28} className="rounded-md" />
          <Icon
            as={unlocked ? Unlock : Lock}
            className={unlocked ? 'text-primary size-4' : 'text-muted-foreground size-4'}
          />
          <Text variant="small">{unlocked ? 'Vault unlocked' : 'Vault locked'}</Text>
        </View>

        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <View className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <Text variant="small" className="text-muted-foreground text-[10px] font-bold uppercase">
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          {unlocked ? (
            <Button size="sm" variant="ghost" onPress={() => setConfirmLockOpen(true)}>
              <Text>Lock</Text>
            </Button>
          ) : null}
        </View>
      </View>

      <Modal
        transparent
        visible={confirmLockOpen}
        animationType="fade"
        onRequestClose={() => setConfirmLockOpen(false)}>
        <Pressable className="flex-1 bg-black/50" onPress={() => setConfirmLockOpen(false)}>
          <View className="flex-1 items-center justify-center p-4">
            <Pressable onPress={(event) => event.stopPropagation()}>
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
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
