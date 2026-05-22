import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/stores/auth-store';
import { VaultService } from '@/services/security/vault.service';
import { Lock, Unlock } from 'lucide-react-native';
import { View } from 'react-native';

export function LockStateBar() {
  const unlocked = useAuthStore((state) => state.unlocked);
  return (
    <View className="border-border bg-card flex-row items-center justify-between gap-3 border-b px-4 py-2">
      <View className="flex-row items-center gap-2">
        <Icon
          as={unlocked ? Unlock : Lock}
          className={unlocked ? 'text-primary size-4' : 'text-muted-foreground size-4'}
        />
        <Text variant="small">{unlocked ? 'Vault unlocked' : 'Vault locked'}</Text>
      </View>
      {unlocked ? (
        <Button size="sm" variant="ghost" onPress={() => VaultService.lock()}>
          <Text>Lock</Text>
        </Button>
      ) : null}
    </View>
  );
}
