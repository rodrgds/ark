import Constants from 'expo-constants';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TurboModuleRegistry,
  View,
  type ViewProps,
} from 'react-native';
import type {
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

type KeyboardControllerModule = typeof import('react-native-keyboard-controller') & {
  KeyboardAvoidingView?: React.ComponentType<any>;
  KeyboardStickyView?: React.ComponentType<any>;
};

type ArkKeyboardAvoidingViewProps = ViewProps & {
  behavior?: 'height' | 'padding' | 'position' | 'translate-with-padding';
  contentContainerStyle?: ViewProps['style'];
  enabled?: boolean;
  keyboardVerticalOffset?: number;
};

type ArkKeyboardStickyViewProps = ViewProps & {
  enabled?: boolean;
  offset?: { closed?: number; opened?: number };
};

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

export const ArkKeyboardAvoidingView = React.forwardRef<View, ArkKeyboardAvoidingViewProps>(
  (props, ref) => {
    const NativeKeyboardAvoidingView = loadKeyboardController()?.KeyboardAvoidingView;

    if (NativeKeyboardAvoidingView) {
      return <NativeKeyboardAvoidingView ref={ref} {...props} />;
    }

    const {
      behavior: _behavior,
      contentContainerStyle: _contentContainerStyle,
      keyboardVerticalOffset,
      ...viewProps
    } = props;

    return (
      <KeyboardAvoidingView
        ref={ref as any}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset ?? 0}
        {...viewProps}
      />
    );
  }
);
ArkKeyboardAvoidingView.displayName = 'ArkKeyboardAvoidingView';

export const ArkKeyboardStickyView = React.forwardRef<View, ArkKeyboardStickyViewProps>(
  (props, ref) => {
    const KeyboardStickyView = loadKeyboardController()?.KeyboardStickyView;

    if (KeyboardStickyView) {
      return <KeyboardStickyView ref={ref} {...props} />;
    }

    const { offset: _offset, enabled: _enabled, ...viewProps } = props;
    return <View ref={ref} {...(viewProps as ViewProps)} />;
  }
);
ArkKeyboardStickyView.displayName = 'ArkKeyboardStickyView';

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? (_bottomOffset ?? 0) : 0}
      style={{ flex: 1 }}>
      <ScrollView
        ref={ref as React.Ref<ScrollView>}
        automaticallyAdjustKeyboardInsets={
          automaticallyAdjustKeyboardInsets ?? Platform.OS === 'ios'
        }
        {...scrollProps}
      />
    </KeyboardAvoidingView>
  );
});
ArkKeyboardAwareScrollView.displayName = 'ArkKeyboardAwareScrollView';
