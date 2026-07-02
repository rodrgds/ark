import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { BATTERY_REDUCE_MODE_KEY } from '@/constants/battery';
import {
  DEFAULT_RATE_MODE,
  DEFAULT_RECORDING_PROFILE,
  DEFAULT_TRACK_ACTIVITY,
  DEFAULT_UNIT_SYSTEM,
  RECORDING_PROFILE_OPTIONS,
} from '@/constants/tracks';
import {
  normalizeRateDisplayMode,
  normalizeTrackActivity,
  normalizeUnitSystem,
} from '@/services/tracks/track-format';
import { getDeviceDefaultFieldPreferences } from '@/services/preferences/field-preferences-defaults';
import type {
  RateDisplayMode,
  TrackActivityType,
  TrackRecordingProfile,
  UnitSystem,
} from '@/types/tracks';

const CHECKLIST_STATE_KEY = 'tools.readiness-checklist';
const AI_MODEL_PICKER_ENABLED_KEY = 'ai.modelPickerEnabled';
const AI_SELECTED_MODEL_ID_KEY = 'ai.selectedModelId';
const AI_SELECTED_EMBEDDING_MODEL_ID_KEY = 'ai.selectedEmbeddingModelId';
const AI_SELECTED_VOICE_MODEL_ID_KEY = 'ai.selectedVoiceModelId';
const AI_CHAT_MODEL_DISABLED_KEY = 'ai.chatModelDisabled';
const DOWNLOADS_WIFI_ONLY_KEY = 'downloads.wifiOnly';
const TOP_HEADER_ENABLED_KEY = 'layout.topHeaderEnabled';
const FIELD_UNIT_SYSTEM_KEY = 'field.unitSystem';
const FIELD_RATE_MODE_KEY = 'field.rateMode';
const FIELD_DEFAULT_TRACK_ACTIVITY_KEY = 'field.defaultTrackActivity';
const FIELD_RECORDING_PROFILE_KEY = 'field.recordingProfile';

type TopHeaderListener = (enabled: boolean) => void;
const topHeaderListeners = new Set<TopHeaderListener>();
type FieldPreferencesListener = (preferences: FieldPreferences) => void;
const fieldPreferencesListeners = new Set<FieldPreferencesListener>();

export type ReadinessChecklistState = Record<string, boolean>;
export type FieldPreferences = {
  unitSystem: UnitSystem;
  rateMode: RateDisplayMode;
  defaultTrackActivity: TrackActivityType;
  recordingProfile: TrackRecordingProfile;
};

export class PreferencesService {
  static async getBatteryReduceModeEnabled() {
    const value = await SettingsRepository.get(BATTERY_REDUCE_MODE_KEY);
    return value === 'true';
  }

  static async setBatteryReduceModeEnabled(enabled: boolean) {
    await SettingsRepository.set(BATTERY_REDUCE_MODE_KEY, enabled ? 'true' : 'false');
  }

  static async getTopHeaderEnabled() {
    const value = await SettingsRepository.get(TOP_HEADER_ENABLED_KEY);
    return value !== 'false';
  }

  static async setTopHeaderEnabled(enabled: boolean) {
    await SettingsRepository.set(TOP_HEADER_ENABLED_KEY, enabled ? 'true' : 'false');
    for (const listener of topHeaderListeners) listener(enabled);
  }

  static subscribeTopHeaderEnabled(listener: TopHeaderListener) {
    topHeaderListeners.add(listener);
    return () => {
      topHeaderListeners.delete(listener);
    };
  }

  static async getMotionEnabled() {
    return !(await this.getBatteryReduceModeEnabled());
  }

  static async setMotionEnabled(enabled: boolean) {
    await this.setBatteryReduceModeEnabled(!enabled);
  }

  static async getAiModelPickerEnabled() {
    const value = await SettingsRepository.get(AI_MODEL_PICKER_ENABLED_KEY);
    return value !== 'false';
  }

