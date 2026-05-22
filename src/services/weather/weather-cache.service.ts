import { formatDistanceToNowStrict } from 'date-fns';
import { WeatherRepository } from '@/services/db/repositories/weather.repo';

export class WeatherCacheService {
  static async getLatestOrSeed() {
    let row = await WeatherRepository.getLatest();
    if (!row) {
      await WeatherRepository.saveMockPortugalForecast();
      row = await WeatherRepository.getLatest();
    }
    if (!row) return null;
    const stale = row.expires_at ? row.expires_at < Date.now() : true;
    return {
      id: row.id,
      location: row.location_label ?? 'Unknown',
      forecast: JSON.parse(row.forecast_json) as { summary: string },
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      stale,
      freshness: `${formatDistanceToNowStrict(row.fetched_at)} ago`,
    };
  }
}
