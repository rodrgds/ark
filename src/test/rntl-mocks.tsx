import * as React from 'react';

type MockApi = {
  module: (specifier: string, factory: () => Record<string, unknown>) => void;
};

type HostProps = Record<string, unknown> & {
  children?: React.ReactNode;
};

const iconNames = [
  'BookHeart',
  'BookMarked',
  'BookOpen',
  'Bot',
  'Check',
  'ChevronLeft',
  'CircleX',
  'CheckSquare',
  'Clock',
  'Compass',
  'Download',
  'Footprints',
  'Gauge',
  'GripVertical',
  'Library',
  'Lightbulb',
  'LocateFixed',
  'LockKeyhole',
  'Map',
  'MessageSquareText',
  'NotebookPen',
  'Plus',
  'Ruler',
  'Search',
  'Newspaper',
  'Settings',
  'Shield',
  'SlidersHorizontal',
  'Smartphone',
  'Trash2',
  'TriangleAlert',
];

function TestIcon() {
  return React.createElement('View');
}

export function installCommonRntlMocks(mockApi: MockApi) {
  (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ ??= false;
  globalThis.requestAnimationFrame ??= ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame ??= ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame;

  const Host = (name: string) => {
    const Component = React.forwardRef<unknown, HostProps>(({ children, ...props }, ref) => {
      React.useImperativeHandle(ref, () => ({
        blur: () => undefined,
        focus: () => undefined,
      }));
      return React.createElement(name, { ...props, ref }, children as React.ReactNode);
    });
    Component.displayName = `Mock${name}`;
    return Component;
  };
  const View = Host('View');
  const Text = Host('Text');
  const Pressable = Host('Pressable');
  const TextInput = Host('TextInput');
  const ScrollView = Host('ScrollView');

  mockApi.module('react-native', () => ({
    ActivityIndicator: Host('ActivityIndicator'),
    BackHandler: {
      addEventListener: () => ({ remove: () => undefined }),
    },
    FlatList: ({
      data = [],
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ...props
    }: {
      data?: unknown[];
      renderItem: (input: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
      ListHeaderComponent?: React.ReactNode;
    }) =>
      React.createElement(
        'FlatList',
        props,
        ListHeaderComponent,
        data.map((item, index) => (
          <React.Fragment key={keyExtractor?.(item, index) ?? index}>
            {renderItem({ item, index })}
          </React.Fragment>
        ))
      ),
    Keyboard: {
      addListener: () => ({ remove: () => undefined }),
      dismiss: () => undefined,
    },
    Modal: ({
      visible = true,
      children,
      ...props
    }: React.PropsWithChildren<{ visible?: boolean }>) =>
      visible ? React.createElement('Modal', props, children) : null,
    Platform: {
      OS: 'ios',
      select: (options: Record<string, unknown>) => options.ios ?? options.default,
    },
    Pressable,
    RefreshControl: Host('RefreshControl'),
    ScrollView,
    StyleSheet: {
      absoluteFill: {},
      create: <T,>(styles: T) => styles,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    Text,
    TextInput,
    View,
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  }));

  mockApi.module('lucide-react-native', () =>
    Object.fromEntries(iconNames.map((name) => [name, TestIcon]))
  );

  mockApi.module('@expo/vector-icons/MaterialCommunityIcons', () => ({
    default: {
      getImageSource: async (name: string, size: number, color: string) => ({ name, size, color }),
    },
  }));

  mockApi.module('@rn-primitives/slot', () => ({
    Slot: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.isValidElement(children)
        ? React.cloneElement(children, props as Partial<unknown>)
        : React.createElement('View', props, children),
  }));

  mockApi.module('@/components/ui/icon', () => ({
    Icon: TestIcon,
  }));

  mockApi.module('@/stores/theme-store', () => ({
    useThemeStore: <T,>(selector: (state: { effectiveTheme: 'oled' }) => T) =>
      selector({ effectiveTheme: 'oled' }),
  }));

  mockApi.module('@/hooks/use-battery-reduce-mode', () => ({
    useBatteryReduceMode: () => false,
  }));

  mockApi.module('@/hooks/use-motion-enabled', () => ({
    useMotionEnabled: () => true,
  }));

  mockApi.module('@/components/ui/bottom-sheet', () => ({
    ArkBottomSheet: ({
      visible,
      title,
      description,
      children,
    }: React.PropsWithChildren<{
      visible: boolean;
      title?: string;
      description?: string;
    }>) =>
      visible ? (
        <View accessibilityRole="menu" accessibilityLabel={title ?? 'Bottom sheet'}>
          {title ? <Text>{title}</Text> : null}
          {description ? <Text>{description}</Text> : null}
          {children}
        </View>
      ) : null,
  }));

  mockApi.module('react-native-reanimated', () => {
    const Animated = {
      View,
      createAnimatedComponent: (Component: React.ComponentType<unknown>) => Component,
    };
    return {
      default: Animated,
      Easing: {
        cubic: () => 0,
        out: (value: unknown) => value,
        quad: () => 0,
      },
      Extrapolation: { CLAMP: 'clamp' },
      interpolate: () => 0,
      useAnimatedStyle: (factory: () => unknown) => factory(),
      useSharedValue: (value: unknown) => ({ value }),
      withRepeat: (value: unknown) => value,
      withTiming: (value: unknown) => value,
    };
  });

  mockApi.module('react-native-gesture-handler', () => {
    const createPan = () => {
      const chain = {
        enabled: () => chain,
        onBegin: () => chain,
        onFinalize: () => chain,
        onUpdate: () => chain,
      };
      return chain;
    };
    return {
      Gesture: { Pan: createPan },
      GestureDetector: ({ children }: React.PropsWithChildren) => <>{children}</>,
    };
  });

  mockApi.module('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  }));

  mockApi.module('react-native-worklets', () => ({
    scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args),
  }));

  mockApi.module('expo-router', () => ({
    router: {
      back: () => undefined,
      push: () => undefined,
      replace: () => undefined,
    },
    useLocalSearchParams: () => ({}),
    useGlobalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    useRouter: () => ({
      back: () => undefined,
      push: () => undefined,
      replace: () => undefined,
    }),
    Link: Host('Link'),
    Stack: {
      Screen: () => null,
    },
    Tabs: {
      Screen: () => null,
    },
    Redirect: () => null,
  }));
}