  static async setAiModelPickerEnabled(enabled: boolean) {
    await SettingsRepository.set(AI_MODEL_PICKER_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  static async getSelectedAiModelId() {
    const value = await SettingsRepository.get(AI_SELECTED_MODEL_ID_KEY);
    return value || null;
  }

  static async setSelectedAiModelId(modelId: string | null) {
    await SettingsRepository.set(AI_SELECTED_MODEL_ID_KEY, modelId ?? '');
  }

  static async getSelectedEmbeddingModelId() {
    const value = await SettingsRepository.get(AI_SELECTED_EMBEDDING_MODEL_ID_KEY);
    return value || null;
  }

  static async setSelectedEmbeddingModelId(modelId: string | null) {
    await SettingsRepository.set(AI_SELECTED_EMBEDDING_MODEL_ID_KEY, modelId ?? '');
  }

  static async getSelectedVoiceModelId() {
    const value = await SettingsRepository.get(AI_SELECTED_VOICE_MODEL_ID_KEY);
    return value || null;
  }

  static async setSelectedVoiceModelId(modelId: string | null) {
    await SettingsRepository.set(AI_SELECTED_VOICE_MODEL_ID_KEY, modelId ?? '');
  }

  static async getAiChatModelDisabled() {
    const value = await SettingsRepository.get(AI_CHAT_MODEL_DISABLED_KEY);
    return value === 'true';
  }

  static async setAiChatModelDisabled(disabled: boolean) {
    await SettingsRepository.set(AI_CHAT_MODEL_DISABLED_KEY, disabled ? 'true' : 'false');
  }

  static async getWifiOnlyDownloadsEnabled() {
    const value = await SettingsRepository.get(DOWNLOADS_WIFI_ONLY_KEY);
    return value === 'true';
  }

  static async setWifiOnlyDownloadsEnabled(enabled: boolean) {
    await SettingsRepository.set(DOWNLOADS_WIFI_ONLY_KEY, enabled ? 'true' : 'false');
  }

  static async getFieldPreferences(): Promise<FieldPreferences> {
    const [unitSystem, rateMode, defaultTrackActivity, recordingProfile] = await Promise.all([
      SettingsRepository.get(FIELD_UNIT_SYSTEM_KEY),
      SettingsRepository.get(FIELD_RATE_MODE_KEY),
      SettingsRepository.get(FIELD_DEFAULT_TRACK_ACTIVITY_KEY),
      SettingsRepository.get(FIELD_RECORDING_PROFILE_KEY),
    ]);
    const defaults = getDeviceDefaultFieldPreferences();
    const next: FieldPreferences = {
      unitSystem: unitSystem ? normalizeUnitSystem(unitSystem) : defaults.unitSystem,
      rateMode: rateMode ? normalizeRateDisplayMode(rateMode) : defaults.rateMode,
      defaultTrackActivity: defaultTrackActivity
        ? normalizeTrackActivity(defaultTrackActivity)
        : defaults.defaultTrackActivity,
      recordingProfile: recordingProfile
        ? normalizeRecordingProfile(recordingProfile)
        : defaults.recordingProfile,
    };
    const repairs: Promise<void>[] = [];
    if (unitSystem !== next.unitSystem) {
      repairs.push(SettingsRepository.set(FIELD_UNIT_SYSTEM_KEY, next.unitSystem));
    }
    if (rateMode !== next.rateMode) {
      repairs.push(SettingsRepository.set(FIELD_RATE_MODE_KEY, next.rateMode));
    }
    if (defaultTrackActivity !== next.defaultTrackActivity) {
      repairs.push(
        SettingsRepository.set(FIELD_DEFAULT_TRACK_ACTIVITY_KEY, next.defaultTrackActivity)
      );
    }
    if (recordingProfile !== next.recordingProfile) {
      repairs.push(SettingsRepository.set(FIELD_RECORDING_PROFILE_KEY, next.recordingProfile));
    }
    if (repairs.length) await Promise.all(repairs);
    return next;
  }

  static async setFieldPreferences(preferences: Partial<FieldPreferences>) {
    const current = await this.getFieldPreferences();
    const next: FieldPreferences = {
      unitSystem: preferences.unitSystem ?? current.unitSystem ?? DEFAULT_UNIT_SYSTEM,
      rateMode: preferences.rateMode ?? current.rateMode ?? DEFAULT_RATE_MODE,
      defaultTrackActivity:
        preferences.defaultTrackActivity ?? current.defaultTrackActivity ?? DEFAULT_TRACK_ACTIVITY,
      recordingProfile:
        preferences.recordingProfile ?? current.recordingProfile ?? DEFAULT_RECORDING_PROFILE,
    };
    await Promise.all([
      SettingsRepository.set(FIELD_UNIT_SYSTEM_KEY, next.unitSystem),
      SettingsRepository.set(FIELD_RATE_MODE_KEY, next.rateMode),
      SettingsRepository.set(FIELD_DEFAULT_TRACK_ACTIVITY_KEY, next.defaultTrackActivity),
      SettingsRepository.set(FIELD_RECORDING_PROFILE_KEY, next.recordingProfile),
    ]);
    for (const listener of fieldPreferencesListeners) listener(next);
    return next;
  }

  static subscribeFieldPreferences(listener: FieldPreferencesListener) {
    fieldPreferencesListeners.add(listener);
    return () => {
      fieldPreferencesListeners.delete(listener);
    };
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

function normalizeRecordingProfile(value: string | null): TrackRecordingProfile {
  return RECORDING_PROFILE_OPTIONS.some((option) => option.value === value)
    ? (value as TrackRecordingProfile)
    : DEFAULT_RECORDING_PROFILE;
}
