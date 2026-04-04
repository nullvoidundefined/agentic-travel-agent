import Anthropic from '@anthropic-ai/sdk';

import type { JudgeScores, Persona, TranscriptEntry } from '../types.js';

const anthropic = new Anthropic();

const JUDGE_PROMPT = `You are an expert evaluator assessing the quality of a travel planning AI agent. You will be given a customer persona and a conversation transcript.

Score the agent on each dimension from 0.0 to 1.0 (one decimal place). Provide a one-sentence justification for each.

## Dimensions

1. **task_completion** (0.0-1.0): Did the agent address the customer's goals? Collect details, search, help select?
2. **efficiency** (0.0-1.0): Did it work without unnecessary back-and-forth or repeated questions?
3. **relevance** (0.0-1.0): Were suggestions relevant to budget, preferences, and travel style?
4. **tone** (0.0-1.0): Natural, concise, helpful? Not robotic, verbose, or generic?
5. **error_recovery** (0.0-1.0): How well did it handle unexpected inputs or edge cases?

Respond in this exact JSON format (no markdown, no code fences):
{"task_completion":{"score":0.0,"justification":"..."},"efficiency":{"score":0.0,"justification":"..."},"relevance":{"score":0.0,"justification":"..."},"tone":{"score":0.0,"justification":"..."},"error_recovery":{"score":0.0,"justification":"..."}}`;

export async function runJudge(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<JudgeScores> {
  const budgetStr = persona.budget ? `$${persona.budget}` : 'no budget set';

  const personaDesc = `Customer: ${persona.name}
Archetype: ${persona.archetype}
Destination: ${persona.destination}, from ${persona.origin}
Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
Budget: ${budgetStr}
Travelers: ${persona.travelers} (${persona.travel_party})
Style: ${persona.communication_style}
Goals:
${persona.goals.map((g) => `- ${g}`).join('\n')}
Constraints: ${persona.constraints}`;

  const transcriptStr = transcript
    .map(
      (t) =>
        `[${t.role.toUpperCase()}]: ${t.content}${t.tool_calls?.length ? ` (tools: ${t.tool_calls.join(', ')})` : ''}`,
    )
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: JUDGE_PROMPT,
    messages: [
      {
        role: 'user',
        content: `## Customer Persona\n\n${personaDesc}\n\n## Conversation Transcript\n\n${transcriptStr}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '{}';

  try {
    return JSON.parse(text) as JudgeScores;
  } catch {
    const defaultScore = {
      score: 0.5,
      justification: 'Judge output could not be parsed',
    };
    return {
      task_completion: defaultScore,
      efficiency: defaultScore,
      relevance: defaultScore,
      tone: defaultScore,
      error_recovery: defaultScore,
    };
  }
}

export function computeJudgeScore(scores: JudgeScores): number {
  const values = [
    scores.task_completion.score,
    scores.efficiency.score,
    scores.relevance.score,
    scores.tone.score,
    scores.error_recovery.score,
  ];
  return (
    Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) /
    100
  );
}
