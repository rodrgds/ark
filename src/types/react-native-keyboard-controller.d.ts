declare module 'react-native-keyboard-controller' {
  import * as React from 'react';
  import type { ScrollView, ScrollViewProps } from 'react-native';

  export type KeyboardAwareScrollViewRef = ScrollView;

  export type KeyboardAwareScrollViewProps = ScrollViewProps & {
    bottomOffset?: number;
    disableScrollOnKeyboardHide?: boolean;
    enabled?: boolean;
    extraKeyboardSpace?: number;
    ScrollViewComponent?: React.ComponentType<any>;
    automaticallyAdjustKeyboardInsets?: boolean;
  };

  export const KeyboardProvider: React.ComponentType<React.PropsWithChildren>;
  export const KeyboardAwareScrollView: React.ForwardRefExoticComponent<
    KeyboardAwareScrollViewProps & React.RefAttributes<KeyboardAwareScrollViewRef>
  >;
}
