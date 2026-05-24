import { RagService } from '@/services/ai/rag.service';
import { tokenizeFtsInput } from '@/services/db/fts';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import type { AiAdapterSendInput, AiCitation } from '@/types/ai';

export type AiToolRun = {
  citations: AiCitation[];
  sourceContext: NonNullable<AiAdapterSendInput['sourceContext']>;
  toolTrace: NonNullable<AiAdapterSendInput['toolTrace']>;
};

type CachedWeatherSnapshot = NonNullable<Awaited<ReturnType<typeof WeatherCacheService.getLatest>>>;
type CachedWeatherDay = CachedWeatherSnapshot['forecast']['daily'][number];
type CachedWeatherHour = CachedWeatherSnapshot['forecast']['hourly'][number];

const WEATHER_TERMS = new Set([
  'cloud',
  'clouds',
  'cloudy',
  'drizzle',
  'forecaste',
  'forecast',
  'forcast',
  'forecasts',
  'gust',
  'gusts',
  'humid',
  'humidity',
  'meteorology',
  'precip',
  'precipitation',
  'pressure',
  'rain',
  'raining',
  'rainy',
  'showers',
  'snow',
  'storm',
  'storms',
  'temperature',
  'temperatures',
  'temp',
  'weather',
  'wind',
  'windy',
  'winds',
]);

const AMBIGUOUS_WEATHER_TERMS = new Set(['cold', 'conditions', 'heat', 'hot']);
const TODAY_TERMS = new Set(['current', 'currently', 'now', 'today', 'tonight']);
const TOMORROW_TERMS = new Set(['tomorrow']);
const WEATHER_TIME_TERMS = new Set([...TODAY_TERMS, ...TOMORROW_TERMS, 'week', 'weekend']);
const WEATHER_SOURCE_ID = 'weather:cached';

export class AiToolService {
  static async runLocalKnowledgeTools(query: string): Promise<AiToolRun> {
    const weatherRun = await this.runCachedWeatherTool(query);
    if (weatherRun) return weatherRun;

    const citations = await RagService.search(query, { limit: 4 });
    const sourceContext = await RagService.expandCitations(citations, {
      maxSources: 3,
      maxCharsPerSource: 1800,
    });
    return {
      citations,
      sourceContext,
      toolTrace: [
        {
          tool: 'search_local_knowledge',
          summary: citations.length
            ? `Found ${citations.length} relevant local source matches.`
            : 'No local matches found.',
        },
        ...sourceContext.map((source) => ({
          tool: 'read_local_source' as const,
          summary: `Opened ${source.title} for fuller context.`,
        })),
      ],
    };
  }

  static emptyRun(): AiToolRun {
    return {
      citations: [],
      sourceContext: [],
      toolTrace: [],
    };
  }

  private static async runCachedWeatherTool(query: string): Promise<AiToolRun | null> {
    const terms = tokenizeFtsInput(query);
    if (!isWeatherQuery(terms)) return null;

    const weather = await WeatherCacheService.getLatest();
    if (!weather) {
      return {
        citations: [],
        sourceContext: [],
        toolTrace: [
          {
            tool: 'read_cached_weather',
            summary:
              'No cached weather forecast is available. Refresh Weather while online, then ask again offline.',
          },
        ],
      };
    }

    const title = `Weather: ${weather.location}`;
    const snippet = buildWeatherSnippet(weather, terms);
    const citation: AiCitation = {
      sourceId: WEATHER_SOURCE_ID,
      title,
      snippet,
      sourceRef: weather.id,
      sectionTitle: 'Cached forecast',
      targetHref: '/tools/weather',
    };

    return {
      citations: [citation],
      sourceContext: [
        {
          sourceId: WEATHER_SOURCE_ID,
          title,
          content: buildWeatherContext(weather),
        },
      ],
      toolTrace: [
        {
          tool: 'read_cached_weather',
          summary: `Opened cached weather forecast for ${weather.location} (${weather.freshness}).`,
        },
      ],
    };
  }
}

function isWeatherQuery(terms: string[]) {
  if (terms.some((term) => WEATHER_TERMS.has(term))) return true;
  return (
    terms.some((term) => AMBIGUOUS_WEATHER_TERMS.has(term)) &&
    terms.some((term) => WEATHER_TIME_TERMS.has(term))
  );
}

