import * as prefsHandlers from 'app/handlers/userPreferences/userPreferences.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import * as prefsRepo from 'app/repositories/userPreferences/userPreferences.js';
import type { User } from 'app/schemas/auth.js';
import { uuid } from 'app/utils/tests/uuids.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/userPreferences/userPreferences.js');
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const id = uuid();
const mockUser: User = {
  id,
  email: 'user@example.com',
  first_name: 'Test',
  last_name: 'User',
  created_at: new Date('2025-01-01'),
  updated_at: null,
};

function buildApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  if (authenticated) {
    app.use((req, _res, next) => {
      req.user = mockUser;
      next();
    });
  }

  app.get('/user-preferences', requireAuth, prefsHandlers.getPreferences);
  app.put('/user-preferences', requireAuth, prefsHandlers.upsertPreferences);
  app.use(errorHandler);
  return app;
}

describe('userPreferences handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /user-preferences', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).get('/user-preferences');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('returns 200 with preferences when found', async () => {
      const app = buildApp();
      const prefs = {
        id: uuid(),
        user_id: id,
        dietary: ['vegetarian'],
        intensity: 'active',
        social: 'couple',
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
      };
      vi.mocked(prefsRepo.findByUserId).mockResolvedValueOnce(prefs);

      const res = await request(app).get('/user-preferences');

      expect(res.status).toBe(200);
      expect(res.body.preferences.dietary).toEqual(['vegetarian']);
      expect(res.body.preferences.intensity).toBe('active');
      expect(res.body.preferences.social).toBe('couple');
      expect(prefsRepo.findByUserId).toHaveBeenCalledWith(id);
    });

    it('returns 200 with null when no preferences exist', async () => {
      const app = buildApp();
      vi.mocked(prefsRepo.findByUserId).mockResolvedValueOnce(null);

      const res = await request(app).get('/user-preferences');

      expect(res.status).toBe(200);
      expect(res.body.preferences).toBeNull();
    });
  });

  describe('PUT /user-preferences', () => {
    it('returns 401 when not authenticated', async () => {
      const app = buildApp(false);
      const res = await request(app).put('/user-preferences').send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('returns 400 when body invalid', async () => {
      const app = buildApp();
      const res = await request(app)
        .put('/user-preferences')
        .send({ dietary: ['invalid_option'], intensity: 'extreme' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(prefsRepo.upsert).not.toHaveBeenCalled();
    });

    it('returns 200 and upserts preferences', async () => {
      const app = buildApp();
      const input = {
        dietary: ['vegan', 'gluten-free'],
        intensity: 'relaxed',
        social: 'family',
      };
      const prefs = {
        id: uuid(),
        user_id: id,
        ...input,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
      };
      vi.mocked(prefsRepo.upsert).mockResolvedValueOnce(prefs);

      const res = await request(app).put('/user-preferences').send(input);

      expect(res.status).toBe(200);
      expect(res.body.preferences.dietary).toEqual(['vegan', 'gluten-free']);
      expect(res.body.preferences.intensity).toBe('relaxed');
      expect(res.body.preferences.social).toBe('family');
      expect(prefsRepo.upsert).toHaveBeenCalledWith(id, input);
    });

    it('applies defaults when fields omitted', async () => {
      const app = buildApp();
      const prefs = {
        id: uuid(),
        user_id: id,
        dietary: [],
        intensity: 'moderate',
        social: 'couple',
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
      };
      vi.mocked(prefsRepo.upsert).mockResolvedValueOnce(prefs);

      const res = await request(app).put('/user-preferences').send({});

      expect(res.status).toBe(200);
      expect(prefsRepo.upsert).toHaveBeenCalledWith(id, {
        dietary: [],
        intensity: 'moderate',
        social: 'couple',
      });
    });

    it('returns 500 when repo throws', async () => {
      const app = buildApp();
      vi.mocked(prefsRepo.upsert).mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .put('/user-preferences')
        .send({ dietary: [], intensity: 'moderate', social: 'solo' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('INTERNAL_ERROR');
    });
  });
});
