import type { ChatNode } from '@agentic-travel-agent/shared-types';

// Simplified visa requirement lookup
// In production, this would load from the passport-index CSV dataset
const VISA_FREE: Record<string, string[]> = {
  US: [
    'GB',
    'FR',
    'DE',
    'IT',
    'ES',
    'PT',
    'GR',
    'JP',
    'KR',
    'SG',
    'AU',
    'NZ',
    'MX',
    'CR',
    'AE',
    'TR',
  ],
  GB: [
    'US',
    'FR',
    'DE',
    'IT',
    'ES',
    'PT',
    'GR',
    'JP',
    'KR',
    'SG',
    'AU',
    'NZ',
    'MX',
    'CR',
    'AE',
    'TR',
  ],
};

const VISA_ON_ARRIVAL: Record<string, string[]> = {
  US: ['TH', 'EG', 'PE'],
  GB: ['TH', 'EG', 'PE'],
};

export function getVisaRequirement(
  originCountry: string,
  destinationCountry: string,
): ChatNode | null {
  const origin = originCountry.toUpperCase();
  const dest = destinationCountry.toUpperCase();

  if (origin === dest) return null;

  const visaFree = VISA_FREE[origin] ?? [];
  const visaOnArrival = VISA_ON_ARRIVAL[origin] ?? [];

  if (visaFree.includes(dest)) {
    return {
      type: 'advisory',
      severity: 'info',
      title: 'Visa Not Required',
      body: `Citizens of ${origin} can enter visa-free for tourism (typically 90 days). Check specific duration limits before travel.`,
    };
  }

  if (visaOnArrival.includes(dest)) {
    return {
      type: 'advisory',
      severity: 'info',
      title: 'Visa on Arrival Available',
      body: `Citizens of ${origin} can obtain a visa on arrival. Fees and duration vary — check current requirements before departure.`,
    };
  }

  return {
    type: 'advisory',
    severity: 'warning',
    title: 'Visa Requirements — Check Before Travel',
    body: `Visa requirements vary by nationality. We have detailed data for US and UK travelers. For other nationalities, please check your country's foreign affairs website before traveling. (Direct visa verification coming in a future update.)`,
  };
}
