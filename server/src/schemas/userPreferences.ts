// --- Option constants ---

export const ACCOMMODATION_OPTIONS = [
  {
    value: "budget",
    label: "Budget",
    description: "Hostels, budget hotels, basic stays",
  },
  {
    value: "mid-range",
    label: "Mid-Range",
    description: "3-star hotels, vacation rentals",
  },
  {
    value: "upscale",
    label: "Upscale",
    description: "4-5 star hotels, boutique properties",
  },
  {
    value: "unique",
    label: "Unique Stays",
    description: "Glamping, ryokans, treehouses, eco-lodges",
  },
] as const;

export const TRAVEL_PACE_OPTIONS = [
  {
    value: "relaxed",
    label: "Relaxed",
    description: "1-2 activities per day, plenty of downtime",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balanced mix of activity and rest",
  },
  {
    value: "packed",
    label: "Packed",
    description: "Early mornings, late nights, see everything",
  },
] as const;

export const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "none",
] as const;

export const DINING_STYLE_OPTIONS = [
  {
    value: "street-food",
    label: "Street Food",
    description: "Local markets, food stalls, cheap eats",
  },
  {
    value: "casual",
    label: "Casual Dining",
    description: "Local restaurants, cafes, bistros",
  },
  {
    value: "fine-dining",
    label: "Fine Dining",
    description: "Upscale restaurants, tasting menus",
  },
  {
    value: "food-tours",
    label: "Food Experiences",
    description: "Cooking classes, food tours, culinary adventures",
  },
] as const;

export const ACTIVITY_OPTIONS = [
  { value: "history-culture", label: "History & Culture" },
  { value: "nature-outdoors", label: "Nature & Outdoors" },
  { value: "beach-water-sports", label: "Beach & Water Sports" },
  { value: "nightlife", label: "Nightlife & Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "wellness-spa", label: "Wellness & Spa" },
  { value: "adventure-sports", label: "Adventure Sports" },
  { value: "art-museums", label: "Art & Museums" },
  { value: "photography", label: "Photography" },
  { value: "local-experiences", label: "Local Experiences" },
] as const;

export const TRAVEL_PARTY_OPTIONS = [
  { value: "solo", label: "Solo", description: "Traveling alone" },
  {
    value: "romantic-partner",
    label: "Romantic Partner",
    description: "Honeymoon, anniversary, romantic getaway",
  },
  {
    value: "friends",
    label: "Friends Group",
    description: "Social travel with friends",
  },
  {
    value: "family-with-kids",
    label: "Family with Kids",
    description: "Children under 12, kid-friendly focus",
  },
  {
    value: "family-adults",
    label: "Family / Adults",
    description: "Adult family members, no kid constraints",
  },
] as const;

export const BUDGET_COMFORT_OPTIONS = [
  {
    value: "budget-conscious",
    label: "Budget-Conscious",
    description: "Cheapest options first",
  },
  {
    value: "value-seeker",
    label: "Value Seeker",
    description: "Best bang for the buck",
  },
  {
    value: "comfort-first",
    label: "Comfort First",
    description: "Willing to pay more for convenience",
  },
  {
    value: "no-concerns",
    label: "No Budget Concerns",
    description: "Show me the best",
  },
] as const;

// --- Wizard steps ---

export const WIZARD_STEPS = [
  { id: "accommodation", label: "Accommodation" },
  { id: "travel_pace", label: "Travel Pace" },
  { id: "dining", label: "Dining" },
  { id: "activities", label: "Activities" },
  { id: "travel_party", label: "Travel Party" },
  { id: "budget_comfort", label: "Budget" },
] as const;

// --- Types ---

export interface UserPreferences {
  schema_version: number;
  accommodation: "budget" | "mid-range" | "upscale" | "unique" | null;
  travel_pace: "relaxed" | "moderate" | "packed" | null;
  dietary: string[];
  dining_style: "street-food" | "casual" | "fine-dining" | "food-tours" | null;
  activities: string[];
  travel_party:
    | "solo"
    | "romantic-partner"
    | "friends"
    | "family-with-kids"
    | "family-adults"
    | null;
  budget_comfort:
    | "budget-conscious"
    | "value-seeker"
    | "comfort-first"
    | "no-concerns"
    | null;
  completed_steps: string[];
  lgbtq_safety: boolean;
  gender: "prefer_not_to_say" | "woman" | "man" | "non_binary" | null;
}

export const CURRENT_PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: UserPreferences = {
  schema_version: CURRENT_PREFERENCES_VERSION,
  accommodation: null,
  travel_pace: null,
  dietary: [],
  dining_style: null,
  activities: [],
  travel_party: null,
  budget_comfort: null,
  completed_steps: [],
  lgbtq_safety: false,
  gender: null,
};

// --- Legacy value mapping ---

const LEGACY_SOCIAL_MAP: Record<string, string> = {
  couple: "romantic-partner",
  group: "friends",
  family: "family-with-kids",
  solo: "solo",
};

// --- Normalize ---

export function normalizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PREFERENCES };
  }

  const data = raw as Record<string, unknown>;

  // v0: legacy format with intensity/social (no version field)
  if (!("version" in data)) {
    return {
      ...DEFAULT_PREFERENCES,
      dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
      travel_pace:
        typeof data.intensity === "string"
          ? (data.intensity as UserPreferences["travel_pace"])
          : null,
      travel_party:
        typeof data.social === "string"
          ? ((LEGACY_SOCIAL_MAP[
              data.social
            ] as UserPreferences["travel_party"]) ?? null)
          : null,
    };
  }

  // v1: current format — fill missing fields with defaults
  return {
    schema_version: CURRENT_PREFERENCES_VERSION,
    accommodation:
      (data.accommodation as UserPreferences["accommodation"]) ?? null,
    travel_pace: (data.travel_pace as UserPreferences["travel_pace"]) ?? null,
    dietary: Array.isArray(data.dietary) ? (data.dietary as string[]) : [],
    dining_style:
      (data.dining_style as UserPreferences["dining_style"]) ?? null,
    activities: Array.isArray(data.activities)
      ? (data.activities as string[])
      : [],
    travel_party:
      (data.travel_party as UserPreferences["travel_party"]) ?? null,
    budget_comfort:
      (data.budget_comfort as UserPreferences["budget_comfort"]) ?? null,
    completed_steps: Array.isArray(data.completed_steps)
      ? (data.completed_steps as string[])
      : [],
    lgbtq_safety: data.lgbtq_safety === true,
    gender: (data.gender as UserPreferences["gender"]) ?? null,
  };
}
