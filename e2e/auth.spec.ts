import { expect, test } from '@playwright/test';

const TEST_EMAIL = 'e2e-user@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';
const REGISTER_EMAIL = `e2e-register-${Date.now()}@integration-test.invalid`;

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(
      page.locator('[role="alert"], .error, [class*="error"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('register creates account and redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.fill('input[type="email"]', REGISTER_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);

    // Fill first/last name if fields exist
    const firstNameInput = page.locator(
      'input[name="first_name"], input[placeholder*="First"]',
    );
    if ((await firstNameInput.count()) > 0) {
      await firstNameInput.fill('Test');
    }
    const lastNameInput = page.locator(
      'input[name="last_name"], input[placeholder*="Last"]',
    );
    if ((await lastNameInput.count()) > 0) {
      await lastNameInput.fill('User');
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('visiting protected route while logged out redirects to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Find and click logout
    await page.click(
      'button:has-text("Logout"), [aria-label="Logout"], a:has-text("Logout")',
    );
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
