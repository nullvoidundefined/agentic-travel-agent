import { updateTrip } from 'app/repositories/trips/trips.js';
import { calculateRemainingBudget } from 'app/tools/budget.tool.js';
import { getDestinationInfo } from 'app/tools/destination.tool.js';
import { executeTool } from 'app/tools/executor.js';
import { searchExperiences } from 'app/tools/experiences.tool.js';
import { searchFlights } from 'app/tools/flights.tool.js';
import { searchHotels } from 'app/tools/hotels.tool.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/tools/flights.tool.js');
vi.mock('app/tools/hotels.tool.js');
vi.mock('app/tools/experiences.tool.js');
vi.mock('app/tools/budget.tool.js');
vi.mock('app/tools/destination.tool.js');
vi.mock('app/repositories/trips/trips.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeTool', () => {
    it('dispatches search_flights to flights tool', async () => {
      vi.mocked(searchFlights).mockResolvedValueOnce([]);

      const result = await executeTool('search_flights', {
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });

      expect(searchFlights).toHaveBeenCalledWith({
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });
      expect(result).toEqual([]);
    });

    it('dispatches search_hotels to hotels tool', async () => {
      vi.mocked(searchHotels).mockResolvedValueOnce([]);

      await executeTool('search_hotels', {
        city_code: 'BCN',
        check_in: '2026-07-01',
        check_out: '2026-07-06',
        guests: 2,
      });

      expect(searchHotels).toHaveBeenCalled();
    });

    it('dispatches search_experiences to experiences tool', async () => {
      vi.mocked(searchExperiences).mockResolvedValueOnce([]);

      await executeTool('search_experiences', {
        location: 'Barcelona',
        categories: ['tours'],
      });

      expect(searchExperiences).toHaveBeenCalled();
    });

    it('dispatches calculate_remaining_budget to budget tool', async () => {
      const budgetResult = {
        total_budget: 3000,
        total_spent: 1500,
        remaining: 1500,
        remaining_percentage: 50,
        over_budget: false,
        breakdown: {
          flights: { amount: 900, percentage: 30 },
          hotels: { amount: 600, percentage: 20 },
          experiences: { amount: 0, percentage: 0 },
        },
      };
      vi.mocked(calculateRemainingBudget).mockReturnValueOnce(budgetResult);

      const result = await executeTool('calculate_remaining_budget', {
        total_budget: 3000,
        flight_cost: 900,
        hotel_total_cost: 600,
        experience_costs: [],
      });

      expect(calculateRemainingBudget).toHaveBeenCalled();
      expect(result).toEqual(budgetResult);
    });

    it('dispatches get_destination_info to destination tool', async () => {
      const destResult = {
        city_name: 'Barcelona',
        iata_code: 'BCN',
        country: 'Spain',
        timezone: 'Europe/Madrid',
        currency: 'EUR',
        best_time_to_visit: 'May to June',
      };
      vi.mocked(getDestinationInfo).mockReturnValueOnce(destResult);

      const result = await executeTool('get_destination_info', {
        city_name: 'Barcelona',
      });

      expect(getDestinationInfo).toHaveBeenCalledWith({
        city_name: 'Barcelona',
      });
      expect(result).toEqual(destResult);
    });

    it('dispatches update_trip to trips repository', async () => {
      vi.mocked(updateTrip).mockResolvedValueOnce({
        id: 'trip-1',
        user_id: 'user-1',
        destination: 'Barcelona',
        origin: null,
        departure_date: '2026-07-01',
        return_date: '2026-07-06',
        budget_total: 3000,
        budget_currency: 'USD',
        travelers: 1,
        preferences: {},
        status: 'planning',
        transport_mode: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await executeTool(
        'update_trip',
        { destination: 'Barcelona', budget_total: 3000 },
        { tripId: 'trip-1', userId: 'user-1' },
      );

      expect(updateTrip).toHaveBeenCalledWith('trip-1', 'user-1', {
        destination: 'Barcelona',
        budget_total: 3000,
      });
      expect(result).toEqual({
        success: true,
        message: 'Trip updated successfully',
      });
    });

    it('throws for update_trip without context', async () => {
      await expect(
        executeTool('update_trip', { destination: 'Barcelona' }),
      ).rejects.toThrow('update_trip requires trip context');
    });

    it('throws for unknown tool name', async () => {
      await expect(executeTool('unknown_tool', {})).rejects.toThrow(
        'Unknown tool: unknown_tool',
      );
    });

    it('returns timing information', async () => {
      vi.mocked(searchFlights).mockResolvedValueOnce([]);

      const start = Date.now();
      await executeTool('search_flights', {
        origin: 'SFO',
        destination: 'BCN',
        departure_date: '2026-07-01',
        passengers: 1,
      });
      const elapsed = Date.now() - start;

      // Should complete quickly with mocked tools
      expect(elapsed).toBeLessThan(100);
    });
  });
});
