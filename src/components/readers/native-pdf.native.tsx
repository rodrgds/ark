import Pdf from 'react-native-pdf';
import type { ElementType } from 'react';

export function getNativePdf(): ElementType {
  return Pdf as ElementType;
}
