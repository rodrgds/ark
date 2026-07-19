import { ArkKeyboardAwareScrollView } from '@/components/layout/keyboard-controller';
import { Text } from '@/components/ui/text';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

export type ArkBottomSheetRef = {
  close: () => void;
  expand: () => void;
};

export type ArkBottomSheetProps = {
  visible: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onDismiss: () => void;
  sheetRef?: React.RefObject<ArkBottomSheetRef | null>;
  snapPoints?: Array<string | number>;
  scrollable?: boolean;
  contentClassName?: string;
  footerClassName?: string;
  maxDynamicContentSize?: number;
  enableKeyboardAwareScroll?: boolean;
};

/**
 * Web uses a modal dialog instead of the native bottom-sheet surface. Keeping
 * this boundary platform-specific prevents native codegen components from
 * entering the web bundle while preserving the same user-facing contract.
 */
export function ArkBottomSheet({
  visible,
  title,
  description,
  children,
  footer,
  onDismiss,
  sheetRef,
  scrollable = false,
  contentClassName,
  footerClassName,
  maxDynamicContentSize,
  enableKeyboardAwareScroll = true,
}: ArkBottomSheetProps) {
  const colors = useThemeStore((state) => state.colors);
  const { height } = useWindowDimensions();
  const maxHeight = maxDynamicContentSize ?? Math.round(height * 0.82);

  React.useImperativeHandle(
    sheetRef,
    () => ({
      close: onDismiss,
      expand: () => undefined,
    }),
    [onDismiss]
  );

  const header =
    title || description ? (
      <View style={styles.header}>
        {title ? <Text variant="h4">{title}</Text> : null}
        {description ? (
          <Text variant="muted" className="leading-6">
            {description}
          </Text>
        ) : null}
      </View>
    ) : null;

  const content = (
    <View className={contentClassName} style={styles.content}>
      {header}
      {children}
    </View>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      transparent
      visible={visible}
      presentationStyle="overFullScreen">
      <View style={styles.overlay} accessibilityViewIsModal>
        <Pressable
          accessibilityLabel="Close dialog"
          accessibilityRole="button"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxHeight,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
          {scrollable ? (
            <ArkKeyboardAwareScrollView
              enabled={enableKeyboardAwareScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {content}
            </ArkKeyboardAwareScrollView>
          ) : (
            <View style={styles.body}>{content}</View>
          )}
          {footer ? (
            <View className={footerClassName} style={styles.footer}>
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  content: {
    gap: 16,
    width: '100%',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    marginTop: 10,
    width: 40,
  },
  header: {
    gap: 4,
    width: '100%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 720,
  },
});
