import { cn } from '@/lib/utils';
import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

function getPlaceholderColor(): string {
  try {
    const theme = useThemeStore.getState().effectiveTheme;
    return NAV_COLORS[theme].mutedForeground;
  } catch {
    return NAV_COLORS.oled.mutedForeground;
  }
}

export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(
  { className, placeholderTextColor, ...props },
  ref
) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        'border-border bg-card text-foreground min-h-12 rounded-md border px-4 py-3 text-base',
        className
      )}
      placeholderTextColor={placeholderTextColor ?? getPlaceholderColor()}
      {...props}
    />
  );
});
