import { describe, expect, it } from 'vitest';

import {
  type BookingState,
  CURRENT_BOOKING_STATE_VERSION,
  DEFAULT_BOOKING_STATE,
  type TripState,
  advanceBookingState,
  getFlowPosition,
  normalizeBookingState,
} from './booking-steps.js';

// Helper to build a trip state
function trip(overrides: Record<string, unknown> = {}): TripState {
  return {
    destination: 'Tokyo',
    origin: 'JFK',
    departure_date: '2026-07-01',
    return_date: '2026-07-10',
    budget_total: 5000,
    transport_mode: null as 'flying' | 'driving' | null,
    flights: [] as Array<{ id: string }>,
    hotels: [] as Array<{ id: string }>,
    car_rentals: [] as Array<{ id: string }>,
    experiences: [] as Array<{ id: string }>,
    status: 'planning',
    ...overrides,
  };
}

function bs(overrides: Partial<BookingState> = {}): BookingState {
  return { ...DEFAULT_BOOKING_STATE, ...overrides };
}

// Minimal mock matching AgentResultForAdvance shape
function mockResult(toolNames: string[] = [], skipCategory = false) {
  return {
    tool_calls: toolNames.map((name) => ({ tool_name: name })),
    formatResponse: skipCategory ? { skip_category: true } : null,
  };
}

