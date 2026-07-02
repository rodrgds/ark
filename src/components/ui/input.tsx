import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

export const Input = React.forwardRef<TextInput, TextInputProps>(function Input(
  { className, placeholderTextColor, value, defaultValue, onBlur, onChangeText, onFocus, ...props },
  ref
) {
  const inputRef = React.useRef<TextInput | null>(null);
  const [focused, setFocused] = React.useState(false);
  const colors = useThemeStore((state) => state.colors);
  const placeholderColor = placeholderTextColor ?? colors.mutedForeground;
  const controlledText = typeof value === 'string' ? value : undefined;
  const defaultText = typeof defaultValue === 'string' ? defaultValue : undefined;
  const lastNativeTextRef = React.useRef(controlledText ?? defaultText ?? '');
  const lastPropTextRef = React.useRef(controlledText);
  const textProps =
    controlledText === undefined
      ? { defaultValue }
      : focused
        ? { defaultValue: lastNativeTextRef.current }
        : { value: controlledText };

  React.useEffect(() => {
    if (controlledText === undefined || controlledText === lastPropTextRef.current) return;
    lastPropTextRef.current = controlledText;
    if (!focused) {
      lastNativeTextRef.current = controlledText;
      return;
    }
    if (controlledText === lastNativeTextRef.current) return;
    lastNativeTextRef.current = controlledText;
    inputRef.current?.setNativeProps?.({ text: controlledText });
  }, [controlledText, focused]);

  const setInputRef = React.useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  return (
    <TextInput
      ref={setInputRef}
      className={cn(
        'border-border bg-card text-foreground min-h-12 rounded-md border px-4 py-3 text-base',
        className
      )}
      placeholderTextColor={placeholderColor}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onChangeText={(text) => {
        lastNativeTextRef.current = text;
        lastPropTextRef.current = text;
        onChangeText?.(text);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      {...textProps}
      {...props}
    />
  );
});
