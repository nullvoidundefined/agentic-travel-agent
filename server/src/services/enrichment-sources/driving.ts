import type { ChatNode } from '@agentic-travel-agent/shared-types';

interface DrivingRequirement {
  driving_side: string;
  idp_required: boolean;
  min_age: number;
  note?: string;
}

const DRIVING_DATA: Record<string, DrivingRequirement> = {
  // North America
  US: { driving_side: 'right', idp_required: false, min_age: 16 },
  CA: { driving_side: 'right', idp_required: false, min_age: 16 },
  MX: { driving_side: 'right', idp_required: false, min_age: 18 },
  GT: { driving_side: 'right', idp_required: true, min_age: 18 },
  BZ: { driving_side: 'right', idp_required: true, min_age: 18 },
  HN: { driving_side: 'right', idp_required: true, min_age: 18 },
  SV: { driving_side: 'right', idp_required: true, min_age: 18 },
  NI: { driving_side: 'right', idp_required: true, min_age: 18 },
  CR: { driving_side: 'right', idp_required: false, min_age: 18 },
  PA: { driving_side: 'right', idp_required: true, min_age: 18 },

  // Caribbean
  CU: { driving_side: 'right', idp_required: true, min_age: 18 },
  JM: { driving_side: 'left', idp_required: true, min_age: 18 },
  HT: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Road conditions are extremely poor and security situation is dangerous. Self-driving is not recommended.',
  },
  DO: { driving_side: 'right', idp_required: true, min_age: 18 },
  PR: { driving_side: 'right', idp_required: false, min_age: 16 },
  BB: {
    driving_side: 'left',
    idp_required: false,
    min_age: 18,
    note: 'A local Barbados driving permit is required alongside your foreign license, available from police stations.',
  },
  TT: { driving_side: 'left', idp_required: true, min_age: 17 },
  BS: { driving_side: 'left', idp_required: true, min_age: 17 },
  BM: {
    driving_side: 'left',
    idp_required: false,
    min_age: 18,
    note: 'Rental cars are not available in Bermuda. Visitors may hire mopeds or taxis only.',
  },
  LC: {
    driving_side: 'left',
    idp_required: false,
    min_age: 18,
    note: 'A temporary St. Lucia driving permit (obtainable on arrival) is required alongside your foreign license.',
  },
  VC: { driving_side: 'left', idp_required: false, min_age: 17 },
  AG: {
    driving_side: 'left',
    idp_required: false,
    min_age: 17,
    note: 'A local Antigua driving permit is required, available from police stations.',
  },
  KN: { driving_side: 'left', idp_required: false, min_age: 18 },
  GD: { driving_side: 'left', idp_required: false, min_age: 17 },

  // South America
  BR: { driving_side: 'right', idp_required: true, min_age: 18 },
  AR: { driving_side: 'right', idp_required: true, min_age: 18 },
  CL: { driving_side: 'right', idp_required: true, min_age: 18 },
  PE: { driving_side: 'right', idp_required: true, min_age: 18 },
  CO: { driving_side: 'right', idp_required: true, min_age: 18 },
  VE: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'The security situation is dangerous. Self-driving outside major cities is not recommended.',
  },
  EC: { driving_side: 'right', idp_required: true, min_age: 18 },
  BO: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Road conditions are hazardous in highland areas. The Death Road (North Yungas Road) is extremely dangerous.',
  },
  PY: { driving_side: 'right', idp_required: true, min_age: 18 },
  UY: { driving_side: 'right', idp_required: true, min_age: 18 },
  GY: { driving_side: 'left', idp_required: true, min_age: 18 },
  SR: { driving_side: 'left', idp_required: true, min_age: 18 },

  // Western Europe
  GB: { driving_side: 'left', idp_required: false, min_age: 17 },
  IE: { driving_side: 'left', idp_required: false, min_age: 17 },
  FR: { driving_side: 'right', idp_required: false, min_age: 18 },
  DE: { driving_side: 'right', idp_required: false, min_age: 18 },
  IT: { driving_side: 'right', idp_required: false, min_age: 18 },
  ES: { driving_side: 'right', idp_required: false, min_age: 18 },
  PT: { driving_side: 'right', idp_required: false, min_age: 18 },
  NL: { driving_side: 'right', idp_required: false, min_age: 18 },
  BE: { driving_side: 'right', idp_required: false, min_age: 18 },
  CH: { driving_side: 'right', idp_required: false, min_age: 18 },
  AT: { driving_side: 'right', idp_required: false, min_age: 18 },
  SE: { driving_side: 'right', idp_required: false, min_age: 18 },
  NO: { driving_side: 'right', idp_required: false, min_age: 18 },
  DK: { driving_side: 'right', idp_required: false, min_age: 18 },
  FI: { driving_side: 'right', idp_required: false, min_age: 18 },
  IS: { driving_side: 'right', idp_required: false, min_age: 17 },
  LU: { driving_side: 'right', idp_required: false, min_age: 18 },
  MC: { driving_side: 'right', idp_required: false, min_age: 18 },
  LI: { driving_side: 'right', idp_required: false, min_age: 18 },
  MT: { driving_side: 'left', idp_required: false, min_age: 18 },
  CY: { driving_side: 'left', idp_required: false, min_age: 18 },

  // Eastern Europe
  PL: { driving_side: 'right', idp_required: false, min_age: 18 },
  CZ: { driving_side: 'right', idp_required: false, min_age: 18 },
  SK: { driving_side: 'right', idp_required: false, min_age: 18 },
  HU: { driving_side: 'right', idp_required: false, min_age: 17 },
  RO: { driving_side: 'right', idp_required: false, min_age: 18 },
  BG: { driving_side: 'right', idp_required: false, min_age: 18 },
  HR: { driving_side: 'right', idp_required: false, min_age: 18 },
  SI: { driving_side: 'right', idp_required: false, min_age: 18 },
  RS: { driving_side: 'right', idp_required: true, min_age: 18 },
  BA: { driving_side: 'right', idp_required: true, min_age: 18 },
  ME: { driving_side: 'right', idp_required: true, min_age: 18 },
  MK: { driving_side: 'right', idp_required: true, min_age: 18 },
  AL: { driving_side: 'right', idp_required: true, min_age: 18 },
  GR: { driving_side: 'right', idp_required: true, min_age: 18 },
  TR: { driving_side: 'right', idp_required: false, min_age: 18 },
  UA: { driving_side: 'right', idp_required: true, min_age: 18 },
  MD: { driving_side: 'right', idp_required: true, min_age: 18 },
  EE: { driving_side: 'right', idp_required: false, min_age: 18 },
  LV: { driving_side: 'right', idp_required: false, min_age: 18 },
  LT: { driving_side: 'right', idp_required: false, min_age: 18 },

  // Middle East
  AE: { driving_side: 'right', idp_required: true, min_age: 18 },
  SA: { driving_side: 'right', idp_required: true, min_age: 18 },
  QA: { driving_side: 'right', idp_required: true, min_age: 18 },
  KW: { driving_side: 'right', idp_required: true, min_age: 18 },
  BH: { driving_side: 'right', idp_required: true, min_age: 18 },
  OM: { driving_side: 'right', idp_required: true, min_age: 18 },
  JO: { driving_side: 'right', idp_required: true, min_age: 18 },
  IL: { driving_side: 'right', idp_required: false, min_age: 18 },
  LB: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Road conditions and security situation vary. Exercise caution especially near border regions.',
  },
  IQ: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Most governments advise against all travel to Iraq. Self-driving is strongly discouraged.',
  },
  IR: { driving_side: 'right', idp_required: true, min_age: 18 },
  YE: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Most governments advise against all travel to Yemen due to ongoing conflict.',
  },

  // Central Asia
  KZ: { driving_side: 'right', idp_required: true, min_age: 18 },
  UZ: { driving_side: 'right', idp_required: true, min_age: 18 },
  KG: { driving_side: 'right', idp_required: true, min_age: 18 },
  TJ: { driving_side: 'right', idp_required: true, min_age: 18 },
  TM: { driving_side: 'right', idp_required: true, min_age: 18 },
  GE: { driving_side: 'right', idp_required: true, min_age: 18 },
  AM: { driving_side: 'right', idp_required: true, min_age: 18 },
  AZ: { driving_side: 'right', idp_required: true, min_age: 18 },

  // South Asia
  IN: { driving_side: 'left', idp_required: true, min_age: 18 },
  PK: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Road conditions are poor in many areas. Traffic laws are loosely enforced.',
  },
  BD: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Traffic conditions in Dhaka are extremely congested. Self-driving is not recommended for visitors.',
  },
  LK: { driving_side: 'left', idp_required: true, min_age: 18 },
  NP: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Mountain roads can be extremely narrow and dangerous, especially in monsoon season.',
  },
  BT: { driving_side: 'left', idp_required: true, min_age: 18 },
  MV: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Most visitors travel between islands by boat. Road networks are very limited.',
  },

  // East & Southeast Asia
  JP: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Japan only accepts IDPs issued under the 1949 Geneva Convention. US and UK IDPs are valid.',
  },
  CN: {
    driving_side: 'right',
    idp_required: false,
    min_age: 18,
    note: 'Foreign licenses are not valid in China. Tourists cannot legally drive. A Chinese license is required.',
  },
  HK: { driving_side: 'left', idp_required: false, min_age: 18 },
  MO: { driving_side: 'left', idp_required: false, min_age: 18 },
  TW: { driving_side: 'right', idp_required: true, min_age: 18 },
  KR: { driving_side: 'right', idp_required: true, min_age: 18 },
  KP: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Tourism is extremely restricted. Self-driving by foreign nationals is not permitted.',
  },
  MN: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Most roads outside Ulaanbaatar are unpaved. Off-road driving experience is highly recommended.',
  },
  VN: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Traffic conditions are chaotic. Self-driving is challenging; guided tours or rental scooters are more common.',
  },
  TH: { driving_side: 'left', idp_required: true, min_age: 18 },
  KH: { driving_side: 'right', idp_required: true, min_age: 18 },
  LA: { driving_side: 'right', idp_required: true, min_age: 18 },
  MM: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Despite historical left-hand traffic patterns, Myanmar switched to right-hand traffic in 1970. Many vehicles remain right-hand drive.',
  },
  MY: { driving_side: 'left', idp_required: true, min_age: 17 },
  SG: { driving_side: 'left', idp_required: true, min_age: 18 },
  ID: {
    driving_side: 'left',
    idp_required: true,
    min_age: 17,
    note: 'Traffic conditions in Jakarta and Bali are extremely congested. Scooter rentals are very common in Bali.',
  },
  PH: { driving_side: 'right', idp_required: true, min_age: 17 },
  BN: { driving_side: 'left', idp_required: true, min_age: 17 },
  TL: { driving_side: 'left', idp_required: true, min_age: 18 },

  // Oceania
  AU: { driving_side: 'left', idp_required: true, min_age: 18 },
  NZ: { driving_side: 'left', idp_required: true, min_age: 16 },
  FJ: { driving_side: 'left', idp_required: true, min_age: 18 },
  PG: {
    driving_side: 'left',
    idp_required: true,
    min_age: 18,
    note: 'Driving outside major cities is extremely dangerous. Road conditions are poor and carjacking is common.',
  },
  SB: { driving_side: 'left', idp_required: true, min_age: 18 },
  VU: { driving_side: 'right', idp_required: true, min_age: 18 },
  WS: { driving_side: 'left', idp_required: true, min_age: 18 },
  TO: { driving_side: 'left', idp_required: true, min_age: 18 },
  CK: {
    driving_side: 'left',
    idp_required: false,
    min_age: 21,
    note: 'A Cook Islands driving license is required. It can be obtained on arrival from the police.',
  },

  // North Africa
  EG: { driving_side: 'right', idp_required: true, min_age: 18 },
  MA: { driving_side: 'right', idp_required: true, min_age: 18 },
  TN: { driving_side: 'right', idp_required: true, min_age: 18 },
  DZ: { driving_side: 'right', idp_required: true, min_age: 19 },
  LY: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Most governments advise against all travel to Libya due to ongoing conflict.',
  },

  // Sub-Saharan Africa
  ZA: { driving_side: 'left', idp_required: true, min_age: 18 },
  NG: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Road conditions are poor and traffic laws are loosely enforced. Carjacking is a risk on major highways.',
  },
  KE: { driving_side: 'left', idp_required: true, min_age: 18 },
  TZ: { driving_side: 'left', idp_required: true, min_age: 18 },
  ET: { driving_side: 'right', idp_required: true, min_age: 18 },
  GH: { driving_side: 'right', idp_required: true, min_age: 18 },
  UG: { driving_side: 'left', idp_required: true, min_age: 18 },
  SN: { driving_side: 'right', idp_required: true, min_age: 18 },
  CI: { driving_side: 'right', idp_required: true, min_age: 18 },
  CM: { driving_side: 'right', idp_required: true, min_age: 18 },
  MZ: { driving_side: 'left', idp_required: true, min_age: 18 },
  ZM: { driving_side: 'left', idp_required: true, min_age: 18 },
  ZW: { driving_side: 'left', idp_required: true, min_age: 18 },
  BW: { driving_side: 'left', idp_required: true, min_age: 18 },
  NA: { driving_side: 'left', idp_required: true, min_age: 18 },
  RW: { driving_side: 'right', idp_required: true, min_age: 18 },
  MW: { driving_side: 'left', idp_required: true, min_age: 18 },
  MG: { driving_side: 'right', idp_required: true, min_age: 18 },
  AO: { driving_side: 'right', idp_required: true, min_age: 18 },
  MU: { driving_side: 'left', idp_required: true, min_age: 18 },
  SC: { driving_side: 'left', idp_required: true, min_age: 18 },
  CV: { driving_side: 'right', idp_required: true, min_age: 18 },
  SD: { driving_side: 'right', idp_required: true, min_age: 18 },
  SS: {
    driving_side: 'right',
    idp_required: true,
    min_age: 18,
    note: 'Most governments advise against all travel to South Sudan due to ongoing instability.',
  },

  // Russia & CIS
  RU: { driving_side: 'right', idp_required: true, min_age: 18 },
  BY: { driving_side: 'right', idp_required: true, min_age: 18 },
};

export function getDrivingRequirements(countryCode: string): ChatNode | null {
  const data = DRIVING_DATA[countryCode.toUpperCase()];
  if (!data) return null;

  const parts: string[] = [];
  parts.push(`Drives on the **${data.driving_side}** side of the road.`);

  if (data.idp_required) {
    parts.push(
      'An **International Driving Permit (IDP)** is required to rent and drive a car.',
    );
  } else {
    parts.push(
      "A valid foreign driver's license is accepted (no IDP required).",
    );
  }

  parts.push(`Minimum driving age: ${data.min_age}.`);

  if (data.note) {
    parts.push(data.note);
  }

  return {
    type: 'advisory',
    severity: 'info',
    title: 'Driving Requirements',
    body: parts.join(' '),
  };
}
