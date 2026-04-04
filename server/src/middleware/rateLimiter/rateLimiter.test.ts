import {
  authRateLimiter,
  chatRateLimiter,
  rateLimiter,
} from 'app/middleware/rateLimiter/rateLimiter.js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

function buildApp(
  limiter: ReturnType<typeof import('express-rate-limit').default>,
) {
  const app = express();
  app.use(limiter);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sets standard rate-limit headers', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('does not set legacy X-RateLimit headers', async () => {
    const app = buildApp(rateLimiter);
    const res = await request(app).get('/test');
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });
});

describe('chatRateLimiter', () => {
  it('keys by user ID, not IP', async () => {
    const app = express();
    // Simulate authenticated user
    app.use((req, _res, next) => {
      req.user = { id: 'user-1' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    const res = await request(app).post('/chat');
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding chat limit', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'chat-flood-user' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    // Chat limit is 10 per 5 minutes
    for (let i = 0; i < 10; i++) {
      await request(app).post('/chat');
    }

    const blocked = await request(app).post('/chat');
    expect(blocked.status).toBe(429);
  });

  it('returns a clear message on 429', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: 'msg-check-user' } as Express.Request['user'];
      next();
    });
    app.use(chatRateLimiter);
    app.post('/chat', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      await request(app).post('/chat');
    }

    const blocked = await request(app).post('/chat');
    expect(blocked.body.message).toContain('wait');
  });
});

describe('authRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(authRateLimiter);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 after exceeding the auth limit', async () => {
    const app = buildApp(authRateLimiter);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/test');
    }

    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
  });
});
