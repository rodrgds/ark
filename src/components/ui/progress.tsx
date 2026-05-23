import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

type ProgressProps = React.ComponentProps<typeof View> & {
  value: number;
};

export function Progress({ value, className, ...props }: ProgressProps) {
  const bounded = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View className={cn('bg-muted h-2 overflow-hidden rounded-full', className)} {...props}>
      <View className="bg-primary h-full rounded-full" style={{ width: `${bounded * 100}%` }} />
    </View>
  );
}
