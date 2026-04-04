import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { EvalReport } from '../types.js';

export function writeJsonReport(report: EvalReport, outputDir: string): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = report.timestamp
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  const filename = `${timestamp}.json`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Report saved to ${filepath}`);
  return filepath;
}
