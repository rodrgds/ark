import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';

export function Screen({ className, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        className={cn('bg-background flex-1', className)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[{ padding: 12, gap: 12, paddingBottom: 24 }, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        {...props}
      />
    </KeyboardAvoidingView>
  );
}

export function Stack({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('gap-3', className)} {...props} />;
}
