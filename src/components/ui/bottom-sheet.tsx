import { NAV_COLORS } from '@/constants/theme';
import { useThemeStore } from '@/stores/theme-store';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

export type ArkBottomSheetProps = {
  visible: boolean;
  title?: string;
  description?: string;
  children: React.ReactNode;
  onDismiss: () => void;
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
  snapPoints,
  scrollable = false,
  contentClassName,
  maxDynamicContentSize,
}: ArkBottomSheetProps) {
  const ref = React.useRef<BottomSheetModal>(null);
  const [mounted, setMounted] = React.useState(visible);
  const insets = useSafeAreaInsets();
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[effectiveTheme];

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  React.useEffect(() => {
    if (!mounted || !visible) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.present();
    });
    return () => cancelAnimationFrame(frame);
  }, [mounted, visible]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.64}
        pressBehavior="close"
      />
    ),
    []
  );

  const header =
    title || description ? (
      <BottomSheetView style={{ gap: 4 }}>
        {title ? <Text variant="h4">{title}</Text> : null}
        {description ? (
          <Text variant="muted" className="leading-6">
            {description}
          </Text>
        ) : null}
      </BottomSheetView>
    ) : null;

  const handleDismiss = React.useCallback(() => {
    setMounted(false);
    onDismiss();
  }, [onDismiss]);

  if (!mounted) return null;

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints}
      maxDynamicContentSize={maxDynamicContentSize}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.mutedForeground }}
      onDismiss={handleDismiss}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore">
      {scrollable ? (
        <BottomSheetScrollView
          className={contentClassName}
          contentContainerStyle={{
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 12) + 12,
          }}
          keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          className={contentClassName}
          style={{
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 12) + 12,
          }}>
          <View style={{ gap: 16 }}>
            {header}
            {children}
          </View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

export { BottomSheet, BottomSheetScrollView, BottomSheetView };
