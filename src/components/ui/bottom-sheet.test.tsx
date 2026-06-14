import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';

installCommonRntlMocks(mock);

const { render } = await import('@testing-library/react-native');

const modalBottomSheetProps: Array<{ style?: unknown }> = [];
mock.module('@swmansion/react-native-bottom-sheet', () => ({
  ModalBottomSheet: (props: { children?: React.ReactNode; style?: unknown }) => {
    modalBottomSheetProps.push({ style: props.style });
    return <>{props.children}</>;
  },
}));

mock.module('@/stores/theme-store', () => ({
  useThemeStore: (selector: (state: { effectiveTheme: 'dark' | 'light' }) => 'dark' | 'light') =>
    selector({ effectiveTheme: 'dark' }),
}));

const { ArkBottomSheet } = await import('@/components/ui/bottom-sheet');

describe('ArkBottomSheet crash regression', () => {
  test('does not apply keyboard offset style to ModalBottomSheet', async () => {
    modalBottomSheetProps.length = 0;
    await render(
      <ArkBottomSheet visible onDismiss={() => {}}>
        <></>
      </ArkBottomSheet>
    );
    // Commit 33f2109 set style={{ bottom, height }} on ModalBottomSheet on
    // Android, which crashed the search sheet. The fix makes useKeyboardOffset
    // iOS-only, so the style prop is never set. This test guards against the
    // mutation coming back.
    expect(modalBottomSheetProps.at(0)?.style).toBeUndefined();
  });
});
