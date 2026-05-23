import { formatDistanceToNowStrict } from 'date-fns';
import * as Location from 'expo-location';
import { WeatherRepository } from '@/services/db/repositories/weather.repo';

type CachedForecast = {
  summary: string;
  temperatureC: number | null;
  windKph: number | null;
  pressureHpa: number | null;
  weatherCode: number | null;
  daily: Array<{
    date: string;
    highC: number | null;
    lowC: number | null;
    precipitationMm: number | null;
  }>;
};

const DEFAULT_LOCATION = {
  latitude: 38.7223,
  longitude: -9.1393,
  label: 'Lisbon fallback',
};

export class WeatherCacheService {
  static async refresh() {
    const location = await getWeatherLocation();
    const forecast = await fetchOpenMeteo(location.latitude, location.longitude);
    await WeatherRepository.saveForecast({
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.label,
      provider: 'open-meteo',
      forecast,
      confidence: { note: 'Fetched online and cached locally for offline use.' },
    });
    return this.getLatest();
  }

  static async getLatestOrRefresh() {
    let row = await WeatherRepository.getLatest();
    const stale = row?.expires_at ? row.expires_at < Date.now() : true;
    if (!row || stale) {
      try {
        const refreshed = await this.refresh();
        if (refreshed) return refreshed;
      } catch {
        row = await WeatherRepository.getLatest();
      }
    }
    return row ? this.mapRow(row) : null;
  }

  static async getLatest() {
    const row = await WeatherRepository.getLatest();
    return row ? this.mapRow(row) : null;
  }

  private static mapRow(row: Awaited<ReturnType<typeof WeatherRepository.getLatest>>) {
    if (!row) return null;
    const stale = row.expires_at ? row.expires_at < Date.now() : true;
    return {
      id: row.id,
      location: row.location_label ?? 'Unknown',
      provider: row.provider ?? 'unknown',
      forecast: JSON.parse(row.forecast_json) as CachedForecast,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      stale,
      freshness: `${formatDistanceToNowStrict(row.fetched_at)} ago`,
    };
  }
}

async function getWeatherLocation() {
  const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (permission?.granted) {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);
    if (current) {
      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        label: 'Current location',
      };
    }
  }
  return DEFAULT_LOCATION;
}

async function fetchOpenMeteo(latitude: number, longitude: number): Promise<CachedForecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m,pressure_msl',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    forecast_days: '3',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather refresh failed (${response.status}).`);
  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      pressure_msl?: number;
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
    };
  };

  const temperature = data.current?.temperature_2m ?? null;
  const wind = data.current?.wind_speed_10m ?? null;
  const pressure = data.current?.pressure_msl ?? null;
  const weatherCode = data.current?.weather_code ?? null;

  return {
    summary: buildSummary(temperature, wind, pressure, weatherCode),
    temperatureC: temperature,
    windKph: wind,
    pressureHpa: pressure,
    weatherCode,
    daily: (data.daily?.time ?? []).map((date, index) => ({
      date,
      highC: data.daily?.temperature_2m_max?.[index] ?? null,
      lowC: data.daily?.temperature_2m_min?.[index] ?? null,
      precipitationMm: data.daily?.precipitation_sum?.[index] ?? null,
    })),
  };
}

function buildSummary(
  temperature: number | null,
  wind: number | null,
  pressure: number | null,
  code: number | null
) {
  const parts = [weatherLabel(code)];
  if (temperature !== null) parts.push(`${Math.round(temperature)}C`);
  if (wind !== null) parts.push(`${Math.round(wind)} km/h wind`);
  if (pressure !== null) parts.push(`${Math.round(pressure)} hPa`);
  return parts.join(' - ');
}

function weatherLabel(code: number | null) {
  if (code === null) return 'Forecast cached';
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Weather cached';
}
