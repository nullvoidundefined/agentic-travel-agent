// --- Minimal interface to avoid circular dependency with agent.service.ts ---

interface AgentResultForAdvance {
  tool_calls: Array<{ tool_name: string }>;
  formatResponse?: { skip_category?: boolean } | null;
}

// --- State types ---

export type CategoryName = 'flights' | 'hotels' | 'car_rental' | 'experiences';

export type CategoryStatus =
  | 'idle'
  | 'asking'
  | 'presented'
  | 'done'
  | 'skipped';

export interface CategoryState {
  status: CategoryStatus;
  meta?: Record<string, unknown>;
}

export interface BookingState {
  version: number;
  flights: CategoryState;
  hotels: CategoryState;
  car_rental: CategoryState;
  experiences: CategoryState;
}

export const CURRENT_BOOKING_STATE_VERSION = 1;

export const DEFAULT_BOOKING_STATE: BookingState = {
  version: 1,
  flights: { status: 'idle' },
  hotels: { status: 'idle' },
  car_rental: { status: 'idle' },
  experiences: { status: 'idle' },
};

// --- Versioned normalization ---

export function normalizeBookingState(raw: unknown): BookingState {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_BOOKING_STATE };
  }

  const obj = raw as Record<string, unknown>;

  // No version field → treat as v0 (pre-versioning), fill missing categories
  if (!('version' in obj) || obj.version === undefined) {
    return {
      version: CURRENT_BOOKING_STATE_VERSION,
      flights: isValidCategoryState(obj.flights)
        ? (obj.flights as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.flights },
      hotels: isValidCategoryState(obj.hotels)
        ? (obj.hotels as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.hotels },
      car_rental: isValidCategoryState(obj.car_rental)
        ? (obj.car_rental as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.car_rental },
      experiences: isValidCategoryState(obj.experiences)
        ? (obj.experiences as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.experiences },
    };
  }

  // Current version — return as-is with missing categories filled
  const version = obj.version as number;
  if (version >= CURRENT_BOOKING_STATE_VERSION) {
    return {
      version: CURRENT_BOOKING_STATE_VERSION,
      flights: isValidCategoryState(obj.flights)
        ? (obj.flights as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.flights },
      hotels: isValidCategoryState(obj.hotels)
        ? (obj.hotels as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.hotels },
      car_rental: isValidCategoryState(obj.car_rental)
        ? (obj.car_rental as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.car_rental },
      experiences: isValidCategoryState(obj.experiences)
        ? (obj.experiences as CategoryState)
        : { ...DEFAULT_BOOKING_STATE.experiences },
    };
  }

  // Future: run migration functions v0→v1, v1→v2, etc.
  // For now there's only v1, so any version < 1 gets default-filled
  return {
    version: CURRENT_BOOKING_STATE_VERSION,
    flights: isValidCategoryState(obj.flights)
      ? (obj.flights as CategoryState)
      : { ...DEFAULT_BOOKING_STATE.flights },
    hotels: isValidCategoryState(obj.hotels)
      ? (obj.hotels as CategoryState)
      : { ...DEFAULT_BOOKING_STATE.hotels },
    car_rental: isValidCategoryState(obj.car_rental)
      ? (obj.car_rental as CategoryState)
      : { ...DEFAULT_BOOKING_STATE.car_rental },
    experiences: isValidCategoryState(obj.experiences)
      ? (obj.experiences as CategoryState)
      : { ...DEFAULT_BOOKING_STATE.experiences },
  };
}

function isValidCategoryState(val: unknown): val is CategoryState {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  const validStatuses: CategoryStatus[] = [
    'idle',
    'asking',
    'presented',
    'done',
    'skipped',
  ];
  return (
    typeof obj.status === 'string' &&
    validStatuses.includes(obj.status as CategoryStatus)
  );
}

// --- Flow position ---

export type FlowPosition =
  | { phase: 'COLLECT_DETAILS' }
  | { phase: 'CATEGORY'; category: CategoryName; status: CategoryStatus }
  | { phase: 'CONFIRM' }
  | { phase: 'COMPLETE' };

export interface TripState {
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  transport_mode: 'flying' | 'driving' | null;
  flights: Array<{ id: string }>;
  hotels: Array<{ id: string }>;
  car_rentals?: Array<{ id: string }>;
  experiences: Array<{ id: string }>;
  status: string;
}

export const CATEGORY_ORDER: CategoryName[] = [
  'flights',
  'hotels',
  'car_rental',
  'experiences',
];

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

export function getFlowPosition(
  trip: TripState,
  bookingState: BookingState,
): FlowPosition {
  if (trip.status !== 'planning') {
    return { phase: 'COMPLETE' };
  }

  if (
    trip.budget_total === null ||
    trip.departure_date === null ||
    trip.return_date === null ||
    trip.origin === null
  ) {
    return { phase: 'COLLECT_DETAILS' };
  }

  // If transport_mode not set, flights category handles the flying/driving question
  if (trip.transport_mode === null) {
    return {
      phase: 'CATEGORY',
      category: 'flights',
      status: bookingState.flights.status,
    };
  }

  for (const cat of CATEGORY_ORDER) {
    // Auto-skip flights when driving
    if (cat === 'flights' && trip.transport_mode === 'driving') {
      continue;
    }

    const catState = bookingState[cat];
    if (catState.status !== 'done' && catState.status !== 'skipped') {
      return { phase: 'CATEGORY', category: cat, status: catState.status };
    }
  }

  return { phase: 'CONFIRM' };
}

// --- State transitions ---

export function advanceBookingState(
  bookingState: BookingState,
  category: CategoryName | string,
  currentStatus: CategoryStatus,
  agentResult: AgentResultForAdvance,
  updatedTrip: TripState,
): BookingState {
  const cat = category as CategoryName;
  const newState = structuredClone(bookingState);

  // Check if skip_category was set
  const skipCategory = agentResult.formatResponse?.skip_category === true;

  if (skipCategory) {
    newState[cat] = { ...newState[cat], status: 'skipped' };
    return newState;
  }

  const searchTool = SEARCH_TOOLS[cat];
  const searchCalled = agentResult.tool_calls.some(
    (tc) => tc.tool_name === searchTool,
  );
  const selectionKey = SELECTION_KEYS[cat];
  const tripSelections =
    selectionKey === 'car_rentals'
      ? (updatedTrip.car_rentals ?? [])
      : updatedTrip[selectionKey];
  const hasSelection = tripSelections.length > 0;

  switch (currentStatus) {
    case 'idle':
      newState[cat] = { ...newState[cat], status: 'asking' };
      break;

    case 'asking':
      if (searchCalled) {
        newState[cat] = { ...newState[cat], status: 'presented' };
      }
      break;

    case 'presented':
      if (hasSelection) {
        newState[cat] = { ...newState[cat], status: 'done' };
      }
      // If search called again (re-search), stay in presented
      break;

    default:
      break;
  }

  return newState;
}
