export interface TripContext {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number;
  budget_currency: string;
  travelers: number;
  transport_mode: 'flying' | 'driving' | null;
  preferences: {
    style?: string;
    pace?: string;
    interests?: string[];
  };
  user_preferences?: {
    accommodation: string | null;
    travel_pace: string | null;
    dietary: string[];
    dining_style: string | null;
    activities: string[];
    travel_party: string | null;
    budget_comfort: string | null;
    lgbtq_safety?: boolean;
    gender?: string | null;
  };
  selected_flights: Array<{
    airline: string;
    flight_number: string;
    price: number;
    departure_time: string;
    arrival_time: string;
  }>;
  selected_hotels: Array<{
    name: string;
    price_per_night: number;
    total_price: number;
    star_rating: number;
  }>;
  selected_car_rentals: Array<{
    provider: string;
    car_name: string;
    car_type: string;
    price_per_day: number;
    total_price: number;
  }>;
  selected_experiences: Array<{
    name: string;
    estimated_cost: number;
    category: string;
  }>;
  total_spent: number;
}

export function formatTripContext(ctx: TripContext): string {
  const lines: string[] = [];

  lines.push('## Current Trip Plan');
  lines.push(`- **Destination:** ${ctx.destination}`);
  if (ctx.origin) lines.push(`- **Origin:** ${ctx.origin}`);
  if (ctx.departure_date) lines.push(`- **Departure:** ${ctx.departure_date}`);
  if (ctx.return_date) lines.push(`- **Return:** ${ctx.return_date}`);
  if (ctx.budget_total > 0) {
    lines.push(`- **Budget:** ${ctx.budget_currency} ${ctx.budget_total}`);
  }
  lines.push(`- **Travelers:** ${ctx.travelers}`);
  if (ctx.transport_mode) lines.push(`- **Transport:** ${ctx.transport_mode}`);

  if (
    ctx.preferences.style ||
    ctx.preferences.pace ||
    ctx.preferences.interests?.length
  ) {
    lines.push('\n### Preferences');
    if (ctx.preferences.style) lines.push(`- Style: ${ctx.preferences.style}`);
    if (ctx.preferences.pace) lines.push(`- Pace: ${ctx.preferences.pace}`);
    if (ctx.preferences.interests?.length) {
      lines.push(`- Interests: ${ctx.preferences.interests.join(', ')}`);
    }
  }

  if (ctx.user_preferences) {
    const up = ctx.user_preferences;
    lines.push('\n### User Preferences');
    if (up.accommodation) lines.push(`- Accommodation: ${up.accommodation}`);
    if (up.travel_pace) lines.push(`- Travel pace: ${up.travel_pace}`);
    if (
      up.dietary.length > 0 &&
      !(up.dietary.length === 1 && up.dietary[0] === 'none')
    ) {
      lines.push(`- Dietary: ${up.dietary.join(', ')}`);
    }
    if (up.dining_style) lines.push(`- Dining style: ${up.dining_style}`);
    if (up.activities.length > 0)
      lines.push(`- Activities: ${up.activities.join(', ')}`);
    if (up.travel_party) lines.push(`- Travel party: ${up.travel_party}`);
    if (up.budget_comfort) lines.push(`- Budget comfort: ${up.budget_comfort}`);
  }

  // Safety-aware prompt injections
  if (ctx.user_preferences) {
    const up = ctx.user_preferences;
    const safetyLines: string[] = [];

    if (up.lgbtq_safety) {
      safetyLines.push(
        "The user has opted into LGBTQ+ travel safety information. If the destination's travel advisories mention laws or attitudes affecting LGBTQ+ travelers, proactively surface this information. Be factual and helpful — mention specific risks without being preachy.",
      );
    }

    if (up.gender === 'woman' || up.gender === 'non_binary') {
      const identity = up.gender === 'woman' ? 'a woman' : 'non-binary';
      safetyLines.push(
        `The user identifies as ${identity}. If the destination has advisories mentioning restrictions or safety concerns for women or gender non-conforming travelers (dress codes, solo travel restrictions, harassment risks), proactively surface this information.`,
      );
    }

    if (up.travel_party === 'solo') {
      safetyLines.push(
        'The user is traveling solo. If relevant advisories exist for this destination, mention general solo travel safety tips.',
      );
    }

    if (safetyLines.length > 0) {
      lines.push('\n### Safety Context');
      for (const line of safetyLines) {
        lines.push(`- ${line}`);
      }
    }
  }

  if (ctx.selected_flights.length > 0) {
    lines.push('\n### Selected Flights');
    for (const f of ctx.selected_flights) {
      lines.push(
        `- ${f.airline} ${f.flight_number}: $${f.price} (${f.departure_time} → ${f.arrival_time})`,
      );
    }
  }

  if (ctx.selected_hotels.length > 0) {
    lines.push('\n### Selected Hotels');
    for (const h of ctx.selected_hotels) {
      lines.push(
        `- ${h.name}: $${h.price_per_night}/night ($${h.total_price} total), ${h.star_rating}★`,
      );
    }
  }

  if (ctx.selected_car_rentals.length > 0) {
    lines.push('\n### Selected Car Rentals');
    for (const car of ctx.selected_car_rentals) {
      lines.push(
        `- ${car.car_name} from ${car.provider}: $${car.total_price} ($${car.price_per_day}/day)`,
      );
    }
  }

  if (ctx.selected_experiences.length > 0) {
    lines.push('\n### Selected Experiences');
    for (const e of ctx.selected_experiences) {
      lines.push(`- ${e.name} (${e.category}): ~$${e.estimated_cost}`);
    }
  }

  if (ctx.budget_total > 0) {
    const remaining = ctx.budget_total - ctx.total_spent;
    lines.push(`\n### Budget Status`);
    lines.push(`- Spent: $${ctx.total_spent} / $${ctx.budget_total}`);
    lines.push(`- Remaining: $${remaining}`);
  }

  return lines.join('\n');
}
