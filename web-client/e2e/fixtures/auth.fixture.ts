import { type Page } from '@playwright/test';

export const TEST_EMAIL = 'e2e-user@integration-test.invalid';
export const TEST_PASSWORD = 'testpassword123';

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/trips', { timeout: 10000 });
}

export async function ensureLoggedOut(page: Page): Promise<void> {
  await page.goto('/');
  const signOutButton = page.getByRole('button', { name: /sign out/i });
  if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signOutButton.click();
    await page.waitForURL('/');
  }
}

export function generateTestEmail(): string {
  return `e2e-register-${Date.now()}@integration-test.invalid`;
}
