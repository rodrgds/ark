import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const MOTION_ENABLED_KEY = 'motion.enabled';
const CHECKLIST_STATE_KEY = 'tools.readiness-checklist';
const AI_MODEL_PICKER_ENABLED_KEY = 'ai.modelPickerEnabled';
const AI_SELECTED_MODEL_ID_KEY = 'ai.selectedModelId';
const AI_SELECTED_EMBEDDING_MODEL_ID_KEY = 'ai.selectedEmbeddingModelId';
const AI_CHAT_MODEL_DISABLED_KEY = 'ai.chatModelDisabled';
const INTERFACE_MODE_KEY = 'interface.mode';

export type ReadinessChecklistState = Record<string, boolean>;
export type InterfaceMode = 'simple' | 'technical';

export class PreferencesService {
  static async getMotionEnabled() {
    const value = await SettingsRepository.get(MOTION_ENABLED_KEY);
    return value !== 'false';
  }

  static async setMotionEnabled(enabled: boolean) {
    await SettingsRepository.set(MOTION_ENABLED_KEY, enabled ? 'true' : 'false');
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

  static async getAiChatModelDisabled() {
    const value = await SettingsRepository.get(AI_CHAT_MODEL_DISABLED_KEY);
    return value === 'true';
  }

  static async setAiChatModelDisabled(disabled: boolean) {
    await SettingsRepository.set(AI_CHAT_MODEL_DISABLED_KEY, disabled ? 'true' : 'false');
  }

  static async getInterfaceMode(): Promise<InterfaceMode> {
    const value = await SettingsRepository.get(INTERFACE_MODE_KEY);
    return value === 'technical' ? 'technical' : 'simple';
  }

  static async setInterfaceMode(mode: InterfaceMode) {
    await SettingsRepository.set(INTERFACE_MODE_KEY, mode);
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
