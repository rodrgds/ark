import { Button } from '@/components/ui/button';
import { ArkMark } from '@/components/brand/ark-logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/stores/auth-store';
import { VaultService } from '@/services/security/vault.service';
import { Lock, Unlock } from 'lucide-react-native';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function LockStateBar() {
  const unlocked = useAuthStore((state) => state.unlocked);
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
        {unlocked ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              Alert.alert('Lock vault?', 'Secure notes will require unlock again.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Lock', style: 'destructive', onPress: () => VaultService.lock() },
              ])
            }>
            <Text>Lock</Text>
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
