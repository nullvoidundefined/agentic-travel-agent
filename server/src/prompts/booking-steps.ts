// --- Types ---

export type CategoryName = 'flights' | 'hotels' | 'car_rental' | 'experiences';

export type TrackerStatus = 'pending' | 'searching' | 'selected' | 'skipped';

export interface CompletionTracker {
  version: number;
  transport: 'pending' | 'flying' | 'driving';
  flights: TrackerStatus;
  hotels: TrackerStatus;
  car_rental: TrackerStatus;
  experiences: TrackerStatus;
  turns_since_last_progress: number;
}

export const CURRENT_TRACKER_VERSION = 2;

export const DEFAULT_COMPLETION_TRACKER: CompletionTracker = {
  version: CURRENT_TRACKER_VERSION,
  transport: 'pending',
  flights: 'pending',
  hotels: 'pending',
  car_rental: 'pending',
  experiences: 'pending',
  turns_since_last_progress: 0,
};

export const SEARCH_TOOLS: Record<CategoryName, string> = {
  flights: 'search_flights',
  hotels: 'search_hotels',
  car_rental: 'search_car_rentals',
  experiences: 'search_experiences',
};

export const SELECTION_KEYS: Record<
  CategoryName,
  'flights' | 'hotels' | 'car_rentals' | 'experiences'
> = {
  flights: 'flights',
  hotels: 'hotels',
  car_rental: 'car_rentals',
  experiences: 'experiences',
};

const SELECT_TOOLS: Record<string, CategoryName> = {
  select_flight: 'flights',
  select_hotel: 'hotels',
  select_car_rental: 'car_rental',
  select_experience: 'experiences',
};

// --- v1 → v2 migration helpers ---

const V1_STATUS_MAP: Record<string, TrackerStatus> = {
  idle: 'pending',
  asking: 'pending',
  presented: 'searching',
  done: 'selected',
  skipped: 'skipped',
};

function migrateV1Status(v1Category: unknown): TrackerStatus {
  if (typeof v1Category === 'object' && v1Category !== null) {
    const status = (v1Category as Record<string, unknown>).status;
    if (typeof status === 'string' && status in V1_STATUS_MAP) {
      return V1_STATUS_MAP[
        status as keyof typeof V1_STATUS_MAP
      ] as TrackerStatus;
    }
  }
  return 'pending';
}

// --- Normalization ---

const VALID_TRACKER_STATUSES: TrackerStatus[] = [
  'pending',
  'searching',
  'selected',
  'skipped',
];

const VALID_TRANSPORT = ['pending', 'flying', 'driving'];

export function normalizeCompletionTracker(raw: unknown): CompletionTracker {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_COMPLETION_TRACKER };
  }

  const obj = raw as Record<string, unknown>;

  // v1 migration: BookingState with { status: 'idle' } objects
  if (!('version' in obj) || (obj.version as number) < 2) {
    return {
      version: CURRENT_TRACKER_VERSION,
      transport: 'pending',
      flights: migrateV1Status(obj.flights),
      hotels: migrateV1Status(obj.hotels),
      car_rental: migrateV1Status(obj.car_rental),
      experiences: migrateV1Status(obj.experiences),
      turns_since_last_progress: 0,
    };
  }

  // v2: current format — fill missing fields
  const validStatus = (val: unknown): TrackerStatus =>
    typeof val === 'string' &&
    VALID_TRACKER_STATUSES.includes(val as TrackerStatus)
      ? (val as TrackerStatus)
      : 'pending';

  return {
    version: CURRENT_TRACKER_VERSION,
    transport: VALID_TRANSPORT.includes(obj.transport as string)
      ? (obj.transport as CompletionTracker['transport'])
      : 'pending',
    flights: validStatus(obj.flights),
    hotels: validStatus(obj.hotels),
    car_rental: validStatus(obj.car_rental),
    experiences: validStatus(obj.experiences),
    turns_since_last_progress:
      typeof obj.turns_since_last_progress === 'number'
        ? obj.turns_since_last_progress
        : 0,
  };
}

// --- Flow position ---

