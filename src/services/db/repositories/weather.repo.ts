import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';

export class WeatherRepository {
  static async getLatest() {
    const db = await DatabaseClient.getDb();
    return db.getFirstAsync<{
      id: string;
      location_label: string | null;
      forecast_json: string;
      fetched_at: number;
      expires_at: number | null;
    }>('SELECT * FROM weather_cache ORDER BY fetched_at DESC LIMIT 1');
  }

  static async saveMockPortugalForecast() {
    const db = await DatabaseClient.getDb();
    const fetchedAt = Date.now();
    await db.runAsync(
      `INSERT INTO weather_cache
        (id, location_label, provider, forecast_json, confidence_json, fetched_at, expires_at)
       VALUES (?, 'Portugal', 'mock', ?, ?, ?, ?)`,
      [
        randomUUID(),
        JSON.stringify({
          summary: 'Cached sample: mild, coastal wind, pressure trend matters offline.',
        }),
        JSON.stringify({ note: 'Mock data for UI only.' }),
        fetchedAt,
        fetchedAt + 1000 * 60 * 60 * 12,
      ]
    );
  }
}
