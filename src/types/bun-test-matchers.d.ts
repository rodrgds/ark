import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';

declare module 'bun:test' {
  interface Matchers<T> extends JestNativeMatchers<void> {}
}
