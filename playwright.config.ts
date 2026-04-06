import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Playwright loads this config via CommonJS so __dirname is the
// directory of this file regardless of CWD. We use it to keep
// the testDir absolute, which lets the config work whether
// invoked from the monorepo root or from inside web-client
// (where the @playwright/test binary lives).
const ROOT_DIR = __dirname;

export default defineConfig({
  testDir: path.resolve(ROOT_DIR, 'e2e'),
  // The nightly real-API smoke suite lives at e2e/real-apis/ and
  // must NOT run in the main mocked suite. The e2e-real-apis.yml
  // workflow points at it explicitly with --grep or by passing the
  // path as an argument.
  testIgnore: ['**/real-apis/**'],
  // ENG-14 (2026-04-06): run scripts/e2e-smoke.sh once after the
  // webServers report ready and before any spec executes. The
  // smoke validates that the server is healthy AND that CORS is
  // wired correctly for the test runner's origin. If it fails,
  // Playwright aborts in seconds with a clear error instead of
  // letting every spec time out three times.
  globalSetup: path.resolve(ROOT_DIR, 'playwright.global-setup.ts'),
  timeout: 30_000,
  retries: process.env.CI ? 2 : 1,
  // ENG-13 (2026-04-06): bump CI workers from 1 to 2. The
  // E2E suite was sequential because the seedUser fixture races
  // on /auth/register if multiple workers hit the same DB row
  // by coincidence. Two workers is the largest safe value:
  // each test seeds a unique email (uniq() in test-users.ts)
  // so collisions are impossible, and Playwright distributes
  // specs round-robin so the two workers stay balanced. Higher
  // worker counts on a single Postgres instance start hitting
  // pool exhaustion (server pool max=10) when chat-flow tests
  // also start firing.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      // Run from the server package so dotenv finds server/.env
      // and tsx resolves src/index.ts. Without this Playwright
      // spawns from whatever CWD invoked it (web-client when
      // running via `pnpm --dir web-client exec`) and the
      // `cd server && ...` shell trick we previously used
      // crashed in CI because web-client/server does not exist.
      cwd: path.resolve(ROOT_DIR, 'server'),
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        // Forward the parent process env so DATABASE_URL,
        // REDIS_URL, and other server boot requirements survive.
        // Without this spread Playwright replaces process.env
        // wholesale and the server crashes with "DATABASE_URL is
        // required" before any test runs.
        ...(process.env as Record<string, string>),
        PORT: '3001',
        NODE_ENV: 'test',
        // ENG-16 (2026-04-07): prefer DATABASE_URL_E2E_LOCAL over
        // the inherited DATABASE_URL when it is set. This lets
        // a developer point local e2e runs at a dedicated test
        // Postgres (provisioned by scripts/e2e-local-db.sh)
        // instead of the prod Neon connection string in
        // server/.env. CI sets DATABASE_URL directly and leaves
        // DATABASE_URL_E2E_LOCAL unset, so the fallback is the
        // inherited DATABASE_URL which is the CI Postgres
        // service container.
        ...(process.env.DATABASE_URL_E2E_LOCAL
          ? { DATABASE_URL: process.env.DATABASE_URL_E2E_LOCAL }
          : {}),
        // Plan B: force the server to use mock tool adapters so
        // E2E runs do not burn real SerpApi / Google Places
        // quota. The real-API smoke suite in e2e/real-apis/ runs
        // in a separate nightly workflow with this flag unset.
        E2E_MOCK_TOOLS: '1',
        // Option B (2026-04-06): swap the real Anthropic SDK for
        // a deterministic stub so the suite needs no API key
        // and burns no tokens. The orchestrator falls back to
        // the real client when this is unset.
        E2E_MOCK_ANTHROPIC: '1',
        // The 35 story specs each call /auth/register from the
        // same IP. Without bypassing the auth rate limit (10 per
        // 15 min) the run would 429 after the 10th test. Unit
        // and integration tests do NOT set this flag and still
        // exercise the limiter behavior.
        E2E_BYPASS_RATE_LIMITS: '1',
        // The corsConfig default is http://localhost:5173 (a
        // legacy Vite port). Next.js dev runs on :3000, so
        // without this override every browser request from the
        // test runner is blocked with net::ERR_FAILED before it
        // even reaches the auth handler.
        CORS_ORIGIN: 'http://localhost:3000',
      },
    },
    {
      command: 'npx next dev --port 3000',
      cwd: path.resolve(ROOT_DIR, 'web-client'),
      port: 3000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
