import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

export function Card({ className, style, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('border-border bg-card rounded-lg border p-4', className)}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    />
  );
}
