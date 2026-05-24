import * as React from 'react';

let NativePdf: React.ComponentType<any> | null | undefined;

export function getNativePdf() {
  if (NativePdf !== undefined) return NativePdf;
  try {
    const module = require('react-native-pdf') as { default?: React.ComponentType<any> };
    NativePdf = module.default ?? (module as unknown as React.ComponentType<any>);
  } catch {
    NativePdf = null;
  }
  return NativePdf;
}
