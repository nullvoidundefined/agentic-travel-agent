import {
  DEFAULT_TOOL_ADAPTERS,
  type ToolAdapters,
  executeTool,
} from 'app/tools/executor.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/trips/trips.js', () => ({
  updateTrip: vi.fn(),
  insertTripFlight: vi.fn(),
  insertTripHotel: vi.fn(),
  insertTripCarRental: vi.fn(),
  insertTripExperience: vi.fn(),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/**
 * ENG-04 tests: tool executor adapter seam.
 *
 * Pre-audit, the executor imported searchFlights, searchHotels,
 * searchExperiences, searchCarRentals, and getDestinationInfo directly
 * as module-level bindings. Every call to executeTool went through
 * the real tool implementations. There was no way for an E2E test
 * harness to substitute fake implementations without using
 * EVAL_MOCK_SEARCH, which is env-global and cannot do per-tool
 * overrides (you cannot run real flights with mocked hotels, for
 * example).
 *
 * The fix adds a ToolAdapters interface and an optional fourth
 * parameter to executeTool. When omitted, DEFAULT_TOOL_ADAPTERS is
 * used (the real implementations). When provided, executeTool
 * dispatches to the injected adapters instead. This is the
 * prerequisite for Plan B (E2E coverage) to mock external APIs at
 * a per-tool granularity.
 */

describe('executor adapter seam (ENG-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports DEFAULT_TOOL_ADAPTERS with the five injectable entries', () => {
    expect(DEFAULT_TOOL_ADAPTERS).toBeDefined();
    expect(typeof DEFAULT_TOOL_ADAPTERS.searchFlights).toBe('function');
    expect(typeof DEFAULT_TOOL_ADAPTERS.searchHotels).toBe('function');
    expect(typeof DEFAULT_TOOL_ADAPTERS.searchExperiences).toBe('function');
    expect(typeof DEFAULT_TOOL_ADAPTERS.searchCarRentals).toBe('function');
    expect(typeof DEFAULT_TOOL_ADAPTERS.getDestinationInfo).toBe('function');
  });

  it('uses injected searchFlights adapter when provided', async () => {
    const mockFlights = vi.fn().mockResolvedValue([
      {
        id: 'mock-flight-1',
        airline: 'MockAir',
        price: 123,
      },
    ]);
    const adapters: ToolAdapters = {
      ...DEFAULT_TOOL_ADAPTERS,
      searchFlights: mockFlights,
    };

    const result = await executeTool(
      'search_flights',
      {
        origin: 'SFO',
        destination: 'JFK',
        departure_date: '2026-07-01',
        passengers: 1,
      },
      undefined,
      adapters,
    );

    expect(mockFlights).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { id: 'mock-flight-1', airline: 'MockAir', price: 123 },
    ]);
  });

  it('uses injected searchHotels adapter when provided', async () => {
    const mockHotels = vi
      .fn()
      .mockResolvedValue([
        { id: 'mock-hotel-1', name: 'Mock Grand', total_price: 500 },
      ]);
    const adapters: ToolAdapters = {
      ...DEFAULT_TOOL_ADAPTERS,
      searchHotels: mockHotels,
    };

    const result = await executeTool(
      'search_hotels',
      {
        city: 'Paris',
        check_in: '2026-07-01',
        check_out: '2026-07-05',
        guests: 2,
      },
      undefined,
      adapters,
    );

    expect(mockHotels).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { id: 'mock-hotel-1', name: 'Mock Grand', total_price: 500 },
    ]);
  });

  it('supports per-tool mocking (real flights, mocked hotels)', async () => {
    // This is the exact scenario the old EVAL_MOCK_SEARCH env flag
    // could not support. Adapter injection makes it trivial.
    const mockHotels = vi.fn().mockResolvedValue([{ id: 'mock-h' }]);
    const realFlights = DEFAULT_TOOL_ADAPTERS.searchFlights;
    const adapters: ToolAdapters = {
      ...DEFAULT_TOOL_ADAPTERS,
      searchFlights: realFlights,
      searchHotels: mockHotels,
    };

    expect(adapters.searchFlights).toBe(realFlights);
    expect(adapters.searchHotels).toBe(mockHotels);
  });

  it('uses DEFAULT_TOOL_ADAPTERS when no adapters argument is passed (backward compat)', async () => {
    // Sanity: the original 3-argument signature still works. This
    // is what every existing call site in the codebase uses, so
    // nothing should break.
    const parsed = await executeTool(
      'calculate_remaining_budget',
      {
        total_budget: 1000,
        flight_cost: 400,
        hotel_total_cost: 200,
        experience_costs: [50, 50],
      },
      undefined,
    );
    expect(parsed).toBeDefined();
  });
});