describe('normalizeBookingState', () => {
  it('returns DEFAULT_BOOKING_STATE for null input', () => {
    const result = normalizeBookingState(null);
    expect(result).toEqual(DEFAULT_BOOKING_STATE);
  });

  it('returns DEFAULT_BOOKING_STATE for undefined input', () => {
    const result = normalizeBookingState(undefined);
    expect(result).toEqual(DEFAULT_BOOKING_STATE);
  });

  it('adds version field to v0 data (no version)', () => {
    const v0 = {
      flights: { status: 'done' },
      hotels: { status: 'asking' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    };
    const result = normalizeBookingState(v0);
    expect(result.version).toBe(CURRENT_BOOKING_STATE_VERSION);
    expect(result.flights.status).toBe('done');
    expect(result.hotels.status).toBe('asking');
  });

  it('fills missing categories from defaults for v0 data', () => {
    const v0 = {
      flights: { status: 'done' },
    };
    const result = normalizeBookingState(v0);
    expect(result.version).toBe(CURRENT_BOOKING_STATE_VERSION);
    expect(result.flights.status).toBe('done');
    expect(result.hotels.status).toBe('idle');
    expect(result.car_rental.status).toBe('idle');
    expect(result.experiences.status).toBe('idle');
  });

  it('passes through current version data', () => {
    const current: BookingState = {
      version: 1,
      flights: { status: 'presented' },
      hotels: { status: 'done' },
      car_rental: { status: 'skipped' },
      experiences: { status: 'asking' },
    };
    const result = normalizeBookingState(current);
    expect(result).toEqual(current);
  });

  it('fills missing categories even at current version', () => {
    const partial = {
      version: 1,
      flights: { status: 'done' },
    };
    const result = normalizeBookingState(partial);
    expect(result.version).toBe(1);
    expect(result.flights.status).toBe('done');
    expect(result.hotels.status).toBe('idle');
    expect(result.car_rental.status).toBe('idle');
    expect(result.experiences.status).toBe('idle');
  });

  it('handles invalid category state by using default', () => {
    const bad = {
      version: 1,
      flights: 'not-an-object',
      hotels: { status: 'done' },
      car_rental: { status: 'idle' },
      experiences: { status: 'idle' },
    };
    const result = normalizeBookingState(bad);
    expect(result.flights.status).toBe('idle');
    expect(result.hotels.status).toBe('done');
  });
});

describe('getFlowPosition', () => {
  it('returns COLLECT_DETAILS when budget is missing', () => {
    const pos = getFlowPosition(trip({ budget_total: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns COLLECT_DETAILS when origin is missing', () => {
    const pos = getFlowPosition(trip({ origin: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns COLLECT_DETAILS when departure_date is missing', () => {
    const pos = getFlowPosition(trip({ departure_date: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns COLLECT_DETAILS when return_date is missing', () => {
    const pos = getFlowPosition(trip({ return_date: null }), bs());
    expect(pos).toEqual({ phase: 'COLLECT_DETAILS' });
  });

  it('returns flights/idle when transport_mode is null', () => {
    const pos = getFlowPosition(trip(), bs());
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'idle',
    });
  });

  it('returns flights with its current status from booking_state', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying' }),
      bs({ flights: { status: 'asking' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'asking',
    });
  });

  it('returns flights/presented when browsing', () => {
    const pos = getFlowPosition(
      trip({ transport_mode: 'flying' }),
      bs({ flights: { status: 'presented' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'flights',
      status: 'presented',
    });
  });

  it('skips flights when driving, goes to hotels', () => {
    const pos = getFlowPosition(trip({ transport_mode: 'driving' }), bs());
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'hotels',
      status: 'idle',
    });
  });

  it('returns hotels when flights are done', () => {
    const pos = getFlowPosition(
      trip({
        transport_mode: 'flying',
        flights: [{ id: '1' }],
      }),
      bs({ flights: { status: 'done' } }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'hotels',
      status: 'idle',
    });
  });

  it('returns car_rental when hotels are done', () => {
    const pos = getFlowPosition(
      trip({
        transport_mode: 'flying',
        flights: [{ id: '1' }],
      }),
      bs({
        flights: { status: 'done' },
        hotels: { status: 'done' },
      }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'car_rental',
      status: 'idle',
    });
  });

  it('skips a category that is skipped', () => {
    const pos = getFlowPosition(
      trip({
        transport_mode: 'flying',
        flights: [{ id: '1' }],
      }),
      bs({
        flights: { status: 'done' },
        hotels: { status: 'skipped' },
      }),
    );
    expect(pos).toEqual({
      phase: 'CATEGORY',
      category: 'car_rental',
      status: 'idle',
    });
  });

  it('returns CONFIRM when all categories done/skipped', () => {
    const pos = getFlowPosition(
      trip({
        transport_mode: 'flying',
        flights: [{ id: '1' }],
      }),
      bs({
        flights: { status: 'done' },
        hotels: { status: 'done' },
        car_rental: { status: 'skipped' },
        experiences: { status: 'done' },
      }),
    );
    expect(pos).toEqual({ phase: 'CONFIRM' });
  });

  it('returns COMPLETE when status is not planning', () => {
    const pos = getFlowPosition(trip({ status: 'saved' }), bs());
    expect(pos).toEqual({ phase: 'COMPLETE' });
  });
});

describe('advanceBookingState', () => {
  it('advances idle → asking', () => {
    const result = advanceBookingState(
      bs(),
      'flights',
      'idle',
      mockResult(),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('asking');
  });

  it('advances asking → presented when search tool is called', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'asking' } }),
      'flights',
      'asking',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('advances asking → skipped when skip_category is true', () => {
    const result = advanceBookingState(
      bs({ hotels: { status: 'asking' } }),
      'hotels',
      'asking',
      mockResult([], true),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.hotels.status).toBe('skipped');
  });

  it('advances presented → done when trip gains a selection', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(),
      trip({
        transport_mode: 'flying',
        flights: [{ id: '1' }],
      }),
    );
    expect(result.flights.status).toBe('done');
  });

  it('stays presented when no selection made', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('re-search: presented → presented when search tool called again', () => {
    const result = advanceBookingState(
      bs({ flights: { status: 'presented' } }),
      'flights',
      'presented',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.flights.status).toBe('presented');
  });

  it('does not mutate other categories', () => {
    const result = advanceBookingState(
      bs({
        flights: { status: 'asking' },
        hotels: { status: 'idle' },
      }),
      'flights',
      'asking',
      mockResult(['search_flights']),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.hotels.status).toBe('idle');
    expect(result.flights.status).toBe('presented');
  });

  it('preserves version field', () => {
    const result = advanceBookingState(
      bs(),
      'flights',
      'idle',
      mockResult(),
      trip({ transport_mode: 'flying' }),
    );
    expect(result.version).toBe(CURRENT_BOOKING_STATE_VERSION);
  });
});
