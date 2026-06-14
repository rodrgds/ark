import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import { ModalBottomSheet, type Detent } from '@swmansion/react-native-bottom-sheet';
import * as React from 'react';
import { Keyboard, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { resolveKeyboardOffset } from '@/components/ui/bottom-sheet-keyboard';

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

type SheetState = {
  mounted: boolean;
  index: number;
  visible: boolean;
  initialOpenIndex: number;
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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[effectiveTheme];
  const visibleRef = React.useRef(visible);
  const hasOpenedRef = React.useRef(false);
  const dismissingRef = React.useRef(false);

  const contentSized = !scrollable && !snapPoints;
  const keyboardOffset = useKeyboardOffset();
  const baseMaxDynamicContentSize = maxDynamicContentSize ?? Math.round(height * 0.82);
  const effectiveMaxDynamicContentSize =
    keyboardOffset > 0 ? Math.max(0, height - keyboardOffset) : baseMaxDynamicContentSize;
  const detents = React.useMemo<Detent[]>(() => {
    if (contentSized) return [0, 'content'];
    return [0, ...(snapPoints ?? ['82%']).map((point) => resolveSnapPoint(point, height))];
  }, [contentSized, height, snapPoints]);
  const initialOpenIndex = Math.min(1, detents.length - 1);
  const [sheetState, setSheetState] = React.useState<SheetState>(() => ({
    mounted: visible,
    index: visible ? initialOpenIndex : 0,
    visible,
    initialOpenIndex,
  }));
  const { mounted, index } = sheetState;

  visibleRef.current = visible;

  if (sheetState.visible !== visible || sheetState.initialOpenIndex !== initialOpenIndex) {
    if (visible) {
      dismissingRef.current = false;
    } else if (sheetState.visible) {
      dismissingRef.current = true;
    }

    setSheetState({
      mounted: visible ? true : sheetState.mounted,
      index: visible ? initialOpenIndex : 0,
      visible,
      initialOpenIndex,
    });
  }

  React.useImperativeHandle(
    sheetRef,
    () => ({
      close: () =>
        setSheetState((current) => ({
          ...current,
          index: 0,
        })),
      expand: () =>
        setSheetState((current) => ({
          ...current,
          index: detents.length - 1,
        })),
    }),
    [detents.length]
  );

  const handleIndexChange = React.useCallback((nextIndex: number) => {
    setSheetState((current) =>
      current.index === nextIndex ? current : { ...current, index: nextIndex }
    );
  }, []);

  const handleSettle = React.useCallback(
    (nextIndex: number) => {
      if (nextIndex > 0) {
        hasOpenedRef.current = true;
        return;
      }

      const shouldDismiss = visibleRef.current && hasOpenedRef.current && !dismissingRef.current;
      const opening = visibleRef.current && !hasOpenedRef.current && !dismissingRef.current;
      hasOpenedRef.current = false;

      if (opening) return;

      if (shouldDismiss) {
        dismissingRef.current = true;
        Keyboard.dismiss();
        onDismiss();
      }

      setSheetState((current) => ({
        ...current,
        mounted: false,
        index: 0,
      }));
    },
    [onDismiss]
  );

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
        <ArkKeyboardAwareScrollView
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
        </ArkKeyboardAwareScrollView>
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

  const keyboardAvoidingStyle =
    keyboardOffset > 0
      ? { bottom: keyboardOffset, height: Math.max(0, height - keyboardOffset) }
      : undefined;

  return (
    <ModalBottomSheet
      index={index}
      detents={detents}
      onIndexChange={handleIndexChange}
      onSettle={handleSettle}
      scrimColor="rgba(0, 0, 0, 0.64)"
      style={keyboardAvoidingStyle}
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

function useKeyboardOffset() {
  const [offset, setOffset] = React.useState(0);
  const { height: windowHeight } = useWindowDimensions();

  React.useEffect(() => {
    if (Platform.OS !== 'ios') {
      return undefined;
    }

    const handleShow = (event?: { endCoordinates?: { height?: number; screenY?: number } }) => {
      setOffset(resolveKeyboardOffset(event, windowHeight));
    };
    const handleHide = () => setOffset(0);

    const willShow = Keyboard.addListener('keyboardWillShow', handleShow);
    const didShow = Keyboard.addListener('keyboardDidShow', handleShow);
    const willChange = Keyboard.addListener('keyboardWillChangeFrame', handleShow);
    const willHide = Keyboard.addListener('keyboardWillHide', handleHide);
    const didHide = Keyboard.addListener('keyboardDidHide', handleHide);

    return () => {
      willShow.remove();
      didShow.remove();
      willChange.remove();
      willHide.remove();
      didHide.remove();
    };
  }, [windowHeight]);

  return offset;
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
