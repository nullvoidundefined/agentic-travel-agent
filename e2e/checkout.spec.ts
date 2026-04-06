/**
 * Checkout and booking confirmation: US-25 through US-28.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { defaultSelections, seedTripSelections } from './fixtures/test-trips';
import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { sendMessage } from './helpers/chat';
import { createTrip } from './helpers/trip';

function extractTripId(url: string): string {
  const match = url.match(/\/trips\/([a-f0-9-]+)/i);
  if (!match?.[1]) {
    throw new Error(`Could not extract trip id from url: ${url}`);
  }
  return match[1];
}

test.describe('Checkout', () => {
  test('US-25: open booking confirmation modal', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    // Send any chat message so the mock Anthropic emits its
    // iteration 2 format_response containing a "Confirm booking"
    // quick reply chip.
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    const confirmChip = page
      .locator('[role="group"][aria-label="Quick replies"]')
      .getByRole('button', { name: 'Confirm booking' });
    await expect(confirmChip).toBeVisible({ timeout: 30_000 });
    await confirmChip.click();
    // ChatBox.handleSend intercepts the literal "Confirm booking"
    // message and calls onBookTrip directly without sending it
    // through the chat. The trip page opens BookingConfirmation.
    // The modal renders TWO h2 elements with "Save Your Itinerary
    // for" text (one in the image overlay, one as the body title).
    // Use .first() to dodge strict-mode multi-match.
    await expect(
      page.getByRole('heading', { name: /Save Your Itinerary for/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('US-26: review itemized breakdown', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    const tripId = extractTripId(page.url());
    // ENG-17: seed the trip with a canonical happy-path selection
    // set (flight, hotel, car rental, experience) via the test-only
    // endpoint. This bypasses the agent loop and the multi-turn
    // chat flow. See e2e/fixtures/test-trips.ts.
    await seedTripSelections(page, tripId, defaultSelections());
    // Reload so the trip page re-fetches with the new selections.
    await page.reload();
    // Send any chat message to produce the "Confirm booking"
    // quick reply chip.
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    await page
      .locator('[role="group"][aria-label="Quick replies"]')
      .getByRole('button', { name: 'Confirm booking' })
      .click();
    // Scope every assertion to the booking confirmation dialog
    // so "Flights" / "Hotels" headings do not collide with any
    // tile-group headings the chat area may also render.
    const dialog = page.getByRole('dialog', { name: 'Booking confirmation' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByRole('heading', { name: 'Flights' }),
    ).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Hotels' })).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Car Rentals' }),
    ).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: 'Experiences' }),
    ).toBeVisible();
    // The flight line item from defaultSelections() has airline
    // "Delta" and flight number "DL100". Verify the line item
    // text appears inside the dialog.
    await expect(dialog.getByText(/Delta DL100/i).first()).toBeVisible();
  });

  test('US-27: confirm and book the trip', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);
    const tripId = extractTripId(page.url());
    await seedTripSelections(page, tripId, defaultSelections());
    await page.reload();
    await sendMessage(
      page,
      'Plan a 3-day trip to San Francisco from Denver next month, $2500 budget, 2 travelers',
    );
    await page
      .locator('[role="group"][aria-label="Quick replies"]')
      .getByRole('button', { name: 'Confirm booking' })
      .click();
    await expect(
      page.getByRole('heading', { name: /Save Your Itinerary for/i }).first(),
    ).toBeVisible({ timeout: 5_000 });
    // Click "Save itinerary" to trigger handleConfirmBooking.
    // The handler PUTs status=saved and optimistically updates
    // the React Query cache.
    await page.getByRole('button', { name: 'Save itinerary' }).click();
    // Verify the trip status actually changed via the API.
    const resp = await page.request.get(
      `http://localhost:3001/trips/${tripId}`,
      { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    );
    expect(resp.status()).toBeLessThan(400);
    const body = (await resp.json()) as { trip: { status: string } };
    expect(body.trip.status).toBe('saved');
  });

  test('US-28: booked trip locked state', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    // Create a trip then PUT status=saved via the API to
    // simulate a completed booking. The chat input should
    // become disabled and show the locked placeholder.
    await createTrip(page);
    const tripId = extractTripId(page.url());
    // Use the page's request context so the session cookie is
    // included in the PUT.
    const putResponse = await page.request.put(
      `http://localhost:3001/trips/${tripId}`,
      {
        data: { status: 'saved' },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    expect(putResponse.status()).toBeLessThan(400);

    // Reload the trip page so the status update propagates.
    await page.reload();
    const lockedPlaceholder = 'Trip booked! Enjoy your adventure.';
    await expect(
      page.locator(`input[aria-label="${lockedPlaceholder}"]`),
    ).toBeDisabled({ timeout: 10_000 });
  });
});
