import { Button } from '@/components/ui/button';
import { ModalFrame } from '@/components/ui/modal-frame';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { Modal, View } from 'react-native';

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
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <ModalFrame
        onDismiss={onCancel}
        position="center"
        containerClassName="px-4"
        surfaceClassName="max-w-md gap-4 p-4">
        <View className="gap-1.5">
          <Text variant="h4">{title}</Text>
          {description ? (
            <Text variant="muted" className="leading-6">
              {description}
            </Text>
          ) : null}
        </View>
        <View className="flex-row justify-end gap-2">
          <Button variant="outline" onPress={onCancel}>
            <Text>{cancelLabel}</Text>
          </Button>
          <Button variant={confirmVariant} onPress={onConfirm}>
            <Text>{confirmLabel}</Text>
          </Button>
        </View>
      </ModalFrame>
    </Modal>
  );
}
