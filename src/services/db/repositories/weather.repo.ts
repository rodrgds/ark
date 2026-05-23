import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';

export class WeatherRepository {
  static async getLatest() {
    const db = await DatabaseClient.getDb();
    return db.getFirstAsync<{
      id: string;
      latitude: number | null;
      longitude: number | null;
      location_label: string | null;
      provider: string | null;
      forecast_json: string;
      confidence_json: string | null;
      fetched_at: number;
      expires_at: number | null;
    }>('SELECT * FROM weather_cache ORDER BY fetched_at DESC LIMIT 1');
  }

  static async saveForecast(input: {
    latitude: number;
    longitude: number;
    locationLabel: string;
    provider: string;
    forecast: unknown;
    confidence?: unknown;
    expiresAt?: number | null;
  }) {
    const db = await DatabaseClient.getDb();
    const fetchedAt = Date.now();
    await db.runAsync(
      `INSERT INTO weather_cache
        (id, latitude, longitude, location_label, provider, forecast_json, confidence_json, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.latitude,
        input.longitude,
        input.locationLabel,
        input.provider,
        JSON.stringify(input.forecast),
        input.confidence ? JSON.stringify(input.confidence) : null,
        fetchedAt,
        input.expiresAt ?? fetchedAt + 1000 * 60 * 60 * 12,
      ]
    );
  }
}
