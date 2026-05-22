import * as LocalAuthentication from 'expo-local-authentication';
import type { BiometricsStatus } from '@/types/security';

export class BiometricsService {
  static async getStatus(): Promise<BiometricsStatus> {
    const [available, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync().catch(() => false),
      LocalAuthentication.isEnrolledAsync().catch(() => false),
    ]);
    return { available, enrolled };
  }

  static async authenticate() {
    return LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Ark vault',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
  }
}
