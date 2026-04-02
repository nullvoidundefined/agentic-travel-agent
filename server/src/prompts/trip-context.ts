export interface TripContext {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number;
  budget_currency: string;
  travelers: number;
  preferences: {
    style?: string;
    pace?: string;
    interests?: string[];
  };
  user_preferences?: {
    dietary: string[];
    intensity: string;
    social: string;
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
  lines.push(`- **Budget:** ${ctx.budget_currency} ${ctx.budget_total}`);
  lines.push(`- **Travelers:** ${ctx.travelers}`);

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
    if (
      up.dietary.length > 0 &&
      !(up.dietary.length === 1 && up.dietary[0] === 'none')
    ) {
      lines.push(`- Dietary: ${up.dietary.join(', ')}`);
    }
    lines.push(`- Travel intensity: ${up.intensity}`);
    lines.push(`- Traveling: ${up.social}`);
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

  const remaining = ctx.budget_total - ctx.total_spent;
  lines.push(`\n### Budget Status`);
  lines.push(`- Spent: $${ctx.total_spent} / $${ctx.budget_total}`);
  lines.push(`- Remaining: $${remaining}`);

  return lines.join('\n');
}
