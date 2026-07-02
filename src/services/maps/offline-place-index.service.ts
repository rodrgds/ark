import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { OfflineMapSearchResult } from '@/types/maps';

type BundledOfflinePlace = {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  terms?: string[];
};

type BundledOfflinePlaceCatalog = {
  version: number;
  updatedAt: string;
  source: string;
  places: BundledOfflinePlace[];
};

const bundledPlaces = require('../../../assets/offline-places.json') as BundledOfflinePlaceCatalog;
const SEEDED_KEY = 'maps.offlinePlaces.seededVersion';

let seedPromise: Promise<void> | null = null;

export class OfflinePlaceIndexService {
  static async ensureSeeded() {
    if (!seedPromise) {
      seedPromise = this.seedBundledPlaces().finally(() => {
        seedPromise = null;
      });
    }
    return seedPromise;
  }

  static async search(query: string, limit = 8): Promise<OfflineMapSearchResult[]> {
    await this.ensureSeeded();
    const places = await MapsRepository.searchPlaces(query, limit);
    return places.map((place) => ({
      id: place.id,
      kind: 'place',
      title: place.title,
      subtitle: place.subtitle || 'Offline place',
      latitude: place.latitude,
      longitude: place.longitude,
      placeSource: 'offline',
    }));
  }

  static async indexPhotonResults(results: OfflineMapSearchResult[]) {
    const places = results
      .filter((result) => result.kind === 'place')
      .filter((result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
      .map((result) => ({
        id: result.id.startsWith('photon-') ? undefined : result.id,
        title: result.title,
        subtitle: result.subtitle,
        latitude: result.latitude!,
        longitude: result.longitude!,
        source: 'photon' as const,
        sourceRef: result.id,
        terms: `${result.title} ${result.subtitle}`,
        lastSeenAt: Date.now(),
      }));
    if (!places.length) return [];
    return MapsRepository.upsertPlaces(places);
  }

  private static async seedBundledPlaces() {
    const seedVersion = `${bundledPlaces.version}:${bundledPlaces.updatedAt}:${bundledPlaces.places.length}`;
    const current = await SettingsRepository.get(SEEDED_KEY);
    if (current === seedVersion) return;

    await MapsRepository.upsertPlaces(
      bundledPlaces.places.map((place) => ({
        id: `bundled-${place.id}`,
        title: place.title,
        subtitle: place.subtitle ?? null,
        latitude: place.latitude,
        longitude: place.longitude,
        source: 'bundled' as const,
        sourceRef: place.id,
        terms: [place.title, place.subtitle, ...(place.terms ?? [])].filter(Boolean).join(' '),
        lastSeenAt: null,
      }))
    );
    await SettingsRepository.set(SEEDED_KEY, seedVersion);
  }
}
