import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VaultService } from '@/services/security/vault.service';
import { Lock, Unlock } from 'lucide-react-native';
import * as React from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

type VaultLockSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onLocked?: () => void;
};

export function VaultLockSheet({ visible, onDismiss, onLocked }: VaultLockSheetProps) {
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
    if (!visible) {
      setLocking(false);
      anim.setValue(0);
    }
  }, [anim, visible]);

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
      onDismiss();
      setLocking(false);
      VaultService.lock();
      onLocked?.();
    });
  }

  return (
    <ArkBottomSheet
      visible={visible}
      title="Lock vault?"
      description="Secure notes will require unlock again."
      onDismiss={onDismiss}>
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
  );
}
