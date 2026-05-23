import { Text } from '@/components/ui/text';
import { APP_NAME, APP_SLOGAN } from '@/constants/app';
import { cn } from '@/lib/utils';
import { Image } from 'expo-image';
import { View } from 'react-native';

// Standardized logo component using the primary app icon asset.
// This makes it easy to update the brand by replacing a single file.
export function ArkMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <View
      className={cn(
        'border-primary/20 bg-primary/5 items-center justify-center overflow-hidden rounded-xl border',
        className
      )}
      style={{ width: size, height: size, borderCurve: 'continuous' }}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: size * 0.8, height: size * 0.8 }}
        contentFit="contain"
      />
    </View>
  );
}

export function ArkBrandLockup({
  subtitle = APP_SLOGAN,
  compact = false,
  center = false,
}: {
  subtitle?: string;
  compact?: boolean;
  center?: boolean;
}) {
  return (
    <View className={cn('gap-3', center ? 'items-center' : 'flex-row items-center')}>
      <ArkMark size={compact ? 44 : 64} />
      <View className={cn('min-w-0', center ? 'items-center' : 'flex-1')}>
        <Text variant={compact ? 'h3' : 'h1'} className={center ? 'text-center' : 'text-left'}>
          {APP_NAME}
        </Text>
        {subtitle ? (
          <Text variant="muted" className={center ? 'text-center' : undefined}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
