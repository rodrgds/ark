import { cn } from '@/lib/utils';
import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import * as React from 'react';
import { Platform, View, type ScrollViewProps } from 'react-native';

export function Screen({ className, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ArkKeyboardAwareScrollView
      className={cn('bg-background flex-1', className)}
      bottomOffset={Platform.OS === 'ios' ? 90 : 0}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ padding: 12, gap: 12, paddingBottom: 24 }, contentContainerStyle]}
      extraKeyboardSpace={Platform.OS === 'android' ? 12 : 0}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      {...props}
    />
  );
}

export function Stack({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('gap-3', className)} {...props} />;
}
