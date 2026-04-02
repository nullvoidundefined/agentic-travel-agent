import { cacheGet, cacheSet } from 'app/services/cache.service.js';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

const CACHE_TTL = 86400; // 24 hours

// Map country codes to GOV.UK slugs
const COUNTRY_SLUGS: Record<string, string> = {
  JP: 'japan',
  TH: 'thailand',
  FR: 'france',
  DE: 'germany',
  IT: 'italy',
  ES: 'spain',
  PT: 'portugal',
  GR: 'greece',
  TR: 'turkey',
  EG: 'egypt',
  ZA: 'south-africa',
  AU: 'australia',
  NZ: 'new-zealand',
  IN: 'india',
  KR: 'south-korea',
  SG: 'singapore',
  AE: 'united-arab-emirates',
  MX: 'mexico',
  BR: 'brazil',
  CR: 'costa-rica',
  PE: 'peru',
  CO: 'colombia',
  PG: 'papua-new-guinea',
  US: 'usa',
  GB: 'uk',
};

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
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
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
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
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
          body: body.length > 500 ? body.slice(0, 497) + '...' : body,
        });
      }
    }

    await cacheSet(cacheKey, nodes, CACHE_TTL);
    return nodes;
  } catch {
    return [];
  }
}
