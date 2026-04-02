import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

interface DrivingRequirement {
  driving_side: string;
  idp_required: boolean;
  min_age: number;
  note?: string;
}

function loadDrivingData(): Record<string, DrivingRequirement> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataPath = join(__dirname, '../../data/driving-requirements.json');
  const raw = readFileSync(dataPath, 'utf-8');
  return JSON.parse(raw) as Record<string, DrivingRequirement>;
}

// Load once at module initialization
const drivingData = loadDrivingData();

export function getDrivingRequirements(countryCode: string): ChatNode | null {
  const data = drivingData[countryCode.toUpperCase()];
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
