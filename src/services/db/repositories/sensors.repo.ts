import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';

export class SensorsRepository {
  static async saveSnapshot(type: string, data: unknown) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      'INSERT INTO sensor_snapshots (id, type, data_json, created_at) VALUES (?, ?, ?, ?)',
      [randomUUID(), type, JSON.stringify(data), Date.now()]
    );
  }

  static async listSnapshots(type: string, limit = 20) {
    const db = await DatabaseClient.getDb();
    return db.getAllAsync<{ data_json: string; created_at: number }>(
      'SELECT data_json, created_at FROM sensor_snapshots WHERE type = ? ORDER BY created_at DESC LIMIT ?',
      [type, limit]
    );
  }
}
