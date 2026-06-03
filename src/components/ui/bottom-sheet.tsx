import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import {
  BottomSheet,
  ModalBottomSheet,
  type Detent,
} from '@swmansion/react-native-bottom-sheet';
import * as React from 'react';
import { Keyboard, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

export type ArkBottomSheetRef = {
  close: () => void;
  expand: () => void;
};

export type ArkBottomSheetProps = {
  visible: boolean;
  title?: string;
  description?: string;
  children: React.ReactNode;
  onDismiss: () => void;
  sheetRef?: React.RefObject<ArkBottomSheetRef | null>;
  snapPoints?: Array<string | number>;
  scrollable?: boolean;
  contentClassName?: string;
  maxDynamicContentSize?: number;
};

export function ArkBottomSheet({
  visible,
  title,
  description,
  children,
  onDismiss,
  sheetRef,
  snapPoints,
  scrollable = false,
  contentClassName,
  maxDynamicContentSize,
}: ArkBottomSheetProps) {
  const [mounted, setMounted] = React.useState(visible);
  const [index, setIndex] = React.useState(0);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[effectiveTheme];
  const visibleRef = React.useRef(visible);
  const hasOpenedRef = React.useRef(false);

  const contentSized = !scrollable && !snapPoints;
  const effectiveMaxDynamicContentSize = maxDynamicContentSize ?? Math.round(height * 0.82);
  const detents = React.useMemo<Detent[]>(() => {
    if (contentSized) return [0, 'content'];
    return [0, ...(snapPoints ?? ['82%']).map((point) => resolveSnapPoint(point, height))];
  }, [contentSized, height, snapPoints]);
  const initialOpenIndex = Math.min(1, detents.length - 1);

  React.useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      hasOpenedRef.current = false;
      const frame = requestAnimationFrame(() => setIndex(initialOpenIndex));
      return () => cancelAnimationFrame(frame);
    }

    setIndex(0);
    return undefined;
  }, [initialOpenIndex, visible]);

  React.useImperativeHandle(
    sheetRef,
    () => ({
      close: () => setIndex(0),
      expand: () => setIndex(detents.length - 1),
    }),
    [detents.length]
  );

  const handleIndexChange = React.useCallback(
    (nextIndex: number) => {
      setIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
      if (nextIndex > 0) {
        hasOpenedRef.current = true;
        return;
      }
      if (nextIndex === 0 && visibleRef.current && hasOpenedRef.current) {
        hasOpenedRef.current = false;
        Keyboard.dismiss();
        onDismiss();
      }
    },
    [onDismiss]
  );

  const handleSettle = React.useCallback((nextIndex: number) => {
    if (nextIndex === 0) {
      const shouldUnmount = !visibleRef.current || hasOpenedRef.current;
      hasOpenedRef.current = false;
      if (shouldUnmount) setMounted(false);
    }
  }, []);

  const header =
    title || description ? (
      <View style={{ gap: 4, width: '100%' }}>
        {title ? <Text variant="h4">{title}</Text> : null}
        {description ? (
          <Text variant="muted" className="leading-6">
            {description}
          </Text>
        ) : null}
      </View>
    ) : null;

  if (!mounted) return null;

  const bottomPadding = Math.max(insets.bottom, 12) + 12;
  const body = (
    <View
      style={[
        styles.content,
        !contentSized ? styles.flexContent : { maxHeight: effectiveMaxDynamicContentSize },
      ]}>
      <View style={styles.handleContainer}>
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
      </View>
      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: bottomPadding,
          }}
          keyboardShouldPersistTaps="handled">
          <View className={contentClassName} style={{ gap: 16, width: '100%' }}>
            {header}
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: bottomPadding,
          }}>
          <View className={contentClassName} style={{ gap: 16, width: '100%' }}>
            {header}
            {children}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <ModalBottomSheet
      index={index}
      detents={detents}
      onIndexChange={handleIndexChange}
      onSettle={handleSettle}
      scrimColor="rgba(0, 0, 0, 0.64)"
      surface={
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.surface,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        />
      }>
      {body}
    </ModalBottomSheet>
  );
}

function resolveSnapPoint(point: string | number, height: number): Detent {
  if (typeof point === 'number') return Math.max(0, point);

  const percent = point.match(/^(\d+(?:\.\d+)?)%$/);
  if (percent) {
    return Math.round(height * (Number(percent[1]) / 100));
  }

  if (point === 'content') return 'content';
  return Math.max(0, Number(point) || 0);
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
  },
  flexContent: {
    flex: 1,
  },
  handle: {
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  surface: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
  },
});

export { BottomSheet, ModalBottomSheet };
