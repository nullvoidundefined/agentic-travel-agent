/**
 * Route wiring smoke tests for trips and places routers. This
 * file complements routes.test.ts (which covers auth routes
 * only) and fills the ENG-18 gap where src/routes/trips.ts and
 * src/routes/places.ts were at 0 percent branch coverage.
 *
 * Same pattern as routes.test.ts: mock the handlers with tiny
 * stubs that return known status codes, mock the rate limiter
 * and auth middleware so requests pass through, then verify
 * each route is wired to the correct handler.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('app/handlers/trips/trips.js', () => ({
  createTrip: (_: express.Request, res: express.Response) =>
    res.status(201).json({ ok: 'createTrip' }),
  listTrips: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'listTrips' }),
  getTrip: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'getTrip' }),
  updateTrip: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'updateTrip' }),
  deleteTrip: (_: express.Request, res: express.Response) =>
    res.status(204).send(),
  // B14: production selection endpoint
  selectItem: (_: express.Request, res: express.Response) =>
    res.status(201).json({ ok: 'selectItem' }),
  // PR-H (ENG-17) added a test-only seedSelections handler
  // that the tripRouter imports. Stub it so vi.mock does not
  // error with "No seedSelections export is defined" when this
  // test runs against main after PR-H merged.
  seedSelections: (_: express.Request, res: express.Response) =>
    res.status(204).send(),
}));

vi.mock('app/handlers/chat/chat.js', () => ({
  chat: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'chat' }),
  getMessages: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'getMessages' }),
}));

vi.mock('app/handlers/places/photoProxy.handler.js', () => ({
  photoProxyHandler: (_: express.Request, res: express.Response) =>
    res.status(200).json({ ok: 'photoProxy' }),
}));

vi.mock('app/middleware/rateLimiter/rateLimiter.js', () => ({
  rateLimiter: (
    _: express.Request,
    __: express.Response,
    next: express.NextFunction,
  ) => next(),
  chatRateLimiter: (
    _: express.Request,
    __: express.Response,
    next: express.NextFunction,
  ) => next(),
  authRateLimiter: (
    _: express.Request,
    __: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

vi.mock('app/middleware/requireAuth/requireAuth.js', () => ({
  requireAuth: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
  loadSession: (
    _req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => next(),
}));

async function buildAppWithTrips() {
  const { tripRouter } = await import('app/routes/trips.js');
  const app = express();
  app.use(express.json());
  app.use('/trips', tripRouter);
  return app;
}

async function buildAppWithPlaces() {
  const { placesRouter } = await import('app/routes/places.js');
  const app = express();
  app.use(express.json());
  app.use('/places', placesRouter);
  return app;
}

describe('tripRouter wiring', () => {
  it('POST /trips returns the createTrip handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app).post('/trips').send({ destination: 'SF' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: 'createTrip' });
  });

  it('GET /trips returns the listTrips handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app).get('/trips');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'listTrips' });
  });

  it('GET /trips/:id returns the getTrip handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app).get('/trips/abc123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'getTrip' });
  });

  it('PUT /trips/:id returns the updateTrip handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app)
      .put('/trips/abc123')
      .send({ destination: 'LA' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'updateTrip' });
  });

  it('DELETE /trips/:id returns the deleteTrip handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app).delete('/trips/abc123');
    expect(res.status).toBe(204);
  });

  it('POST /trips/:id/chat returns the chat handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app)
      .post('/trips/abc123/chat')
      .send({ message: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'chat' });
  });

  it('GET /trips/:id/messages returns the getMessages handler', async () => {
    const app = await buildAppWithTrips();
    const res = await request(app).get('/trips/abc123/messages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'getMessages' });
  });
});

describe('placesRouter wiring', () => {
  it('GET /places/photo returns the photoProxyHandler', async () => {
    const app = await buildAppWithPlaces();
    const res = await request(app).get('/places/photo?ref=abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: 'photoProxy' });
  });
});
