import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: 'default' | 'destructive';
};

export function ConfirmModal({
  visible,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'destructive',
}: ConfirmModalProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50">
      <Pressable className="bg-black/50 flex-1" onPress={onCancel}>
        <View className="flex-1 items-center justify-center p-4">
          <Pressable onPress={(event) => event.stopPropagation()}>
            <Card className="w-full max-w-md gap-2 rounded-2xl border bg-black p-4">
              <Text variant="h3" className="text-white">{title}</Text>
              <View className="flex-row justify-end gap-2">
                <Button
                  className="bg-black border-border px-4"
                  variant="outline"
                  onPress={onCancel}>
                  <Text className="text-white">{cancelLabel}</Text>
                </Button>
                <Button
                  className="bg-black border-border px-4"
                  variant="outline"
                  onPress={onConfirm}>
                  <Text className="text-white">{confirmLabel}</Text>
                </Button>
              </View>
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}
