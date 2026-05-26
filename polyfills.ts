import '@azure/core-asynciterator-polyfill';
import { Platform } from 'react-native';
import structuredClone from '@ungap/structured-clone';

if (!('DOMException' in globalThis)) {
  globalThis.DOMException = Error as unknown as typeof DOMException;
}

if (Platform.OS !== 'web') {
  void setupPolyfills();
}

async function setupPolyfills() {
  const { polyfillGlobal } = await import('react-native/Libraries/Utilities/PolyfillFunctions');
  const { TextDecoderStream, TextEncoderStream } = await import('@stardazed/streams-text-encoding');

  if (!('structuredClone' in globalThis)) {
    polyfillGlobal('structuredClone', () => structuredClone);
  }

  polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
  polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
}

export {};
