import * as Haptics from 'expo-haptics';
import { PreferencesService } from '@/services/preferences/preferences.service';

export class HapticsService {
  static async selection() {
    if (await this.shouldSuppress()) return;
    return Haptics.selectionAsync().catch(() => undefined);
  }

  static async success() {
    if (await this.shouldSuppress()) return;
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );
  }

  static async warning() {
    if (await this.shouldSuppress()) return;
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined
    );
  }

  private static async shouldSuppress() {
    return PreferencesService.getBatteryReduceModeEnabled().catch(() => false);
  }
}
