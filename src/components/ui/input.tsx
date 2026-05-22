import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

function getPlaceholderColor(): string {
  try {
    const theme = useThemeStore.getState().effectiveTheme;
    return theme === 'light' ? '#71717A' : '#A1A1AA';
  } catch {
    return '#A1A1AA';
  }
}

export function Input({ className, placeholderTextColor, ...props }: TextInputProps) {
  return (
    <TextInput
      className={cn(
        'border-border bg-card text-foreground min-h-12 rounded-md border px-4 py-3 text-base',
        className
      )}
      placeholderTextColor={placeholderTextColor ?? getPlaceholderColor()}
      {...props}
    />
  );
}
