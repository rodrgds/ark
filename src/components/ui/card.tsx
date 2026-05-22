import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

export function Card({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      className={cn('border-border bg-card rounded-lg border p-4', className)}
      style={{ borderCurve: 'continuous' }}
      {...props}
    />
  );
}

export function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-1">
      <Text variant="large">{title}</Text>
      {description ? <Text variant="muted">{description}</Text> : null}
    </View>
  );
}
