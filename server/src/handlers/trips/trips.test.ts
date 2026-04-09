import * as tripHandlers from 'app/handlers/trips/trips.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import { uuid } from 'app/utils/tests/uuids.js';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/trips/trips.js');
vi.mock('app/repositories/conversations/conversations.js', () => ({
  getOrCreateConversation: vi.fn().mockResolvedValue({ id: 'conv-1' }),
  updateBookingState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const userId = uuid(0);
const tripId = uuid(1);

function createApp() {
  const app = express();
  app.use(express.json());
  // Inject fake user for all requests
  app.use((req, _res, next) => {
    req.user = {
      id: userId,
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      created_at: new Date('2025-01-01'),
      updated_at: null,
    };
    next();
  });
  app.post('/trips', tripHandlers.createTrip);
  app.get('/trips', tripHandlers.listTrips);
  app.get('/trips/:id', tripHandlers.getTrip);
  app.put('/trips/:id', tripHandlers.updateTrip);
  app.delete('/trips/:id', tripHandlers.deleteTrip);
  app.post('/trips/:id/selections', tripHandlers.selectItem);
  app.post('/trips/:id/test-selections', tripHandlers.seedSelections);
  app.use(errorHandler);
  return app;
}

const mockTrip = {
  id: tripId,
  user_id: userId,
  destination: 'Barcelona',
  origin: 'SFO',
  departure_date: '2026-07-01',
  return_date: '2026-07-06',
  budget_total: 3000,
  budget_currency: 'USD',
  travelers: 2,
  preferences: { style: 'mid-range', pace: 'moderate', interests: ['food'] },
  status: 'planning' as const,
  transport_mode: null,
  trip_type: null,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
};

describe('trip handlers', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('POST /trips (createTrip)', () => {
    it('returns 400 when destination is missing', async () => {
      const res = await request(app).post('/trips').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(tripRepo.createTrip).not.toHaveBeenCalled();
    });

    it('returns 201 with created trip', async () => {
      vi.mocked(tripRepo.createTrip).mockResolvedValueOnce(mockTrip);

      const res = await request(app)
        .post('/trips')
        .send({
          destination: 'Barcelona',
          origin: 'SFO',
          departure_date: '2026-07-01',
          return_date: '2026-07-06',
          budget_total: 3000,
          travelers: 2,
          preferences: { style: 'mid-range' },
        });

      expect(res.status).toBe(201);
      expect(res.body.trip.id).toBe(tripId);
      expect(res.body.trip.destination).toBe('Barcelona');
      expect(tripRepo.createTrip).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          destination: 'Barcelona',
          budget_total: 3000,
        }),
      );
    });

    it('creates trip with minimal fields (destination only)', async () => {
      vi.mocked(tripRepo.createTrip).mockResolvedValueOnce({
        ...mockTrip,
        origin: null,
        departure_date: null,
        return_date: null,
        budget_total: null,
      });

      const res = await request(app)
        .post('/trips')
        .send({ destination: 'Paris' });

      expect(res.status).toBe(201);
      expect(tripRepo.createTrip).toHaveBeenCalled();
    });

    it('returns 500 on repo error', async () => {
      vi.mocked(tripRepo.createTrip).mockRejectedValueOnce(
        new Error('DB error'),
      );

      const res = await request(app)
        .post('/trips')
        .send({ destination: 'Barcelona' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /trips (listTrips)', () => {
    it('returns empty array when no trips', async () => {
      vi.mocked(tripRepo.listTrips).mockResolvedValueOnce([]);

      const res = await request(app).get('/trips');

      expect(res.status).toBe(200);
      expect(res.body.trips).toEqual([]);
      expect(tripRepo.listTrips).toHaveBeenCalledWith(userId);
    });

    it('returns user trips', async () => {
      vi.mocked(tripRepo.listTrips).mockResolvedValueOnce([mockTrip]);

      const res = await request(app).get('/trips');

      expect(res.status).toBe(200);
      expect(res.body.trips).toHaveLength(1);
      expect(res.body.trips[0].destination).toBe('Barcelona');
    });
  });

  describe('GET /trips/:id (getTrip)', () => {
    it('returns 404 when trip not found', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(null);

      const res = await request(app).get(`/trips/${tripId}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
      expect(res.body.message).toBe('Trip not found');
    });

    it('returns trip with details', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        ...mockTrip,
        flights: [],
        hotels: [],
        car_rentals: [],
        experiences: [],
      });

      const res = await request(app).get(`/trips/${tripId}`);

      expect(res.status).toBe(200);
      expect(res.body.trip.destination).toBe('Barcelona');
      expect(res.body.trip.flights).toEqual([]);
      expect(tripRepo.getTripWithDetails).toHaveBeenCalledWith(tripId, userId);
    });
  });

  describe('PUT /trips/:id (updateTrip)', () => {
    it('returns 400 when no fields provided', async () => {
      const res = await request(app).put(`/trips/${tripId}`).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when trip not found', async () => {
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce(null);

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ status: 'saved' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('updates trip status to saved', async () => {
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce({
        ...mockTrip,
        status: 'saved',
      });

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ status: 'saved' });

      expect(res.status).toBe(200);
      expect(res.body.trip.status).toBe('saved');
      expect(tripRepo.updateTrip).toHaveBeenCalledWith(
        tripId,
        userId,
        expect.objectContaining({ status: 'saved' }),
      );
    });

    it('updates trip dates', async () => {
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce({
        ...mockTrip,
        departure_date: '2026-08-01',
        return_date: '2026-08-10',
      });

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ departure_date: '2026-08-01', return_date: '2026-08-10' });

      expect(res.status).toBe(200);
      expect(tripRepo.updateTrip).toHaveBeenCalledWith(
        tripId,
        userId,
        expect.objectContaining({
          departure_date: '2026-08-01',
          return_date: '2026-08-10',
        }),
      );
    });

    it('rejects past departure dates with 400', async () => {
      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ departure_date: '2020-01-01' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('past');
    });

    it('rejects return_date before departure_date with 400', async () => {
      const res = await request(app).put(`/trips/${tripId}`).send({
        departure_date: '2026-09-01',
        return_date: '2026-08-01',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('after');
    });

    it('clears selections when destination changes on a trip with selections', async () => {
      const existingTrip = {
        ...mockTrip,
        destination: 'Barcelona',
        flights: [{ id: 'f1' }],
        hotels: [],
        car_rentals: [],
        experiences: [],
      };
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        existingTrip as unknown as Awaited<
          ReturnType<typeof tripRepo.getTripWithDetails>
        >,
      );
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce({
        ...mockTrip,
        destination: 'Paris',
      });
      vi.mocked(tripRepo.clearSelectionsForTrip).mockResolvedValueOnce(
        undefined,
      );
      // getOrCreateConversation + updateBookingState are side effects;
      // the handler dynamically imports them. Tolerate failure by
      // letting them call through (they would normally hit the DB,
      // but we only care that clearSelectionsForTrip got called).

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ destination: 'Paris' });

      expect(res.status).toBe(200);
      expect(tripRepo.clearSelectionsForTrip).toHaveBeenCalledWith(tripId);
    });

    it('does not clear selections when destination is unchanged', async () => {
      const existingTrip = {
        ...mockTrip,
        destination: 'Barcelona',
        flights: [{ id: 'f1' }],
      };
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        existingTrip as unknown as Awaited<
          ReturnType<typeof tripRepo.getTripWithDetails>
        >,
      );
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce({
        ...mockTrip,
        destination: 'Barcelona',
      });

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ destination: 'Barcelona' });

      expect(res.status).toBe(200);
      expect(tripRepo.clearSelectionsForTrip).not.toHaveBeenCalled();
    });

    it('does not clear selections when destination changes but trip has none', async () => {
      const existingTrip = {
        ...mockTrip,
        destination: 'Barcelona',
        flights: [],
        hotels: [],
        car_rentals: [],
        experiences: [],
      };
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        existingTrip as unknown as Awaited<
          ReturnType<typeof tripRepo.getTripWithDetails>
        >,
      );
      vi.mocked(tripRepo.updateTrip).mockResolvedValueOnce({
        ...mockTrip,
        destination: 'Paris',
      });

      const res = await request(app)
        .put(`/trips/${tripId}`)
        .send({ destination: 'Paris' });

      expect(res.status).toBe(200);
      expect(tripRepo.clearSelectionsForTrip).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:id (deleteTrip)', () => {
    it('returns 404 when trip not found', async () => {
      vi.mocked(tripRepo.deleteTrip).mockResolvedValueOnce(false);

      const res = await request(app).delete(`/trips/${tripId}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 204 on successful delete', async () => {
      vi.mocked(tripRepo.deleteTrip).mockResolvedValueOnce(true);

      const res = await request(app).delete(`/trips/${tripId}`);

      expect(res.status).toBe(204);
      expect(tripRepo.deleteTrip).toHaveBeenCalledWith(tripId, userId);
    });
  });

  describe('POST /trips/:id/test-selections (seedSelections, ENG-17)', () => {
    const ORIGINAL_FLAG = process.env.E2E_BYPASS_RATE_LIMITS;

    afterEach(() => {
      if (ORIGINAL_FLAG === undefined) {
        delete process.env.E2E_BYPASS_RATE_LIMITS;
      } else {
        process.env.E2E_BYPASS_RATE_LIMITS = ORIGINAL_FLAG;
      }
    });

    it('returns 404 when E2E_BYPASS_RATE_LIMITS is not set', async () => {
      delete process.env.E2E_BYPASS_RATE_LIMITS;
      const res = await request(app)
        .post(`/trips/${tripId}/test-selections`)
        .send({ flights: [] });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 404 when trip is not owned by the caller', async () => {
      process.env.E2E_BYPASS_RATE_LIMITS = '1';
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(null);
      const res = await request(app)
        .post(`/trips/${tripId}/test-selections`)
        .send({ flights: [] });
      expect(res.status).toBe(404);
    });

    it('inserts flights, hotels, car rentals, and experiences via repo functions', async () => {
      process.env.E2E_BYPASS_RATE_LIMITS = '1';
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTrip as unknown as Awaited<
          ReturnType<typeof tripRepo.getTripWithDetails>
        >,
      );
      vi.mocked(tripRepo.insertTripFlight).mockResolvedValue(undefined);
      vi.mocked(tripRepo.insertTripHotel).mockResolvedValue(undefined);
      vi.mocked(tripRepo.insertTripCarRental).mockResolvedValue(undefined);
      vi.mocked(tripRepo.insertTripExperience).mockResolvedValue(undefined);

      const payload = {
        flights: [
          {
            airline: 'Delta',
            flight_number: 'DL100',
            origin: 'DEN',
            destination: 'SFO',
            price: 300,
            currency: 'USD',
          },
        ],
        hotels: [
          {
            name: 'Test Hotel',
            price_per_night: 200,
            total_price: 800,
            currency: 'USD',
          },
        ],
        car_rentals: [
          {
            provider: 'Hertz',
            car_name: 'Toyota Camry',
            total_price: 300,
            currency: 'USD',
          },
        ],
        experiences: [
          {
            name: 'Bay Cruise',
            estimated_cost: 75,
          },
        ],
      };

      const res = await request(app)
        .post(`/trips/${tripId}/test-selections`)
        .send(payload);

      expect(res.status).toBe(204);
      expect(tripRepo.insertTripFlight).toHaveBeenCalledWith(
        tripId,
        payload.flights[0],
      );
      expect(tripRepo.insertTripHotel).toHaveBeenCalledWith(
        tripId,
        payload.hotels[0],
      );
      expect(tripRepo.insertTripCarRental).toHaveBeenCalledWith(
        tripId,
        payload.car_rentals[0],
      );
      expect(tripRepo.insertTripExperience).toHaveBeenCalledWith(
        tripId,
        payload.experiences[0],
      );
    });

    it('accepts an empty payload without calling any insert', async () => {
      process.env.E2E_BYPASS_RATE_LIMITS = '1';
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTrip as unknown as Awaited<
          ReturnType<typeof tripRepo.getTripWithDetails>
        >,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/test-selections`)
        .send({});
      expect(res.status).toBe(204);
      expect(tripRepo.insertTripFlight).not.toHaveBeenCalled();
      expect(tripRepo.insertTripHotel).not.toHaveBeenCalled();
    });
  });

  describe('POST /trips/:id/selections (selectItem, B14)', () => {
    const mockTripWithDetails = {
      ...mockTrip,
      flights: [],
      hotels: [],
      car_rentals: [],
      experiences: [],
    } as unknown as Awaited<ReturnType<typeof tripRepo.getTripWithDetails>>;

    it('returns 400 when data field is missing', async () => {
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'flight' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('data is required');
    });

    it('returns 404 when trip is not owned by the caller', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(null);
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'flight', data: {} });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 400 when type is invalid', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'spaceship', data: {} });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid selection type');
    });

    it('returns 400 when flight data fails Zod validation', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'flight', data: { airline: 'Delta' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when hotel data fails Zod validation', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'hotel', data: { name: 'Arts' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when car_rental data fails Zod validation', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'car_rental', data: { provider: 'Hertz' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when experience data fails Zod validation', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'experience', data: { category: 'museum' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 201 and calls insertTripFlight for flight type', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      vi.mocked(tripRepo.insertTripFlight).mockResolvedValueOnce(undefined);
      const flightData = {
        airline: 'Delta',
        flight_number: 'DL100',
        origin: 'JFK',
        destination: 'BCN',
        price: 450,
        currency: 'USD',
      };
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'flight', data: flightData });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(tripRepo.insertTripFlight).toHaveBeenCalledWith(
        tripId,
        expect.objectContaining({ airline: 'Delta', price: 450 }),
      );
    });

    it('returns 201 and calls insertTripHotel for hotel type', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      vi.mocked(tripRepo.insertTripHotel).mockResolvedValueOnce(undefined);
      const hotelData = {
        name: 'Hotel Arts',
        price_per_night: 200,
        total_price: 1000,
        currency: 'USD',
      };
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'hotel', data: hotelData });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(tripRepo.insertTripHotel).toHaveBeenCalledWith(
        tripId,
        expect.objectContaining({ name: 'Hotel Arts', total_price: 1000 }),
      );
    });

    it('returns 201 and calls insertTripCarRental for car_rental type', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      vi.mocked(tripRepo.insertTripCarRental).mockResolvedValueOnce(undefined);
      const rentalData = {
        provider: 'Hertz',
        car_name: 'Toyota Camry',
        total_price: 300,
        currency: 'USD',
      };
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'car_rental', data: rentalData });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(tripRepo.insertTripCarRental).toHaveBeenCalledWith(
        tripId,
        expect.objectContaining({ provider: 'Hertz', total_price: 300 }),
      );
    });

    it('returns 201 and calls insertTripExperience for experience type', async () => {
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(
        mockTripWithDetails,
      );
      vi.mocked(tripRepo.insertTripExperience).mockResolvedValueOnce(undefined);
      const expData = { name: 'Sagrada Familia', estimated_cost: 30 };
      const res = await request(app)
        .post(`/trips/${tripId}/selections`)
        .send({ type: 'experience', data: expData });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(tripRepo.insertTripExperience).toHaveBeenCalledWith(
        tripId,
        expect.objectContaining({
          name: 'Sagrada Familia',
          estimated_cost: 30,
        }),
      );
    });
  });
});
