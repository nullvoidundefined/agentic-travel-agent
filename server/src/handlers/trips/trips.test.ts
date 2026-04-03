import * as tripHandlers from 'app/handlers/trips/trips.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import { uuid } from 'app/utils/tests/uuids.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/trips/trips.js');
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
  app.delete('/trips/:id', tripHandlers.deleteTrip);
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
        experiences: [],
      });

      const res = await request(app).get(`/trips/${tripId}`);

      expect(res.status).toBe(200);
      expect(res.body.trip.destination).toBe('Barcelona');
      expect(res.body.trip.flights).toEqual([]);
      expect(tripRepo.getTripWithDetails).toHaveBeenCalledWith(tripId, userId);
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
});
