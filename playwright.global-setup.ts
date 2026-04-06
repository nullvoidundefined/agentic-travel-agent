/**
 * Playwright globalSetup runner.
 *
 * Runs ONCE after the webServer entries report ready and BEFORE
 * any spec executes. We use it to invoke scripts/e2e-smoke.sh,
 * which validates that the server is healthy and CORS is wired
 * correctly for the test runner's origin. If the smoke fails,
 * Playwright aborts immediately with a clear error instead of
 * letting every spec time out three times.
 *
 * Source: ENG-14 (2026-04-06). Run 4 of PR #9 spent 15 minutes
 * retrying 35 specs because CORS_ORIGIN defaulted to a stale
 * Vite port. The smoke catches that class of bug in seconds.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup(): Promise<void> {
  const scriptPath = path.resolve(__dirname, 'scripts/e2e-smoke.sh');
  try {
    execSync(scriptPath, { stdio: 'inherit' });
  } catch (err) {
    console.error('\ne2e-smoke check failed; aborting Playwright run.\n');
    throw err;
  }
}
