import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { fetchStateDeptAdvisory } from './enrichment-sources/state-dept.js';
import { fetchFCDOAdvisory } from './enrichment-sources/fcdo.js';
import { fetchWeatherForecast } from './enrichment-sources/open-meteo.js';
import { getDrivingRequirements } from './enrichment-sources/driving.js';
import { getVisaRequirement } from './enrichment-sources/visa-matrix.js';

// Coordinates for major destinations (subset — expand as needed)
const CITY_COORDS: Record<string, { lat: number; lon: number; country: string }> = {
  tokyo: { lat: 35.6762, lon: 139.6503, country: 'JP' },
  paris: { lat: 48.8566, lon: 2.3522, country: 'FR' },
  london: { lat: 51.5074, lon: -0.1278, country: 'GB' },
  'new york': { lat: 40.7128, lon: -74.006, country: 'US' },
  barcelona: { lat: 41.3874, lon: 2.1686, country: 'ES' },
  rome: { lat: 41.9028, lon: 12.4964, country: 'IT' },
  berlin: { lat: 52.52, lon: 13.405, country: 'DE' },
  bangkok: { lat: 13.7563, lon: 100.5018, country: 'TH' },
  sydney: { lat: -33.8688, lon: 151.2093, country: 'AU' },
  dubai: { lat: 25.2048, lon: 55.2708, country: 'AE' },
  singapore: { lat: 1.3521, lon: 103.8198, country: 'SG' },
  seoul: { lat: 37.5665, lon: 126.978, country: 'KR' },
  lisbon: { lat: 38.7223, lon: -9.1393, country: 'PT' },
  athens: { lat: 37.9838, lon: 23.7275, country: 'GR' },
  istanbul: { lat: 41.0082, lon: 28.9784, country: 'TR' },
  cairo: { lat: 30.0444, lon: 31.2357, country: 'EG' },
  'mexico city': { lat: 19.4326, lon: -99.1332, country: 'MX' },
  'sao paulo': { lat: -23.5505, lon: -46.6333, country: 'BR' },
  'cape town': { lat: -33.9249, lon: 18.4241, country: 'ZA' },
  auckland: { lat: -36.8485, lon: 174.7633, country: 'NZ' },
  'port moresby': { lat: -6.3149, lon: 147.1803, country: 'PG' },
  'san jose': { lat: 9.9281, lon: -84.0907, country: 'CR' },
  lima: { lat: -12.0464, lon: -77.0428, country: 'PE' },
  bogota: { lat: 4.711, lon: -74.0721, country: 'CO' },
  mumbai: { lat: 19.076, lon: 72.8777, country: 'IN' },
};

function lookupCity(
  destination: string,
): { lat: number; lon: number; country: string } | null {
  const key = destination.toLowerCase().trim();
  return CITY_COORDS[key] ?? null;
}

export async function getEnrichmentNodes(
  destination: string,
  originCountry?: string,
): Promise<ChatNode[]> {
  const city = lookupCity(destination);
  if (!city) return [];

  const enrichments = await Promise.allSettled([
    fetchStateDeptAdvisory(city.country),
    fetchFCDOAdvisory(city.country),
    fetchWeatherForecast(city.lat, city.lon),
    Promise.resolve(getDrivingRequirements(city.country)),
    Promise.resolve(
      originCountry ? getVisaRequirement(originCountry, city.country) : null,
    ),
  ]);

  const nodes: ChatNode[] = [];

  for (const result of enrichments) {
    if (result.status === 'fulfilled' && result.value) {
      if (Array.isArray(result.value)) {
        nodes.push(...result.value);
      } else {
        nodes.push(result.value);
      }
    }
  }

  return nodes;
}
