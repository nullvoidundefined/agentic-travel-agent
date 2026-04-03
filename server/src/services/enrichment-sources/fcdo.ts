import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { cacheGet, cacheSet } from 'app/services/cache.service.js';

const CACHE_TTL = 86400; // 24 hours

// Map country codes to GOV.UK slugs
const COUNTRY_SLUGS: Record<string, string> = {
  // North America
  US: 'usa',
  CA: 'canada',
  MX: 'mexico',
  GT: 'guatemala',
  BZ: 'belize',
  HN: 'honduras',
  SV: 'el-salvador',
  NI: 'nicaragua',
  CR: 'costa-rica',
  PA: 'panama',
  // Caribbean
  CU: 'cuba',
  JM: 'jamaica',
  HT: 'haiti',
  DO: 'dominican-republic',
  BB: 'barbados',
  TT: 'trinidad-and-tobago',
  BS: 'the-bahamas',
  LC: 'st-lucia',
  VC: 'st-vincent-and-the-grenadines',
  AG: 'antigua-and-barbuda',
  GD: 'grenada',
  KN: 'st-kitts-and-nevis',
  // South America
  BR: 'brazil',
  AR: 'argentina',
  CL: 'chile',
  PE: 'peru',
  CO: 'colombia',
  VE: 'venezuela',
  EC: 'ecuador',
  BO: 'bolivia',
  PY: 'paraguay',
  UY: 'uruguay',
  GY: 'guyana',
  SR: 'suriname',
  // Western Europe
  GB: 'uk',
  IE: 'ireland',
  FR: 'france',
  DE: 'germany',
  IT: 'italy',
  ES: 'spain',
  PT: 'portugal',
  NL: 'the-netherlands',
  BE: 'belgium',
  CH: 'switzerland',
  AT: 'austria',
  SE: 'sweden',
  NO: 'norway',
  DK: 'denmark',
  FI: 'finland',
  IS: 'iceland',
  LU: 'luxembourg',
  MT: 'malta',
  CY: 'cyprus',
  // Eastern Europe & Balkans
  PL: 'poland',
  CZ: 'czech-republic',
  SK: 'slovakia',
  HU: 'hungary',
  RO: 'romania',
  BG: 'bulgaria',
  HR: 'croatia',
  SI: 'slovenia',
  RS: 'serbia',
  BA: 'bosnia-and-herzegovina',
  ME: 'montenegro',
  MK: 'north-macedonia',
  AL: 'albania',
  GR: 'greece',
  TR: 'turkey',
  UA: 'ukraine',
  MD: 'moldova',
  EE: 'estonia',
  LV: 'latvia',
  LT: 'lithuania',
  // Middle East
  AE: 'united-arab-emirates',
  SA: 'saudi-arabia',
  QA: 'qatar',
  KW: 'kuwait',
  BH: 'bahrain',
  OM: 'oman',
  JO: 'jordan',
  IL: 'israel',
  LB: 'lebanon',
  IQ: 'iraq',
  IR: 'iran',
  // Central & South Asia
  GE: 'georgia',
  AM: 'armenia',
  AZ: 'azerbaijan',
  KZ: 'kazakhstan',
  UZ: 'uzbekistan',
  KG: 'kyrgyzstan',
  TJ: 'tajikistan',
  IN: 'india',
  PK: 'pakistan',
  BD: 'bangladesh',
  LK: 'sri-lanka',
  NP: 'nepal',
  BT: 'bhutan',
  MV: 'maldives',
  // East & Southeast Asia
  JP: 'japan',
  CN: 'china',
  HK: 'hong-kong',
  TW: 'taiwan',
  KR: 'south-korea',
  MN: 'mongolia',
  VN: 'vietnam',
  TH: 'thailand',
  KH: 'cambodia',
  LA: 'laos',
  MM: 'myanmar',
  MY: 'malaysia',
  SG: 'singapore',
  ID: 'indonesia',
  PH: 'the-philippines',
  BN: 'brunei',
  TL: 'timor-leste',
  // Oceania
  AU: 'australia',
  NZ: 'new-zealand',
  FJ: 'fiji',
  PG: 'papua-new-guinea',
  SB: 'solomon-islands',
  VU: 'vanuatu',
  WS: 'samoa',
  TO: 'tonga',
  // North Africa
  EG: 'egypt',
  MA: 'morocco',
  TN: 'tunisia',
  DZ: 'algeria',
  LY: 'libya',
  // Sub-Saharan Africa
  ZA: 'south-africa',
  NG: 'nigeria',
  KE: 'kenya',
  TZ: 'tanzania',
  ET: 'ethiopia',
  GH: 'ghana',
  UG: 'uganda',
  SN: 'senegal',
  CI: 'cote-divoire',
  CM: 'cameroon',
  MZ: 'mozambique',
  ZM: 'zambia',
  ZW: 'zimbabwe',
  BW: 'botswana',
  NA: 'namibia',
  RW: 'rwanda',
  MW: 'malawi',
  MG: 'madagascar',
  AO: 'angola',
  MU: 'mauritius',
  SC: 'seychelles',
  CV: 'cape-verde',
  // Russia & CIS
  RU: 'russia',
  BY: 'belarus',
};

function truncate(text: string, maxLen = 500): string {
  return text.length > maxLen ? text.slice(0, maxLen - 3) + '...' : text;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchFCDOAdvisory(
  countryCode: string,
): Promise<ChatNode[]> {
  const slug = COUNTRY_SLUGS[countryCode.toUpperCase()];
  if (!slug) return [];

  const cacheKey = `enrichment:fcdo:${countryCode}`;
  const cached = await cacheGet<ChatNode[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const parts = (data.details?.parts ?? []) as Array<{
      title: string;
      body: string;
    }>;

    const nodes: ChatNode[] = [];

    // Extract entry requirements (includes visa info)
    const entryReqs = parts.find((p) =>
      p.title.toLowerCase().includes('entry requirements'),
    );
    if (entryReqs) {
      const body = stripHtml(entryReqs.body);
      if (body.length > 0) {
        nodes.push({
          type: 'advisory',
          severity: 'info',
          title: 'Entry & Visa Requirements',
          body: truncate(body),
        });
      }
    }

    // Extract health section (includes vaccination info)
    const health = parts.find((p) => p.title.toLowerCase().includes('health'));
    if (health) {
      const body = stripHtml(health.body);
      if (body.length > 0) {
        nodes.push({
          type: 'advisory',
          severity: 'info',
          title: 'Health & Vaccination Info',
          body: truncate(body),
        });
      }
    }

    // Extract safety/security warnings
    const safety = parts.find(
      (p) =>
        p.title.toLowerCase().includes('safety') ||
        p.title.toLowerCase().includes('warnings'),
    );
    if (safety) {
      const body = stripHtml(safety.body);
      if (body.length > 0) {
        const hasDanger =
          body.toLowerCase().includes('do not travel') ||
          body.toLowerCase().includes('advise against');
        nodes.push({
          type: 'advisory',
          severity: hasDanger ? 'warning' : 'info',
          title: 'Safety & Security',
          body: truncate(body),
        });
      }
    }

    await cacheSet(cacheKey, nodes, CACHE_TTL);
    return nodes;
  } catch {
    return [];
  }
}
