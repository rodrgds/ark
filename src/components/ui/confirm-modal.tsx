import { Button } from '@/components/ui/button';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { View } from 'react-native';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'default' | 'destructive';
};

export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'destructive',
}: ConfirmModalProps) {
  if (!visible) return null;

  return (
    <ArkBottomSheet
      visible={visible}
      title={title}
      description={description}
      onDismiss={onCancel}
      maxDynamicContentSize={420}
      contentClassName="gap-5">
      <View className="gap-2">
        <Button className="w-full" variant="outline" onPress={onCancel}>
          <Text>{cancelLabel}</Text>
        </Button>
        <Button className="w-full" variant={confirmVariant} onPress={onConfirm}>
          <Text>{confirmLabel}</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}
