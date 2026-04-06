import { rateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

/**
 * ENG-02 backfill: regression test for commit `bea33cc`
 * "fix: Railway crash, copy JSON to dist, fix rate limiter IPv6 validation"
 * which shipped with no test and crashed production on Railway.
 *
 * The underlying bug was that express-rate-limit v8's IP validation
 * rejected certain IPv6 address shapes that Railway's load balancer
 * passes through, causing the rate limiter middleware to throw on
 * every request. The fix was to configure the limiter to handle
 * IPv6 correctly.
 *
 * This test exercises the rate limiter with an IPv6 source address
 * and asserts the middleware does not throw. If a future change
 * reintroduces the validation regression, these tests will crash
 * the same way production did.
 */

function createApp() {
  const app = express();
  // Trust the first proxy so X-Forwarded-For is respected, which is
  // how Railway forwards the client IP.
  app.set('trust proxy', 1);
  app.use(rateLimiter);
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('rateLimiter IPv6 handling (ENG-02 backfill)', () => {
  it('handles loopback IPv6 (::1) without crashing', async () => {
    const app = createApp();
    const res = await request(app).get('/ping').set('X-Forwarded-For', '::1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('handles full IPv6 address without crashing', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/ping')
      .set('X-Forwarded-For', '2001:db8:85a3:0000:0000:8a2e:0370:7334');
    expect(res.status).toBe(200);
  });

  it('handles IPv6 shorthand without crashing', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/ping')
      .set('X-Forwarded-For', '2001:db8::1');
    expect(res.status).toBe(200);
  });

  it('handles IPv4-mapped IPv6 (::ffff:192.0.2.1) without crashing', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/ping')
      .set('X-Forwarded-For', '::ffff:192.0.2.1');
    expect(res.status).toBe(200);
  });

  it('still handles plain IPv4 for backward compat', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/ping')
      .set('X-Forwarded-For', '192.0.2.1');
    expect(res.status).toBe(200);
  });
});
