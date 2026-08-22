import Pdf from 'react-native-pdf';
import type { ElementType } from 'react';

export function getNativePdf(): ElementType {
  // SAFETY: react-native-pdf's default export is a React component that
  // satisfies the ElementType contract used by the reader.
  return Pdf as ElementType;
}
