import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(
  { className, placeholderTextColor, ...props },
  ref
) {
  const colors = useThemeStore((state) => state.colors);
  const placeholderColor = placeholderTextColor ?? colors.mutedForeground;
  return (
    <TextInput
      ref={ref}
      className={cn(
        'border-border bg-card text-foreground min-h-12 rounded-md border px-4 py-3 text-base',
        className
      )}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );
});
