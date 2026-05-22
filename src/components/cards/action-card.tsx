import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

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
  ...props
}: ActionCardProps) {
  return (
    <Pressable className={cn('active:opacity-80', className)} {...props}>
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
    </Pressable>
  );
}
