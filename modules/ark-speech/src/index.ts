import { requireNativeModule } from 'expo-modules-core';

export type ArkSpeechOptions = {
  locale?: string;
  preferOffline?: boolean;
  timeoutMs?: number;
};

export type ArkSpeechResult = {
  text: string;
  alternatives: string[];
  offlinePreferred: boolean;
};

type ArkSpeechModule = {
  isAvailable(): Promise<boolean>;
  recognizeOnce(options?: ArkSpeechOptions): Promise<ArkSpeechResult>;
  stop(): void;
  cancel(): void;
};

export default requireNativeModule<ArkSpeechModule>('ArkSpeech');
export const { isAvailable, recognizeOnce, stop, cancel } =
  requireNativeModule<ArkSpeechModule>('ArkSpeech');
