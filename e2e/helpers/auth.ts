/**
 * Page-object helpers for authentication flows.
 *
 * Selectors target stable affordances rather than implementation
 * details. If a selector breaks, fix it once here instead of in
 * every spec.
 */
import { type Page, expect } from '@playwright/test';

export interface Credentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function register(page: Page, c: Credentials): Promise<void> {
  await page.goto('/register');

  // Register form has First name + Last name + Email + Password,
  // all required. Fill in the order the form expects.
  const firstName = page
    .locator(
      'input[name="first_name"], input[placeholder*="First" i], input[aria-label="First name"]',
    )
    .first();
  if ((await firstName.count()) > 0) {
    await firstName.fill(c.firstName ?? 'Test');
  }
  const lastName = page
    .locator(
      'input[name="last_name"], input[placeholder*="Last" i], input[aria-label="Last name"]',
    )
    .first();
  if ((await lastName.count()) > 0) {
    await lastName.fill(c.lastName ?? 'User');
  }

  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);
  await page.click('button[type="submit"], button:has-text("Continue")');

  // After successful signup the page enters step 2: a
  // PreferencesWizard modal opens IN PLACE on /register. The URL
  // does not change to /trips until handleWizardClose() runs.
  // The wizard is uniquely identified by the H2 it renders. Wait
  // for that or for any URL change away from /register.
  await Promise.race([
    page.locator('h2:has-text("Your Travel Preferences")').waitFor({
      timeout: 10_000,
    }),
    page.waitForURL((url) => !url.pathname.endsWith('/register'), {
      timeout: 10_000,
    }),
  ]);
}

export async function login(page: Page, c: Credentials): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);
  await page.click('button[type="submit"]');
  // Trips list is the post-login landing route per US-9.
  await expect(page).toHaveURL(/\/trips/, { timeout: 10_000 });
}

export async function logout(page: Page): Promise<void> {
  // Scope to the header so the click does not match a duplicate
  // affordance in the footer (the page renders the same nav links
  // in both the banner and the contentinfo).
  await page
    .locator('header')
    .locator(
      'button:has-text("Sign Out"), a:has-text("Sign Out"), [aria-label="Sign out" i]',
    )
    .first()
    .click();
}

export async function assertLoggedIn(page: Page): Promise<void> {
  // Header-scoped to avoid strict-mode multi-match against the
  // duplicate footer nav.
  await expect(
    page
      .locator('header')
      .locator(
        'a:has-text("My Trips"), a:has-text("Account"), button:has-text("Sign Out"), a:has-text("Sign Out")',
      )
      .first(),
  ).toBeVisible({ timeout: 5_000 });
}

export async function assertLoggedOut(page: Page): Promise<void> {
  // The site renders "Sign In" in BOTH the banner header and the
  // contentinfo footer. Plain `locator('a:has-text("Sign In"))`
  // matches twice and Playwright strict mode rejects it. Scope
  // to the header.
  await expect(
    page
      .locator('header')
      .locator('a:has-text("Sign In"), a:has-text("Log In")')
      .first(),
  ).toBeVisible({ timeout: 5_000 });
}
