import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../server/.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TEST_USER_EMAIL = 'e2e-user@integration-test.invalid';
const TEST_USER_PASSWORD = 'testpassword123';

async function seed() {
  const hash = await bcrypt.hash(TEST_USER_PASSWORD, 12);

  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
    [TEST_USER_EMAIL, hash, 'Test', 'User'],
  );

  console.log(`Seeded test user: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
