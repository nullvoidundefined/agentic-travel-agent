import { app } from 'app/app.js';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('CORS Integration', () => {
  let server: Server;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(() => {
    server?.close();
  });

  it('includes Access-Control-Allow-Origin for allowed origin', async () => {
    const res = await request(server)
      .get('/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not include CORS headers for disallowed origin', async () => {
    const res = await request(server)
      .get('/health')
      .set('Origin', 'http://evil.com');

    // The app either blocks with an error or omits CORS headers
    const corsHeader = res.headers['access-control-allow-origin'];
    expect(corsHeader).not.toBe('http://evil.com');
  });

  it('handles preflight OPTIONS request', async () => {
    const res = await request(server)
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, X-Requested-With');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(res.headers['access-control-allow-headers']).toMatch(
      /X-Requested-With/i,
    );
  });
});
