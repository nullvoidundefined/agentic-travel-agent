import Anthropic from '@anthropic-ai/sdk';

import type { Persona, TranscriptEntry } from '../types.js';

const anthropic = new Anthropic();

function buildCustomerPrompt(persona: Persona): string {
  const budgetStr = persona.budget
    ? `$${persona.budget}`
    : 'no specific budget';
  const styleGuide: Record<string, string> = {
    detailed:
      'You provide all information upfront in complete sentences. You are cooperative and thorough.',
    terse:
      'You give short, minimal answers. One word or one sentence max. Make the agent work for information.',
    conversational:
      'You chat naturally, share some details, ask questions back. Normal human conversation.',
    impatient:
      'You want things done fast. Skip categories you don\'t care about. Say "just skip that" for things you don\'t need.',
  };

  return `You are a customer planning a trip. Stay in character throughout.

## Your Profile
- Destination: ${persona.destination}
- Origin: ${persona.origin}
- Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
- Budget: ${budgetStr}
- Travelers: ${persona.travelers}
- Travel party: ${persona.travel_party}

## Your Goals
${persona.goals.map((g) => `- ${g}`).join('\n')}

## Communication Style
${styleGuide[persona.communication_style] ?? styleGuide.conversational}

## Rules
- Never mention that you are an AI or a test persona.
- Respond naturally as a real customer would.
- If the agent asks a question you have the answer to, provide it in your style.
- If the agent shows you options (flights, hotels, etc.), pick one that matches your goals or ask for different options.
- When you feel the conversation has accomplished your goals (or you've given up), respond with exactly: DONE
- Do not say DONE until at least 2 categories have been addressed (selected or skipped).`;
}

export async function getCustomerResponse(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<string> {
  const messages = transcript.map((t) => ({
    role: t.role as 'user' | 'assistant',
    content: t.content,
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: buildCustomerPrompt(persona),
    messages,
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  return text.trim();
}
