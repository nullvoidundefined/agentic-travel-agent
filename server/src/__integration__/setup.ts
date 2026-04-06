import pool from 'app/db/pool/pool.js';
import 'dotenv/config';
import { afterAll, beforeAll } from 'vitest';

// Bypass the rate limiter for the integration test process. The
// integration tests fire dozens of /auth/register and /auth/login
// requests in the same vitest process from the same IP, which
// would otherwise trip the auth rate limiter (10 per 15 min) and
// 429 every test after the limit. Unit tests bypass via vi.mock;
// integration tests bypass via the env flag the rate limiter
// already understands. The flag is also set in playwright.config.ts
// for the same reason.
process.env.E2E_BYPASS_RATE_LIMITS = '1';

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set; skipping integration tests');
    return;
  }

  // Clean test data from previous runs
  await pool.query(
    "DELETE FROM trip_hotels WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM trip_flights WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
});

afterAll(async () => {
  // Clean up test data
  await pool.query(
    "DELETE FROM trip_hotels WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM trip_flights WHERE trip_id IN (SELECT id FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM trips WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
  await pool.end();
});
