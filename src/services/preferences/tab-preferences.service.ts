import {
  ARK_TABS,
  DEFAULT_ENABLED_TABS,
  DEFAULT_TAB_ORDER,
  type ArkTabId,
} from '@/constants/tabs';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const TAB_ORDER_KEY = 'tabs.order';
const ENABLED_TABS_KEY = 'tabs.enabled';
const tabIds = new Set<string>(ARK_TABS.map((tab) => tab.id));
const lockedTabIds = new Set(ARK_TABS.filter((tab) => tab.locked).map((tab) => tab.id));
const listeners = new Set<() => void>();

export type TabPreferences = {
  order: ArkTabId[];
  enabled: ArkTabId[];
};

function parseTabIds(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const seen = new Set<ArkTabId>();
    return parsed.filter((id): id is ArkTabId => {
      if (typeof id !== 'string' || !tabIds.has(id) || seen.has(id as ArkTabId)) {
        return false;
      }
      seen.add(id as ArkTabId);
      return true;
    });
  } catch {
    return null;
  }
}

function normalizeOrder(value: string | null) {
  const stored = parseTabIds(value) ?? [];
  const storedSet = new Set<ArkTabId>(stored);
  return [...stored, ...DEFAULT_TAB_ORDER.filter((id) => !storedSet.has(id))];
}

function normalizeEnabled(value: string | null) {
  const stored = parseTabIds(value) ?? DEFAULT_ENABLED_TABS;
  return Array.from(new Set([...stored, ...lockedTabIds])).filter((id) => tabIds.has(id));
}

function emitChange() {
  for (const listener of listeners) listener();
}

export class TabPreferencesService {
  static subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  static async getPreferences(): Promise<TabPreferences> {
    const [order, enabled] = await Promise.all([
      SettingsRepository.get(TAB_ORDER_KEY),
      SettingsRepository.get(ENABLED_TABS_KEY),
    ]);
    return {
      order: normalizeOrder(order),
      enabled: normalizeEnabled(enabled),
    };
  }

  static async setOrder(order: ArkTabId[]) {
    const normalized = normalizeOrder(JSON.stringify(order));
    await SettingsRepository.set(TAB_ORDER_KEY, JSON.stringify(normalized));
    emitChange();
    return normalized;
  }

  static async setEnabled(tabId: ArkTabId, enabled: boolean) {
    const current = await this.getPreferences();
    const next = new Set(current.enabled);
    if (enabled || lockedTabIds.has(tabId)) {
      next.add(tabId);
    } else {
      next.delete(tabId);
    }
    const normalized = normalizeEnabled(JSON.stringify(Array.from(next)));
    await SettingsRepository.set(ENABLED_TABS_KEY, JSON.stringify(normalized));
    emitChange();
    return normalized;
  }

  static async savePreferences(preferences: TabPreferences) {
    const normalizedOrder = normalizeOrder(JSON.stringify(preferences.order));
    const normalizedEnabled = normalizeEnabled(JSON.stringify(preferences.enabled));
    await Promise.all([
      SettingsRepository.set(TAB_ORDER_KEY, JSON.stringify(normalizedOrder)),
      SettingsRepository.set(ENABLED_TABS_KEY, JSON.stringify(normalizedEnabled)),
    ]);
    emitChange();
    return { order: normalizedOrder, enabled: normalizedEnabled };
  }

  static isLocked(tabId: ArkTabId) {
    return lockedTabIds.has(tabId);
  }
}
