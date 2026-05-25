import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import * as React from 'react';
import { View } from 'react-native';

type SheetAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type SheetAlertState = {
  title: string;
  message?: string;
  buttons: SheetAlertButton[];
};

let presentSheetAlert: ((state: SheetAlertState) => void) | null = null;

export function showSheetAlert(
  title: string,
  message?: string,
  buttons: SheetAlertButton[] = [{ text: 'OK', style: 'default' }]
) {
  presentSheetAlert?.({ title, message, buttons: buttons.length ? buttons : [{ text: 'OK' }] });
}

export function SheetAlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = React.useState<SheetAlertState | null>(null);

  React.useEffect(() => {
    presentSheetAlert = setAlert;
    return () => {
      if (presentSheetAlert === setAlert) presentSheetAlert = null;
    };
  }, []);

  function dismiss() {
    setAlert(null);
  }

  function pressButton(button: SheetAlertButton) {
    setAlert(null);
    button.onPress?.();
  }

  return (
    <>
      {children}
      <ArkBottomSheet
        visible={Boolean(alert)}
        title={alert?.title}
        description={alert?.message}
        onDismiss={dismiss}>
        <View className="w-full gap-2">
          {(alert?.buttons ?? []).map((button, index) => (
            <Button
              key={`${button.text}-${index}`}
              className="w-full"
              style={{ alignSelf: 'stretch' }}
              variant={
                button.style === 'destructive'
                  ? 'destructive'
                  : button.style === 'cancel'
                    ? 'outline'
                    : 'default'
              }
              onPress={() => pressButton(button)}>
              <Text>{button.text}</Text>
            </Button>
          ))}
        </View>
      </ArkBottomSheet>
    </>
  );
}
