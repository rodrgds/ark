import * as Haptics from 'expo-haptics';

export class HapticsService {
  static selection() {
    return Haptics.selectionAsync().catch(() => undefined);
  }

  static success() {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined
    );
  }

  static warning() {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => undefined
    );
  }
}
