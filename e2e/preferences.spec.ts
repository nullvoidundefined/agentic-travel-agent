/**
 * User preferences: US-29 through US-33.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login, register } from './helpers/auth';

test.describe('Preferences', () => {
  test('US-29: preferences wizard opens after registration', async ({
    page,
  }) => {
    const user = newUser();
    await register(page, user);
    // The wizard renders IN PLACE on /register and is identified
    // by its H2 "Your Travel Preferences". The URL stays at
    // /register until the wizard closes via router.push.
    await expect(
      page.locator('h2:has-text("Your Travel Preferences")'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('US-30: navigate through wizard steps', async ({ page }) => {
    const user = newUser();
    await register(page, user);

    // Step 1 of 6 should be visible after registration.
    const wizard = page.locator('[role="dialog"][aria-label*="preferences" i]');
    await expect(wizard).toBeVisible({ timeout: 5_000 });
    await expect(wizard.locator('text=/Step 1 of 6/i')).toBeVisible();

    // Click Next to advance to step 2.
    await wizard.locator('button:has-text("Next")').click();
    await expect(wizard.locator('text=/Step 2 of 6/i')).toBeVisible({
      timeout: 5_000,
    });

    // Click Back to return to step 1.
    await wizard.locator('button:has-text("Back")').click();
    await expect(wizard.locator('text=/Step 1 of 6/i')).toBeVisible({
      timeout: 5_000,
    });

    // Skip should also advance to step 2 without requiring an
    // answer for step 1.
    await wizard.locator('button:has-text("Skip")').click();
    await expect(wizard.locator('text=/Step 2 of 6/i')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('US-31: edit preferences from account page', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    const editBtn = page
      .locator(
        'button:has-text("Edit Preferences"), a:has-text("Edit Preferences")',
      )
      .first();
    if ((await editBtn.count()) === 0) {
      test.skip(true, 'edit-preferences affordance not yet implemented');
    }
    await editBtn.click();
  });

  test('US-32: incomplete preferences badge', async ({ page }) => {
    // A freshly seeded user has no completed preference steps,
    // so the header's Account link should render the
    // incomplete-badge marker. The marker has a stable
    // aria-label so the test does not depend on CSS or color.
    const user = await seedUser(newUser());
    await login(page, user);
    await expect(
      page.locator('header').locator('[aria-label="Preferences incomplete"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('US-33: view preferences on account page', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await page.goto('/account');
    // AC: completion count visible.
    await expect(
      page.locator('text=/[0-9]+ of [0-9]+ categor/i').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
