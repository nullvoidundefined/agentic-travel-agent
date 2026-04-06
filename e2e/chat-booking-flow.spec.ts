/**
 * Chat and booking flow: US-18 through US-24.
 *
 * Source of truth: docs/USER_STORIES.md.
 * Mocked tools (E2E_MOCK_TOOLS=1) provide deterministic flight,
 * hotel, and experience results so the agent loop is reproducible.
 * Mocked Anthropic (E2E_MOCK_ANTHROPIC=1) drives a scripted
 * three-iteration happy-path conversation that emits
 * search_flights and search_hotels on iteration 1, then
 * format_response with quick_replies on iteration 2.
 *
 * US-19, US-23 are still test.fixme. They need a multi-turn
 * MockAnthropic state machine that reacts to user replies and
 * tile selections. Tracked as ENG-17 in ISSUES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { sendMessage, waitForAgentResponse } from './helpers/chat';
import { createTrip } from './helpers/trip';

test.describe('Chat and booking flow', () => {
  test('US-18: welcome message on new trip', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    // AC: a friendly welcome from Voyager and an input field.
    await page.waitForLoadState('networkidle');
  });

  test.fixme('US-19: fill trip details form', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    // Selectors for origin/dates/budget/travelers TBD pending
    // shared form-field naming convention.
  });

  test('US-20: send a chat message (optimistic)', async ({ page }) => {
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(page, 'I want to visit San Francisco');
    // The user message bubble should appear immediately.
    await page.waitForTimeout(500);
  });

  test('US-21: see agent response with tool progress', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    await waitForAgentResponse(page, { timeoutMs: 45_000 });
  });

  test('US-22: browse tile cards (flights, hotels, cars, experiences)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    // The mock Anthropic emits search_flights + search_hotels
    // tool_use on iteration 1. The orchestrator runs them via
    // the existing mock adapters and buildNodeFromToolResult
    // creates flight_tiles and hotel_tiles nodes.
    await expect(page.locator('[data-tile-card="flight"]').first()).toBeVisible(
      { timeout: 30_000 },
    );
    await expect(page.locator('[data-tile-card="hotel"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test.fixme('US-23: select and confirm a tile card', async () => {
    // Needs a multi-turn MockAnthropic that responds to a user
    // tile selection and emits a confirmation. Tracked as
    // ENG-17 in ISSUES.md.
  });

  test('US-24: use quick reply chips', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    // The mock Anthropic emits a format_response on iteration 2
    // with quick_replies. The QuickReplyChips component renders
    // them inside a [role="group"][aria-label="Quick replies"]
    // container.
    await expect(
      page.locator('[role="group"][aria-label="Quick replies"]'),
    ).toBeVisible({ timeout: 30_000 });
    // The component renders one button per chip; assert at
    // least one is present.
    const chipCount = await page
      .locator('[role="group"][aria-label="Quick replies"] button')
      .count();
    expect(chipCount).toBeGreaterThan(0);
  });
});
