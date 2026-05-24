import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ActionCardProps = React.ComponentProps<typeof Pressable> & {
  title: string;
  description?: string;
  icon: LucideIcon;
  right?: React.ReactNode;
};

export function ActionCard({
  title,
  description,
  icon,
  right,
  className,
  onPressIn,
  onPressOut,
  style,
  ...props
}: ActionCardProps) {
  const motionEnabled = useMotionEnabled();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback<NonNullable<ActionCardProps['onPressIn']>>(
    (event) => {
      if (motionEnabled && !props.disabled) {
        scale.value = withTiming(0.985, {
          duration: 90,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressIn?.(event);
    },
    [motionEnabled, onPressIn, props.disabled, scale]
  );

  const handlePressOut = React.useCallback<NonNullable<ActionCardProps['onPressOut']>>(
    (event) => {
      if (motionEnabled) {
        scale.value = withTiming(1, {
          duration: 150,
          easing: Easing.out(Easing.quad),
        });
      }
      onPressOut?.(event);
    },
    [motionEnabled, onPressOut, scale]
  );

  return (
    <AnimatedPressable
      className={cn('active:opacity-80', className)}
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}>
      <Card className="min-h-24 flex-row items-center gap-3">
        <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
          <Icon as={icon} className="text-primary size-6" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="large">{title}</Text>
          {description ? <Text variant="muted">{description}</Text> : null}
        </View>
        {right}
      </Card>
    </AnimatedPressable>
  );
}
