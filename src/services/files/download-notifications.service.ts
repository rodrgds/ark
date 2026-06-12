import { BRAND_AMBER } from '@/constants/map-pins';
import type { DownloadKind, DownloadStatus } from '@/types/downloads';
import * as Notifications from 'expo-notifications';

type DownloadNotificationInput = {
  id: string;
  kind: DownloadKind;
  title: string;
  progress?: number | null;
  status: DownloadStatus;
};

const CHANNEL_ID = 'ark-downloads';
const MIN_PROGRESS_STEP = 0.05;
const MIN_PROGRESS_INTERVAL_MS = 15_000;

let permissionPromise: Promise<boolean> | null = null;
const lastProgressUpdates = new Map<string, { progress: number; updatedAt: number }>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.LOW,
  }),
});

export class DownloadNotificationService {
  static async configure() {
    await ensureNotificationsReady();
  }

  static async progress(input: DownloadNotificationInput) {
    if (!shouldReportProgress(input)) return;
    await showDownloadNotification(input, true);
  }

  static async terminal(input: DownloadNotificationInput) {
    lastProgressUpdates.delete(input.id);
    if (input.status === 'completed' || input.status === 'canceled') {
      await dismissDownloadNotification(input.id);
    }
    if (input.status === 'completed' || input.status === 'failed' || input.status === 'paused') {
      await showDownloadNotification(input, false);
    }
  }
}

function shouldReportProgress(input: DownloadNotificationInput) {
  if (input.status !== 'downloading' && input.status !== 'verifying') return false;
  const progress = normalizeProgress(input.progress);
  const previous = lastProgressUpdates.get(input.id);
  const now = Date.now();
  if (
    previous &&
    progress < 1 &&
    progress - previous.progress < MIN_PROGRESS_STEP &&
    now - previous.updatedAt < MIN_PROGRESS_INTERVAL_MS
  ) {
    return false;
  }
  lastProgressUpdates.set(input.id, { progress, updatedAt: now });
  return true;
}

async function showDownloadNotification(input: DownloadNotificationInput, ongoing: boolean) {
  if (!(await ensureNotificationsReady())) return;
  const progress = normalizeProgress(input.progress);
  const body = notificationBody(input.status, progress);
  await Notifications.scheduleNotificationAsync({
    identifier: notificationId(input.id),
    content: {
      title: ongoing ? 'Ark download running' : notificationTitle(input.status),
      subtitle: input.title,
      body,
      sound: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      color: BRAND_AMBER,
      sticky: ongoing,
      autoDismiss: !ongoing,
      data: {
        downloadId: input.id,
        downloadKind: input.kind,
        downloadStatus: input.status,
      },
    },
    trigger: null,
  }).catch(() => undefined);
}

async function dismissDownloadNotification(id: string) {
  await Notifications.dismissNotificationAsync(notificationId(id)).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(notificationId(id)).catch(() => undefined);
}

async function ensureNotificationsReady() {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      const platformOS = await getPlatformOS();
      if (platformOS === 'web') return false;
      if (platformOS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Downloads',
          description: 'Progress for offline maps, wiki archives, PDFs, and models.',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          enableVibrate: false,
          showBadge: false,
        }).catch(() => undefined);
      }
      const existing = await Notifications.getPermissionsAsync().catch(() => null);
      if (existing?.granted) return true;
      const requested = await Notifications.requestPermissionsAsync().catch(() => null);
      return !!requested?.granted;
    })();
  }
  return permissionPromise;
}

async function getPlatformOS() {
  try {
    const reactNative = await import('react-native');
    return reactNative.Platform?.OS ?? 'native';
  } catch {
    return 'native';
  }
}

function notificationId(id: string) {
  return `ark-download-${id}`;
}

function normalizeProgress(progress?: number | null) {
  if (!Number.isFinite(progress ?? NaN)) return 0;
  return Math.max(0, Math.min(1, progress ?? 0));
}

function notificationTitle(status: DownloadStatus) {
  if (status === 'completed') return 'Ark download complete';
  if (status === 'failed') return 'Ark download failed';
  if (status === 'paused') return 'Ark download paused';
  return 'Ark download update';
}

function notificationBody(status: DownloadStatus, progress: number) {
  if (status === 'completed') return 'Ready for offline use.';
  if (status === 'failed') return 'Open Ark to retry from Downloads.';
  if (status === 'paused') return 'Open Ark to resume when ready.';
  if (status === 'verifying') return 'Verifying file integrity.';
  return `${Math.round(progress * 100)}% complete`;
}
