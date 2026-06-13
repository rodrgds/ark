import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type OnboardingFeatureProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  iconTileClassName?: string;
  iconClassName?: string;
};

export function OnboardingFeature({
  icon,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
  iconTileClassName,
  iconClassName,
}: OnboardingFeatureProps) {
  return (
    <View className={cn('flex-row items-center gap-3', className)}>
      <View
        className={cn('bg-muted size-9 items-center justify-center rounded-lg', iconTileClassName)}>
        <Icon as={icon} className={cn('text-primary size-4', iconClassName)} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className={cn('text-sm font-semibold', titleClassName)}>{title}</Text>
        {description ? (
          <Text variant="muted" className={cn('text-xs leading-5', descriptionClassName)}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
