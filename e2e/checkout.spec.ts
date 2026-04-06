/**
 * Checkout and booking confirmation: US-25 through US-28.
 *
 * Source of truth: docs/USER_STORIES.md.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { sendMessage } from './helpers/chat';
import { createTrip } from './helpers/trip';

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

  test.fixme('US-26: review itemized breakdown', async () => {
    // Needs a trip that has selected_flight, selected_hotel,
    // selected_car_rental, and selected_experiences populated
    // before the modal opens. Either via the API
    // (PUT /trips/:id with the selection fields) or by
    // walking through the chat tile selection flow. Tracked
    // alongside US-23 in ENG-17.
  });

  test.fixme('US-27: confirm and book the trip', async () => {
    // Depends on US-26 setup (trip with selections). Once the
    // modal renders with line items, clicking the "Save
    // itinerary" button calls handleConfirmBooking which
    // PUTs status=saved. Tracked in ENG-17.
  });

  test('US-28: booked trip locked state', async ({ page }) => {
    test.setTimeout(60_000);
    const user = await seedUser(newUser());
    await login(page, user);
    // Create a trip then PUT status=saved via the API to
    // simulate a completed booking. The chat input should
    // become disabled and show the locked placeholder.
    await createTrip(page);
    const url = page.url();
    const tripIdMatch = url.match(/\/trips\/([a-f0-9-]+)/i);
    if (!tripIdMatch?.[1]) {
      test.skip(true, 'unable to read trip id from URL');
    }
    const tripId = tripIdMatch?.[1] ?? '';
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
