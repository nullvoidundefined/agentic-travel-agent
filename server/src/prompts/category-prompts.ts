import type { CategoryName, CategoryStatus } from './booking-steps.js';

const SHARED_RULES = `
## Rules
- 1-2 sentences max. No numbered lists. No bullet points for questions.
- NEVER describe search results in text — the cards handle it.
- Travel questions: answer in 1-2 sentences, then redirect to the current step.
- Call update_trip when the user provides trip details.
- Always call format_response as your LAST tool call.
- Set skip_category: true in format_response if the user declines this category.
- Max 15 tool calls per turn.`;

const CATEGORY_PROMPTS: Record<CategoryName, Record<string, string>> = {
  flights: {
    idle: `You are a travel assistant. Ask the user one question: "Will you be flying or driving?"
If flying, call update_trip with transport_mode: "flying". If driving, call update_trip with transport_mode: "driving" and set skip_category: true.
Provide quick_replies: ["I'll be flying", "I'll drive"].`,

    asking: `The user is flying. Ask what time of day they prefer (morning, afternoon, or evening). Then search flights. The flight cards will show — do not describe them.`,

    presented: `The user is browsing flight options. Do NOT re-describe the results — the cards are visible. If they ask about a flight, answer briefly. If they want different options, search again. Wait for their selection.`,
  },

  hotels: {
    idle: `Ask: "Do you need a hotel?" If yes, search hotels. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

    asking: `Ask: "Do you need a hotel?" If yes, search hotels. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a hotel", "No, I have lodging"].`,

    presented: `The user is browsing hotel options. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection.`,
  },

  car_rental: {
    idle: `Ask: "Will you need a rental car?" If yes, search car rentals. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a car", "No, I don't need one"].`,

    asking: `Ask: "Will you need a rental car?" If yes, search car rentals. If no, acknowledge and set skip_category: true in format_response.
Provide quick_replies: ["Yes, find me a car", "No, I don't need one"].`,

    presented: `The user is browsing car rental options. Don't describe the results — the cards are visible. Answer questions briefly. Wait for their selection.`,
  },

  experiences: {
    idle: `Based on the user's preferences, suggest relevant experience categories in one sentence. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

    asking: `Based on the user's preferences, suggest relevant experience categories in one sentence. Then search experiences. The cards will show the results.
Provide quick_replies: ["Find dining options", "Show me adventures", "I'm all set"].`,

    presented: `The user is browsing experiences. Do not describe the results — the cards are visible. Answer questions briefly. Wait for their selection. If they say they're done, set skip_category: true.`,
  },
};

const PHASE_PROMPTS: Record<string, string> = {
  COLLECT_DETAILS: `A form is being shown to collect trip details. Acknowledge the destination in one friendly sentence. Do NOT ask questions — the form handles data collection.`,

  CONFIRM: `Summarize the trip briefly: destination, dates, selected flight, hotel, car rental, experiences, total cost. Ask "Ready to book?" Provide quick_replies: ["Confirm booking", "Make changes"].`,

  COMPLETE: `The trip is booked. Answer follow-up questions about the trip.`,
};

export function getCategoryPrompt(
  category: CategoryName,
  status: CategoryStatus,
  preferences?: {
    accommodation?: string | null;
    travel_pace?: string | null;
    dietary?: string[];
    dining_style?: string | null;
    activities?: string[] | null;
    travel_party?: string | null;
    budget_comfort?: string | null;
  },
): string {
  const prompts = CATEGORY_PROMPTS[category];
  const key =
    status === 'idle' ? 'idle' : status === 'asking' ? 'asking' : 'presented';
  let prompt = prompts[key] ?? prompts['asking'];

  if (status !== 'presented') {
    if (category === 'hotels' && preferences?.accommodation) {
      prompt += `\nUser prefers ${preferences.accommodation} accommodation.`;
    }

    if (category === 'experiences') {
      if (preferences?.activities?.length) {
        prompt += `\nUser interests: ${preferences.activities.join(', ')}.`;
      }
      if (preferences?.dining_style) {
        prompt += `\nDining preference: ${preferences.dining_style}.`;
      }
    }

    if (preferences?.travel_party) {
      prompt += `\nTraveling as: ${preferences.travel_party}.`;
    }
  }

  return `You are a travel planning assistant.\n\n## Your Task\n${prompt}\n${SHARED_RULES}`;
}

export function getPhasePrompt(
  phase: 'COLLECT_DETAILS' | 'CONFIRM' | 'COMPLETE',
): string {
  return `You are a travel planning assistant.\n\n## Your Task\n${PHASE_PROMPTS[phase]}\n${SHARED_RULES}`;
}
