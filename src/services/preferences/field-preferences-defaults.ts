import {
  DEFAULT_RATE_MODE,
  DEFAULT_RECORDING_PROFILE,
  DEFAULT_TRACK_ACTIVITY,
  DEFAULT_UNIT_SYSTEM,
} from '@/constants/tracks';
import type {
  RateDisplayMode,
  TrackActivityType,
  TrackRecordingProfile,
  UnitSystem,
} from '@/types/tracks';

type LocaleLike = {
  languageTag?: string | null;
  languageRegionCode?: string | null;
  measurementSystem?: string | null;
  regionCode?: string | null;
};

export type DefaultFieldPreferences = {
  unitSystem: UnitSystem;
  rateMode: RateDisplayMode;
  defaultTrackActivity: TrackActivityType;
  recordingProfile: TrackRecordingProfile;
};

const IMPERIAL_REGION_CODES = new Set(['US', 'LR', 'MM']);
const UK_IMPERIAL_REGION_CODES = new Set(['GB', 'UK']);

export function getDeviceDefaultFieldPreferences(): DefaultFieldPreferences {
  return {
    unitSystem: inferUnitSystemFromLocales(readDeviceLocales()),
    rateMode: DEFAULT_RATE_MODE,
    defaultTrackActivity: DEFAULT_TRACK_ACTIVITY,
    recordingProfile: DEFAULT_RECORDING_PROFILE,
  };
}

export function inferUnitSystemFromLocales(locales: LocaleLike[]): UnitSystem {
  for (const locale of locales) {
    const measurementSystem = locale.measurementSystem?.toLowerCase();
    if (measurementSystem === 'metric') return 'metric';
    if (measurementSystem === 'us' || measurementSystem === 'uk') return 'imperial';
  }

  for (const locale of locales) {
    const regionCode =
      normalizeRegionCode(locale.regionCode) ??
      normalizeRegionCode(locale.languageRegionCode) ??
      normalizeRegionCode(regionCodeFromLanguageTag(locale.languageTag));
    if (!regionCode) continue;
    if (IMPERIAL_REGION_CODES.has(regionCode) || UK_IMPERIAL_REGION_CODES.has(regionCode)) {
      return 'imperial';
    }
  }

  return DEFAULT_UNIT_SYSTEM;
}

function readDeviceLocales(): LocaleLike[] {
  try {
    const localization = require('expo-localization') as {
      getLocales?: () => LocaleLike[];
    };
    const locales = localization.getLocales?.();
    return Array.isArray(locales) ? locales : [];
  } catch {
    return [];
  }
}

function normalizeRegionCode(regionCode: string | null | undefined) {
  const normalized = regionCode?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function regionCodeFromLanguageTag(languageTag: string | null | undefined) {
  const match = languageTag?.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/);
  return match?.[1] ?? null;
}
