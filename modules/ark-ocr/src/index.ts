import { NativeModule, requireNativeModule } from 'expo-modules-core';

export type ArkOcrResult = {
  text: string;
  blocks: Array<{ text: string; confidence?: number | null }>;
};

declare class ArkOcrModule extends NativeModule {
  recognizeText(uri: string): Promise<ArkOcrResult>;
}

export default requireNativeModule<ArkOcrModule>('ArkOcr');
