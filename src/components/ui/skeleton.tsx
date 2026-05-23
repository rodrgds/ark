import { cn } from '@/lib/utils';
import { View } from 'react-native';

export function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('bg-muted rounded-md opacity-70', className)} {...props} />;
}
