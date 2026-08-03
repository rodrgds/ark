import { Platform } from 'react-native';
import notifee, { AndroidImportance, EventType } from 'react-native-notify-kit';

/**
 * F-Droid backing for `expo-notifications`.
 *
 * `expo-notifications` bundles Firebase Cloud Messaging, which F-Droid's
 * binary scanner rejects. This shim provides the small subset of the
 * `expo-notifications` API Ark uses (local download progress notifications and
 * tap-to-navigate), backed by `react-native-notify-kit` (a Firebase-free
 * Notifee fork).
 *
 * The metro config routes `expo-notifications` to this file only for the fdroid
 * distribution, and `react-native.config.js` excludes the
 * `expo-notifications` native module so its firebase classes never compile.
 */

export { AndroidImportance };

export const AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
} as const;

export const NotificationPermissionsStatus = {
  GRANTED: 'granted',
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
} as const;

export type NotificationPermissionsResponse = {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
};

type NotificationContent = {
  title?: string;
  subtitle?: string;
  body?: string;
  sound?: boolean | string;
  priority?: number;
  color?: string;
  sticky?: boolean;
  autoDismiss?: boolean;
  data?: Record<string, unknown>;
};

type ScheduleInput = {
  identifier?: string;
  content?: NotificationContent;
  trigger?: null | unknown;
};

type NotificationResponse = {
  notification?: {
    request?: {
      identifier?: string;
      content?: { data?: Record<string, unknown> };
    };
  };
} | null;

function mapSettingsAuthorization(authorizationStatus: number | null | undefined): boolean {
  // AuthorizationStatus: DENIED=0, AUTHORIZED=1, PROVISIONAL=2 (same as Notifee).
  return authorizationStatus === 1 || authorizationStatus === 2;
}

async function getPermissionSnapshot(): Promise<NotificationPermissionsResponse> {
  try {
    const settings = await notifee.getNotificationSettings();
    const granted = mapSettingsAuthorization(settings?.authorizationStatus);
    return {
      granted,
      status: granted
        ? NotificationPermissionsStatus.GRANTED
        : NotificationPermissionsStatus.UNDETERMINED,
      canAskAgain: true,
    };
  } catch {
    return {
      granted: false,
      status: NotificationPermissionsStatus.UNDETERMINED,
      canAskAgain: true,
    };
  }
}

export async function getPermissionsAsync(): Promise<NotificationPermissionsResponse> {
  return getPermissionSnapshot();
}

export async function requestPermissionsAsync(): Promise<NotificationPermissionsResponse> {
  try {
    await notifee.requestPermission();
  } catch {
    // ignore; snapshot reflects actual state below
  }
  return getPermissionSnapshot();
}

export async function setNotificationChannelAsync(
  channelId: string,
  channel?: Partial<{
    name: string;
    description: string;
    importance: number;
    sound: string | null;
    enableVibrate: boolean;
    showBadge: boolean;
  }>
): Promise<null> {
  if (Platform.OS !== 'android') return null;
  try {
    await notifee.createChannel({
      id: channelId,
      name: channel?.name ?? channelId,
      description: channel?.description,
      importance: (channel?.importance as AndroidImportance) ?? AndroidImportance.DEFAULT,
      sound: channel?.sound === null ? 'silent' : 'default',
      vibration: !!channel?.enableVibrate,
      badge: channel?.showBadge || true,
    });
  } catch {
    // ignore
  }
  return null;
}

export function setNotificationHandler(_handler: {
  handleNotification?: () => Promise<unknown>;
}): void {
  return;
}

export async function scheduleNotificationAsync(notification: ScheduleInput): Promise<string> {
  const identifier = notification?.identifier;
  const content = notification?.content;
  await notifee
    .displayNotification({
      id: identifier ?? undefined,
      title: content?.title,
      subtitle: content?.subtitle,
      body: content?.body,
      data: content?.data as { [key: string]: string | number | object } | undefined,
      android: {
        channelId: 'ark-downloads',
        autoCancel: content?.autoDismiss ?? true,
        ongoing: !!content?.sticky,
        color: content?.color,
        importance: AndroidImportance.LOW,
        sound: content?.sound === false ? 'silent' : 'default',
        pressAction: { id: 'ark-download', launchActivity: 'default' },
      },
    })
    .catch(() => undefined);
  return identifier ?? '';
}

export async function dismissNotificationAsync(identifier: string): Promise<void> {
  await notifee.cancelNotification(identifier).catch(() => undefined);
}

export async function cancelScheduledNotificationAsync(identifier: string): Promise<void> {
  await notifee.cancelNotification(identifier).catch(() => undefined);
}

function toResponse(
  notification: { id?: string; data?: Record<string, unknown> } | null | undefined
): {
  notification: { request?: { identifier?: string; content?: { data?: Record<string, unknown> } } };
} | null {
  if (!notification) return null;
  return {
    notification: {
      request: {
        identifier: notification.id,
        content: { data: notification.data },
      },
    },
  };
}

export function addNotificationResponseReceivedListener(
  listener: (response: NotificationResponse) => void
): { remove(): void } {
  const unsubscribe = notifee.onForegroundEvent((event: any) => {
    if (event?.type === EventType.PRESS) {
      const response = toResponse({
        id: event?.detail?.notification?.id,
        data: event?.detail?.notification?.data,
      });
      if (response) listener(response);
    }
  });
  return { remove: () => unsubscribe?.() };
}

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse> {
  try {
    const initial = await notifee.getInitialNotification();
    if (!initial?.notification) return null;
    return toResponse({
      id: initial.notification.id,
      data: initial.notification.data,
    });
  } catch {
    return null;
  }
}
