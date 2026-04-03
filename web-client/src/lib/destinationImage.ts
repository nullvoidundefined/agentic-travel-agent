// Static map of city names to Unsplash photo IDs.
// Only the ~30 curated cities are listed — others get the gradient fallback.
const CITY_IMAGES: Record<string, string> = {
  tokyo: '1579992420740-537be2a3de31',
  paris: '1459455356093-6495cff2a2c4',
  'new york': '1500289483460-00bdb46204f9',
  london: '1448056975861-28196f26abd6',
  barcelona: '1510781768709-d1bfe138cf3b',
  rome: '1586421746416-1a96255a5ecb',
  sydney: '1513343987712-5da15ea2a9bb',
  dubai: '1518684079-3c830dcef090',
  singapore: '1517188206596-1e1f7c954177',
  seoul: '1570192134376-8ba4c3e8ffa1',
  lisbon: '1484437732853-cc855bf85a49',
  istanbul: '1594707014495-1f553e9d0a8c',
  bangkok: '1510377971269-d723c13cc478',
  'cape town': '1520513455472-b259f1ec720a',
  amsterdam: '1523889310790-cb91a98b017b',
  prague: '1568477193171-2cd07447c83b',
  vienna: '1680454469315-5778f0c91674',
  budapest: '1523168786345-2724a464d87e',
  'rio de janeiro': '1483729558449-99ef09a8c325',
  bali: '1576019206484-54273acdfa89',
  santorini: '1504752509934-8b4044d2135f',
  kyoto: '1569040584961-83a30d5ad8ff',
  marrakech: '1517531991679-1e0625207aa1',
  reykjavik: '1484619701999-76d79bbc51d1',
  dubrovnik: '1506098992531-b41d84746bb6',
  'mexico city': '1514060967642-aa09f273f887',
  lima: '1491613993002-8956ec08fddc',
  mumbai: '1531589767116-64a48779e523',
  auckland: '1534551039924-409372dd29c3',
  havana: '1509239767605-0703ef611f08',
};

export function getDestinationImageUrl(
  unsplashId: string,
  width: number,
  height: number,
): string {
  return `https://images.unsplash.com/photo-${unsplashId}?w=${width}&h=${height}&fit=crop&q=80`;
}

export function getDestinationImage(cityName: string): {
  url: string | null;
  unsplashId: string | null;
} {
  const key = cityName.toLowerCase().trim();
  const id = CITY_IMAGES[key] ?? null;
  return {
    url: id
      ? `https://images.unsplash.com/photo-${id}?w=800&h=400&fit=crop&q=80`
      : null,
    unsplashId: id,
  };
}

// Hero carousel images — 5 curated destinations
export const HERO_IMAGES = [
  { city: 'Santorini', id: CITY_IMAGES['santorini']! },
  { city: 'Tokyo', id: CITY_IMAGES['tokyo']! },
  { city: 'Paris', id: CITY_IMAGES['paris']! },
  { city: 'Bali', id: CITY_IMAGES['bali']! },
  { city: 'New York', id: CITY_IMAGES['new york']! },
];
