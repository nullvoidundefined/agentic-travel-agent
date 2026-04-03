import type { ChatNode } from '@agentic-travel-agent/shared-types';

import { lookupCity } from '../data/cities.js';
import { getDrivingRequirements } from './enrichment-sources/driving.js';
import { fetchFCDOAdvisory } from './enrichment-sources/fcdo.js';
import { fetchWeatherForecast } from './enrichment-sources/open-meteo.js';
import { fetchStateDeptAdvisory } from './enrichment-sources/state-dept.js';
import { getVisaRequirement } from './enrichment-sources/visa-matrix.js';

export async function getEnrichmentNodes(
  destination: string,
  originCountry?: string,
): Promise<ChatNode[]> {
  const city = lookupCity(destination);
  if (!city) return [];

  // Synchronous sources — compute before the async fan-out
  const drivingNode = getDrivingRequirements(city.country_code);
  const visaNode = originCountry
    ? getVisaRequirement(originCountry, city.country_code)
    : null;

  const asyncResults = await Promise.allSettled([
    fetchStateDeptAdvisory(city.country_code),
    fetchFCDOAdvisory(city.country_code),
    fetchWeatherForecast(city.lat, city.lon),
  ]);

  const nodes: ChatNode[] = [];

  for (const result of asyncResults) {
    if (result.status === 'fulfilled' && result.value) {
      if (Array.isArray(result.value)) {
        nodes.push(...result.value);
      } else {
        nodes.push(result.value);
      }
    }
  }

  if (drivingNode) nodes.push(drivingNode);
  if (visaNode) nodes.push(visaNode);

  return nodes;
}
