import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const MOTION_ENABLED_KEY = 'motion.enabled';
const CHECKLIST_STATE_KEY = 'tools.readiness-checklist';

export type ReadinessChecklistState = Record<string, boolean>;

export class PreferencesService {
  static async getMotionEnabled() {
    const value = await SettingsRepository.get(MOTION_ENABLED_KEY);
    return value !== 'false';
  }

  static async setMotionEnabled(enabled: boolean) {
    await SettingsRepository.set(MOTION_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  static async getReadinessChecklist(): Promise<ReadinessChecklistState> {
    const value = await SettingsRepository.get(CHECKLIST_STATE_KEY);
    if (!value) return {};
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([, checked]) => typeof checked === 'boolean')
      ) as ReadinessChecklistState;
    } catch {
      return {};
    }
  }

  static async setReadinessChecklist(state: ReadinessChecklistState) {
    await SettingsRepository.set(CHECKLIST_STATE_KEY, JSON.stringify(state));
  }
}
