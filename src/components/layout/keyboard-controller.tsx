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
    // SAFETY: the optional keyboard-controller package may be absent in
    // Expo Go; the require result is null-checked before every use.
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
    const fallbackBehavior =
      _behavior === 'translate-with-padding'
        ? Platform.OS === 'ios'
          ? 'padding'
          : 'height'
        : (_behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height'));

    return (
      <KeyboardAvoidingView
        // SAFETY: the fallback KeyboardAvoidingView accepts the same ref the
        // native controller view takes.
        ref={ref as any}
        behavior={fallbackBehavior}
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
    // SAFETY: sticky views only render when the controller is present, so the
    // remaining props are plain View props in this fallback path.
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
      // SAFETY: the loaded component is the controller's own scroll view and
      // accepts the same ref type this wrapper declares.
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
        // SAFETY: the fallback path renders a plain ScrollView, which accepts
        // the same ref this wrapper declares.
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
