import type { EvalReport } from '../types.js';

export function printCliReport(report: EvalReport): void {
  const { summary, personas } = report;
  const totalSecs = Math.round(report.duration_ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  console.log('');
  console.log('\u256d' + '\u2500'.repeat(62) + '\u256e');
  console.log(
    `\u2502  Voyager Eval Report \u2014 ${report.timestamp.split('T')[0]}` +
      ' '.repeat(Math.max(0, 39 - report.timestamp.split('T')[0]!.length)) +
      '\u2502',
  );
  console.log(
    `\u2502  ${summary.personas} personas \u00b7 ${summary.turns} turns \u00b7 ${timeStr}` +
      ' '.repeat(
        Math.max(
          0,
          47 -
            String(summary.personas).length -
            String(summary.turns).length -
            timeStr.length,
        ),
      ) +
      '\u2502',
  );
  console.log('\u2570' + '\u2500'.repeat(62) + '\u256f');
  console.log('');

  const header =
    'Archetype          Persona                    Overall  Task  Effic  Rel   Tone  Recov  Turns';
  console.log(header);
  console.log('\u2500'.repeat(header.length));

  for (const p of personas) {
    const archetype = p.archetype.replace(/_/g, ' ').padEnd(18);
    const name = p.name.slice(0, 26).padEnd(26);
    const overall = p.overall.toFixed(2).padStart(5);
    const task = p.judge_scores.task_completion.score.toFixed(2).padStart(5);
    const effic = p.judge_scores.efficiency.score.toFixed(2).padStart(5);
    const rel = p.judge_scores.relevance.score.toFixed(2).padStart(5);
    const tone = p.judge_scores.tone.score.toFixed(2).padStart(5);
    const recov = p.judge_scores.error_recovery.score.toFixed(2).padStart(5);
    const turns = String(p.turns).padStart(5);

    console.log(
      `${archetype} ${name} ${overall}  ${task}  ${effic} ${rel}  ${tone}  ${recov}  ${turns}`,
    );
  }

  console.log('\u2500'.repeat(header.length));
  console.log(`${'OVERALL'.padEnd(46)} ${summary.overall.toFixed(2)}`);
  console.log('');
  console.log(
    `Assertions: ${summary.assertions_passed}/${summary.assertions_total} passed`,
  );
  console.log('');
}
