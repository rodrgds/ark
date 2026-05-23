import Constants from 'expo-constants';
import * as React from 'react';
import { Platform, ScrollView, TurboModuleRegistry } from 'react-native';
import type {
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

type KeyboardControllerModule = typeof import('react-native-keyboard-controller');

let keyboardControllerModule: KeyboardControllerModule | null | undefined;

function hasNativeKeyboardController() {
  try {
    return Boolean(TurboModuleRegistry.get('KeyboardController'));
  } catch {
    return false;
  }
}

function loadKeyboardController() {
  if (
    Platform.OS === 'web' ||
    Constants.appOwnership === 'expo' ||
    !hasNativeKeyboardController()
  ) {
    return null;
  }

  if (keyboardControllerModule !== undefined) {
    return keyboardControllerModule;
  }

  try {
    keyboardControllerModule =
      require('react-native-keyboard-controller') as KeyboardControllerModule;
  } catch {
    keyboardControllerModule = null;
  }

  return keyboardControllerModule;
}

export function ArkKeyboardProvider({ children }: React.PropsWithChildren) {
  const KeyboardProvider = loadKeyboardController()?.KeyboardProvider;

  if (!KeyboardProvider) {
    return <>{children}</>;
  }

  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export type ArkKeyboardAwareScrollViewRef = KeyboardAwareScrollViewRef | ScrollView;

export const ArkKeyboardAwareScrollView = React.forwardRef<
  ArkKeyboardAwareScrollViewRef,
  KeyboardAwareScrollViewProps
>((props, ref) => {
  const KeyboardAwareScrollView = loadKeyboardController()?.KeyboardAwareScrollView;

  if (KeyboardAwareScrollView) {
    return (
      <KeyboardAwareScrollView ref={ref as React.Ref<KeyboardAwareScrollViewRef>} {...props} />
    );
  }

  const {
    bottomOffset: _bottomOffset,
    disableScrollOnKeyboardHide: _disableScrollOnKeyboardHide,
    enabled: _enabled,
    extraKeyboardSpace: _extraKeyboardSpace,
    ScrollViewComponent: _ScrollViewComponent,
    automaticallyAdjustKeyboardInsets,
    ...scrollProps
  } = props;

  return (
    <ScrollView
      ref={ref as React.Ref<ScrollView>}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets ?? Platform.OS === 'ios'}
      {...scrollProps}
    />
  );
});
ArkKeyboardAwareScrollView.displayName = 'ArkKeyboardAwareScrollView';
