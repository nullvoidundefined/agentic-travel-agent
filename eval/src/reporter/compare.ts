import { readFileSync } from 'fs';

import type { EvalReport } from '../types.js';

const REGRESSION_THRESHOLD = 0.1;

export function compareReports(
  current: EvalReport,
  baselinePath: string,
): void {
  const baselineJson = readFileSync(baselinePath, 'utf-8');
  const baseline = JSON.parse(baselineJson) as EvalReport;

  console.log('');
  console.log('\u256d' + '\u2500'.repeat(50) + '\u256e');
  console.log('\u2502  Regression Comparison' + ' '.repeat(28) + '\u2502');
  console.log('\u2570' + '\u2500'.repeat(50) + '\u256f');
  console.log('');

  const overallDiff = current.summary.overall - baseline.summary.overall;
  const overallFlag =
    overallDiff < -REGRESSION_THRESHOLD ? ' \u26a0\ufe0f REGRESSION' : '';
  console.log(
    `Overall: ${baseline.summary.overall.toFixed(2)} \u2192 ${current.summary.overall.toFixed(2)} (${overallDiff >= 0 ? '+' : ''}${overallDiff.toFixed(2)})${overallFlag}`,
  );
  console.log('');

  const baselineByArchetype = new Map<string, number[]>();
  for (const p of baseline.personas) {
    const scores = baselineByArchetype.get(p.archetype) ?? [];
    scores.push(p.overall);
    baselineByArchetype.set(p.archetype, scores);
  }

  const currentByArchetype = new Map<string, number[]>();
  for (const p of current.personas) {
    const scores = currentByArchetype.get(p.archetype) ?? [];
    scores.push(p.overall);
    currentByArchetype.set(p.archetype, scores);
  }

  const allArchetypes = new Set([
    ...baselineByArchetype.keys(),
    ...currentByArchetype.keys(),
  ]);

  for (const archetype of allArchetypes) {
    const baseScores = baselineByArchetype.get(archetype) ?? [];
    const currScores = currentByArchetype.get(archetype) ?? [];
    const baseAvg =
      baseScores.length > 0
        ? baseScores.reduce((a, b) => a + b, 0) / baseScores.length
        : 0;
    const currAvg =
      currScores.length > 0
        ? currScores.reduce((a, b) => a + b, 0) / currScores.length
        : 0;
    const diff = currAvg - baseAvg;
    const flag = diff < -REGRESSION_THRESHOLD ? ' \u26a0\ufe0f REGRESSION' : '';
    console.log(
      `  ${archetype.replace(/_/g, ' ').padEnd(20)} ${baseAvg.toFixed(2)} \u2192 ${currAvg.toFixed(2)} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})${flag}`,
    );
  }

  console.log('');
}
