import { app } from 'app/app.js';
import type { Server } from 'http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_EMAIL = 'auth-flow@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';

describe('Auth Integration', () => {
  let server: Server;
  let sessionCookie: string;

  beforeAll(() => {
    server = app.listen(0); // random available port
  });

  afterAll(() => {
    server?.close();
  });

  it('POST /auth/register creates a user and returns session', async () => {
    const res = await request(server)
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        first_name: 'Test',
        last_name: 'User',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.first_name).toBe('Test');
    expect(res.body.user.last_name).toBe('User');

    sessionCookie =
      (res.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('sid'),
      ) ?? '';
    expect(sessionCookie).not.toBe('');
  });

  it('GET /auth/me returns authenticated user', async () => {
    const res = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /auth/logout clears session', async () => {
    const res = await request(server)
      .post('/auth/logout')
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(204);
  });

  it('GET /auth/me after logout returns 401', async () => {
    const res = await request(server)
      .get('/auth/me')
      .set('Cookie', sessionCookie)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(res.status).toBe(401);
  });

  it('POST /auth/login with valid creds returns session', async () => {
    const res = await request(server)
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);

    sessionCookie =
      (res.headers['set-cookie'] as unknown as string[])?.find((c) =>
        c.startsWith('sid'),
      ) ?? '';
    expect(sessionCookie).not.toBe('');
  });

  it('POST /auth/login with bad creds returns 401', async () => {
    const res = await request(server)
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('POST /auth/login without X-Requested-With is rejected with 403', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(403);
  });

  it('POST /auth/register with duplicate email returns 409', async () => {
    const res = await request(server)
      .post('/auth/register')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        first_name: 'Test',
        last_name: 'User',
      });

    expect(res.status).toBe(409);
  });
});