export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'PLANNING' }
  | { phase: 'COMPLETE' };

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  trip_type?: 'round_trip' | 'one_way';
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

export function getFlowPosition(
  trip: TripState,
  _legacyBookingState?: unknown,
): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  const needsReturnDate = trip.trip_type !== 'one_way';
  if (
    trip.departure_date === null ||
    (needsReturnDate && trip.return_date === null) ||
    trip.origin === null
  ) {
    return { phase: 'COLLECT_DETAILS' };
  }

  return { phase: 'PLANNING' };
}

// --- Tracker update ---

interface AgentResultForTracker {
  tool_calls: Array<{ tool_name: string }>;
  formatResponse?: { skip_category?: CategoryName | boolean } | null;
}

const CATEGORIES: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];

export function updateCompletionTracker(
  tracker: CompletionTracker,
  agentResult: AgentResultForTracker,
  updatedTrip: TripState,
): CompletionTracker {
  const newTracker = { ...tracker };
  let changed = false;

  // 1. Transport mode
  if (updatedTrip.transport_mode && newTracker.transport === 'pending') {
    newTracker.transport = updatedTrip.transport_mode;
    changed = true;
    if (
      updatedTrip.transport_mode === 'driving' &&
      newTracker.flights === 'pending'
    ) {
      newTracker.flights = 'skipped';
    }
  }

  // 2. Search tools → searching
  for (const cat of CATEGORIES) {
    const searchTool = SEARCH_TOOLS[cat];
    if (agentResult.tool_calls.some((tc) => tc.tool_name === searchTool)) {
      if (newTracker[cat] !== 'selected') {
        newTracker[cat] = 'searching';
        changed = true;
      }
    }
  }

  // 3. Select tools + trip record → selected
  for (const [toolName, cat] of Object.entries(SELECT_TOOLS)) {
    if (agentResult.tool_calls.some((tc) => tc.tool_name === toolName)) {
      const selKey = SELECTION_KEYS[cat];
      const selections =
        selKey === 'car_rentals'
          ? (updatedTrip.car_rentals ?? [])
          : updatedTrip[selKey];
      if (selections.length > 0) {
        newTracker[cat] = 'selected';
        changed = true;
      }
    }
  }

  // 4. Ground truth: trip record selections override tracker
  for (const cat of CATEGORIES) {
    const selKey = SELECTION_KEYS[cat];
    const selections =
      selKey === 'car_rentals'
        ? (updatedTrip.car_rentals ?? [])
        : updatedTrip[selKey];
    if (selections.length > 0 && newTracker[cat] !== 'selected') {
      newTracker[cat] = 'selected';
      changed = true;
    }
  }

  // 5. skip_category
  const skipCat = agentResult.formatResponse?.skip_category;
  if (
    typeof skipCat === 'string' &&
    CATEGORIES.includes(skipCat as CategoryName)
  ) {
    newTracker[skipCat as CategoryName] = 'skipped';
    changed = true;
  }

  // 6. Progress counter
  if (changed) {
    newTracker.turns_since_last_progress = 0;
  } else {
    newTracker.turns_since_last_progress =
      tracker.turns_since_last_progress + 1;
  }

  return newTracker;
}

// --- Nudge computation ---

export function computeNudge(tracker: CompletionTracker): string | null {
  if (tracker.turns_since_last_progress < 3) return null;

  const pending: string[] = [];
  for (const cat of CATEGORIES) {
    if (tracker[cat] === 'pending') {
      pending.push(cat.replace('_', ' '));
    }
  }

  if (pending.length === 0) return null;

  return `Note: you haven't discussed ${pending.join(', ')} with the user yet. Find a natural moment to bring this up.`;
}

// --- Empty itinerary check ---

export function hasAnySelection(tracker: CompletionTracker): boolean {
  return CATEGORIES.some((cat) => tracker[cat] === 'selected');
}

export function allCategoriesResolved(tracker: CompletionTracker): boolean {
  return CATEGORIES.every(
    (cat) => tracker[cat] === 'selected' || tracker[cat] === 'skipped',
  );
}
