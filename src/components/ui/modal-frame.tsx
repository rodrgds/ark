import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

type ModalFrameProps = {
  children: React.ReactNode;
  onDismiss: () => void;
  position?: 'top' | 'center' | 'bottom';
  scrimClassName?: string;
  containerClassName?: string;
  containerStyle?: ViewStyle;
  surfaceClassName?: string;
  surfaceStyle?: ViewStyle;
};

const POSITION_CLASSNAME: Record<NonNullable<ModalFrameProps['position']>, string> = {
  top: 'justify-start',
  center: 'items-center justify-center',
  bottom: 'justify-end',
};

export function ModalFrame({
  children,
  onDismiss,
  position = 'center',
  scrimClassName,
  containerClassName,
  containerStyle,
  surfaceClassName,
  surfaceStyle,
}: ModalFrameProps) {
  return (
    <Pressable className={cn('flex-1 bg-black/60', scrimClassName)} onPress={onDismiss}>
      <View
        className={cn('flex-1 p-4', POSITION_CLASSNAME[position], containerClassName)}
        style={containerStyle}>
        <Pressable
          className={cn('border-border bg-card w-full rounded-lg border', surfaceClassName)}
          style={surfaceStyle}
          onPress={(event) => event.stopPropagation()}>
          {children}
        </Pressable>
      </View>
    </Pressable>
  );
}
