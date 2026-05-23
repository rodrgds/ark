import { formatDistanceToNowStrict } from 'date-fns';
import * as Location from 'expo-location';
import { WeatherRepository } from '@/services/db/repositories/weather.repo';

export type WeatherSymbol =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

export type CachedForecastDay = {
  date: string;
  weatherCode: number | null;
  symbol: WeatherSymbol;
  label: string;
  highC: number | null;
  lowC: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPct: number | null;
  windKph: number | null;
  gustKph: number | null;
  confidencePct: number;
};

export type CachedForecastHour = {
  time: string;
  weatherCode: number | null;
  symbol: WeatherSymbol;
  temperatureC: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number | null;
  windKph: number | null;
  pressureHpa: number | null;
};

export type CachedForecast = {
  summary: string;
  conditionLabel: string;
  conditionSymbol: WeatherSymbol;
  confidencePct: number;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  windGustKph: number | null;
  pressureHpa: number | null;
  precipitationMm: number | null;
  cloudCoverPct: number | null;
  weatherCode: number | null;
  hourly: CachedForecastHour[];
  daily: CachedForecastDay[];
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
      forecast: normalizeForecast(JSON.parse(row.forecast_json) as Partial<CachedForecast>),
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
      stale,
      ageHours: Math.max(0, (Date.now() - row.fetched_at) / 3_600_000),
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
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,pressure_msl,precipitation,cloud_cover',
    hourly:
      'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,pressure_msl',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
    forecast_days: '14',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather refresh failed (${response.status}).`);
  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
      wind_gusts_10m?: number;
      pressure_msl?: number;
      precipitation?: number;
      cloud_cover?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation_probability?: number[];
      precipitation?: number[];
      weather_code?: number[];
      wind_speed_10m?: number[];
      pressure_msl?: number[];
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
      wind_speed_10m_max?: number[];
      wind_gusts_10m_max?: number[];
    };
  };

  const temperature = data.current?.temperature_2m ?? null;
  const apparentTemperature = data.current?.apparent_temperature ?? null;
  const humidity = data.current?.relative_humidity_2m ?? null;
  const wind = data.current?.wind_speed_10m ?? null;
  const gust = data.current?.wind_gusts_10m ?? null;
  const pressure = data.current?.pressure_msl ?? null;
  const precipitation = data.current?.precipitation ?? null;
  const cloudCover = data.current?.cloud_cover ?? null;
  const weatherCode = data.current?.weather_code ?? null;
  const condition = weatherCondition(weatherCode);
  const daily = (data.daily?.time ?? []).map((date, index) => {
    const code = data.daily?.weather_code?.[index] ?? null;
    const dayCondition = weatherCondition(code);
    return {
      date,
      weatherCode: code,
      symbol: dayCondition.symbol,
      label: dayCondition.label,
      highC: data.daily?.temperature_2m_max?.[index] ?? null,
      lowC: data.daily?.temperature_2m_min?.[index] ?? null,
      precipitationMm: data.daily?.precipitation_sum?.[index] ?? null,
      precipitationProbabilityPct: data.daily?.precipitation_probability_max?.[index] ?? null,
      windKph: data.daily?.wind_speed_10m_max?.[index] ?? null,
      gustKph: data.daily?.wind_gusts_10m_max?.[index] ?? null,
      confidencePct: forecastConfidence(index),
    };
  });

  return {
    summary: buildSummary(temperature, wind, pressure, condition.label),
    conditionLabel: condition.label,
    conditionSymbol: condition.symbol,
    confidencePct: 92,
    temperatureC: temperature,
    apparentTemperatureC: apparentTemperature,
    humidityPct: humidity,
    windKph: wind,
    windGustKph: gust,
    pressureHpa: pressure,
    precipitationMm: precipitation,
    cloudCoverPct: cloudCover,
    weatherCode,
    hourly: (data.hourly?.time ?? []).slice(0, 72).map((time, index) => {
      const code = data.hourly?.weather_code?.[index] ?? null;
      return {
        time,
        weatherCode: code,
        symbol: weatherCondition(code).symbol,
        temperatureC: data.hourly?.temperature_2m?.[index] ?? null,
        precipitationProbabilityPct: data.hourly?.precipitation_probability?.[index] ?? null,
        precipitationMm: data.hourly?.precipitation?.[index] ?? null,
        windKph: data.hourly?.wind_speed_10m?.[index] ?? null,
        pressureHpa: data.hourly?.pressure_msl?.[index] ?? null,
      };
    }),
    daily,
  };
}

function buildSummary(
  temperature: number | null,
  wind: number | null,
  pressure: number | null,
  label: string
) {
  const parts = [label];
  if (temperature !== null) parts.push(`${Math.round(temperature)}C`);
  if (wind !== null) parts.push(`${Math.round(wind)} km/h wind`);
  if (pressure !== null) parts.push(`${Math.round(pressure)} hPa`);
  return parts.join(', ');
}

function weatherCondition(code: number | null): { label: string; symbol: WeatherSymbol } {
  if (code === null) return { label: 'Forecast cached', symbol: 'unknown' };
  if (code === 0) return { label: 'Clear', symbol: 'clear' };
  if ([1, 2].includes(code)) return { label: 'Partly cloudy', symbol: 'partly-cloudy' };
  if (code === 3) return { label: 'Overcast', symbol: 'cloudy' };
  if ([45, 48].includes(code)) return { label: 'Fog', symbol: 'fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', symbol: 'drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', symbol: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', symbol: 'snow' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorm', symbol: 'storm' };
  return { label: 'Weather cached', symbol: 'unknown' };
}

function forecastConfidence(dayIndex: number) {
  if (dayIndex <= 0) return 90;
  if (dayIndex <= 2) return 84;
  if (dayIndex <= 5) return 74;
  if (dayIndex <= 8) return 62;
  if (dayIndex <= 11) return 52;
  return 44;
}

function normalizeForecast(forecast: Partial<CachedForecast>): CachedForecast {
  const condition = weatherCondition(forecast.weatherCode ?? null);
  const daily = (forecast.daily ?? []).map((day, index) => {
    const dayCondition = weatherCondition(day.weatherCode ?? null);
    return {
      date: day.date,
      weatherCode: day.weatherCode ?? null,
      symbol: day.symbol ?? dayCondition.symbol,
      label: day.label ?? dayCondition.label,
      highC: day.highC ?? null,
      lowC: day.lowC ?? null,
      precipitationMm: day.precipitationMm ?? null,
      precipitationProbabilityPct: day.precipitationProbabilityPct ?? null,
      windKph: day.windKph ?? null,
      gustKph: day.gustKph ?? null,
      confidencePct: day.confidencePct ?? forecastConfidence(index),
    };
  });

  return {
    summary: forecast.summary ?? buildSummary(null, null, null, condition.label),
    conditionLabel: forecast.conditionLabel ?? condition.label,
    conditionSymbol: forecast.conditionSymbol ?? condition.symbol,
    confidencePct: forecast.confidencePct ?? 80,
    temperatureC: forecast.temperatureC ?? null,
    apparentTemperatureC: forecast.apparentTemperatureC ?? null,
    humidityPct: forecast.humidityPct ?? null,
    windKph: forecast.windKph ?? null,
    windGustKph: forecast.windGustKph ?? null,
    pressureHpa: forecast.pressureHpa ?? null,
    precipitationMm: forecast.precipitationMm ?? null,
    cloudCoverPct: forecast.cloudCoverPct ?? null,
    weatherCode: forecast.weatherCode ?? null,
    hourly: forecast.hourly ?? [],
    daily,
  };
}
