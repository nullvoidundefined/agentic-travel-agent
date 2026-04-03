import type { ChatNode, WeatherDay } from '@agentic-travel-agent/shared-types';
import { cacheGet, cacheSet } from 'app/services/cache.service.js';

const CACHE_TTL = 21600; // 6 hours

const WEATHER_ICONS: Record<number, string> = {
  0: '\u2600\uFE0F', // Clear sky
  1: '\uD83C\uDF24\uFE0F', // Mainly clear
  2: '\u26C5', // Partly cloudy
  3: '\u2601\uFE0F', // Overcast
  45: '\uD83C\uDF2B\uFE0F', // Fog
  48: '\uD83C\uDF2B\uFE0F', // Depositing rime fog
  51: '\uD83C\uDF26\uFE0F', // Light drizzle
  53: '\uD83C\uDF26\uFE0F', // Moderate drizzle
  55: '\uD83C\uDF27\uFE0F', // Dense drizzle
  61: '\uD83C\uDF27\uFE0F', // Slight rain
  63: '\uD83C\uDF27\uFE0F', // Moderate rain
  65: '\uD83C\uDF27\uFE0F', // Heavy rain
  71: '\uD83C\uDF28\uFE0F', // Slight snow
  73: '\uD83C\uDF28\uFE0F', // Moderate snow
  75: '\uD83C\uDF28\uFE0F', // Heavy snow
  95: '\u26C8\uFE0F', // Thunderstorm
  96: '\u26C8\uFE0F', // Thunderstorm with hail
  99: '\u26C8\uFE0F', // Thunderstorm with heavy hail
};

const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Foggy',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Severe thunderstorm',
};

export async function fetchWeatherForecast(
  lat: number,
  lon: number,
): Promise<ChatNode | null> {
  const cacheKey = `enrichment:weather:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const cached = await cacheGet<ChatNode>(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily:
        'temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    const daily = data.daily as {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weathercode: number[];
      precipitation_probability_max: number[];
    };

    if (!daily?.time?.length) return null;

    const forecast: WeatherDay[] = daily.time.map((date: string, i: number) => {
      const code = daily.weathercode[i] ?? 0;
      const highC = daily.temperature_2m_max[i] ?? 0;
      const lowC = daily.temperature_2m_min[i] ?? 0;
      return {
        date,
        high_c: Math.round(highC),
        low_c: Math.round(lowC),
        high_f: Math.round((highC * 9) / 5 + 32),
        low_f: Math.round((lowC * 9) / 5 + 32),
        condition: WEATHER_LABELS[code] ?? 'Unknown',
        icon: WEATHER_ICONS[code] ?? '\u2601\uFE0F',
        precipitation_chance: daily.precipitation_probability_max[i] ?? 0,
      };
    });

    const node: ChatNode = { type: 'weather_forecast', forecast };
    await cacheSet(cacheKey, node, CACHE_TTL);
    return node;
  } catch {
    return null;
  }
}