function buildWeatherSnippet(weather: CachedWeatherSnapshot, terms: string[]) {
  const day = selectRequestedDay(weather, terms);
  if (day) return formatDayForecast(day.day, day.label);
  return `Current: ${formatCurrentForecast(weather.forecast)}. Cached ${weather.freshness}${
    weather.stale ? '; stale but available offline' : ''
  }.`;
}

function buildWeatherContext(weather: CachedWeatherSnapshot) {
  const forecast = weather.forecast;
  const lines = [
    `Cached weather forecast for ${weather.location}.`,
    `Provider: ${weather.provider}.`,
    `Cached: ${new Date(weather.fetchedAt).toISOString()} (${weather.freshness}).`,
    `Status: ${weather.stale ? 'stale but available offline' : 'fresh'}.`,
    `Current: ${formatCurrentForecast(forecast)}.`,
  ];

  if (forecast.daily.length) {
    lines.push(
      '',
      'Daily forecast:',
      ...forecast.daily
        .slice(0, 8)
        .map((day, index) => formatDayForecast(day, dailyLabel(day.date, index)))
    );
  }

  if (forecast.hourly.length) {
    lines.push(
      '',
      'Next hours:',
      ...forecast.hourly.slice(0, 12).map((hour) => formatHourForecast(hour))
    );
  }

  return lines.join('\n');
}

function selectRequestedDay(weather: CachedWeatherSnapshot, terms: string[]) {
  const requestedIndex = terms.some((term) => TOMORROW_TERMS.has(term))
    ? 1
    : terms.some((term) => TODAY_TERMS.has(term))
      ? 0
      : -1;
  const day = weather.forecast.daily[requestedIndex];
  return day ? { day, label: dailyLabel(day.date, requestedIndex) } : null;
}

function dailyLabel(date: string, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return date;
}

function formatCurrentForecast(forecast: CachedWeatherSnapshot['forecast']) {
  return [
    forecast.summary || forecast.conditionLabel,
    formatNumber('temperature', forecast.temperatureC, 'C'),
    formatNumber('feels like', forecast.apparentTemperatureC, 'C'),
    formatNumber('humidity', forecast.humidityPct, '%'),
    formatNumber('wind', forecast.windKph, 'km/h'),
    formatNumber('gusts', forecast.windGustKph, 'km/h'),
    formatNumber('pressure', forecast.pressureHpa, 'hPa'),
    formatNumber('precipitation', forecast.precipitationMm, 'mm'),
    formatNumber('cloud cover', forecast.cloudCoverPct, '%'),
    `${forecast.confidencePct}% confidence`,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatDayForecast(day: CachedWeatherDay, label: string) {
  return `${label}: ${[
    day.label,
    formatRange(day.lowC, day.highC, 'C'),
    formatNumber('precipitation chance', day.precipitationProbabilityPct, '%'),
    formatNumber('precipitation', day.precipitationMm, 'mm'),
    formatNumber('wind', day.windKph, 'km/h'),
    formatNumber('gusts', day.gustKph, 'km/h'),
    `${day.confidencePct}% confidence`,
  ]
    .filter(Boolean)
    .join(', ')}.`;
}

function formatHourForecast(hour: CachedWeatherHour) {
  return `${hour.time}: ${[
    formatNumber('temperature', hour.temperatureC, 'C'),
    formatNumber('precipitation chance', hour.precipitationProbabilityPct, '%'),
    formatNumber('precipitation', hour.precipitationMm, 'mm'),
    formatNumber('wind', hour.windKph, 'km/h'),
    formatNumber('pressure', hour.pressureHpa, 'hPa'),
  ]
    .filter(Boolean)
    .join(', ')}.`;
}

function formatRange(low: number | null, high: number | null, unit: string) {
  if (low === null && high === null) return null;
  if (low === null) return `high ${formatValue(high, unit)}`;
  if (high === null) return `low ${formatValue(low, unit)}`;
  return `${formatValue(low, unit)}-${formatValue(high, unit)}`;
}

function formatNumber(label: string, value: number | null, unit: string) {
  if (value === null) return null;
  return `${label} ${formatValue(value, unit)}`;
}

function formatValue(value: number | null, unit: string) {
  if (value === null) return '';
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}${unit}`;
}
