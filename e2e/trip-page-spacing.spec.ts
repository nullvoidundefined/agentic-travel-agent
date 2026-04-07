/**
 * Trip detail page spacing regression guard (B5).
 *
 * The chat section used to render flush against the Flights heading
 * because `.chatSection` had no `margin-bottom` and `.itinerary` had
 * no `margin-top`. This spec asserts a minimum 32px vertical gap
 * between the bottom of the chat section and the top of the Flights
 * heading, plus a screenshot snapshot of the gap region for visual
 * regression protection.
 *
 * The trip detail page only renders the Flights section when the
 * trip record has at least one flight. Rather than driving the
 * full chat-and-book flow (slow, brittle), this spec intercepts
 * the GET /trips/:id response and injects a synthetic flight so
 * the conditional renders deterministically.
 */
import { expect, test } from '@playwright/test';

import { newUser, seedUser } from './fixtures/test-users';
import { login } from './helpers/auth';
import { createTrip } from './helpers/trip';

test.describe('Trip detail page spacing (B5)', () => {
  test('chat section and Flights heading have a visible vertical gap', async ({
    page,
  }) => {
    test.setTimeout(45_000);

    const user = await seedUser(newUser());
    await login(page, user);
    await createTrip(page);

    // Capture the trip id from the URL after createTrip resolves.
    const match = page
      .url()
      .match(
        /\/trips\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
      );
    if (!match) {
      throw new Error(`Could not extract trip id from URL: ${page.url()}`);
    }
    const tripId = match[1];

    // Intercept the trip fetch and inject a synthetic flight so
    // the Flights section renders. The interception is set up
    // AFTER createTrip so the create-trip POST is unaffected; the
    // reload below triggers a fresh GET that the route catches.
    // Match the API call only, not the Next.js page navigation
    // (which is also at /trips/:id but on port 3000 and returns
    // HTML). The API runs on :3001.
    await page.route(`http://localhost:3001/trips/${tripId}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = await response.json();
      const trip = body.trip;
      const injectedFlight = {
        id: 'b5-test-flight',
        origin: 'DEN',
        destination: 'SFO',
        airline: 'United',
        flight_number: 'UA123',
        price: 350,
        currency: 'USD',
        departure_time: '2026-06-01T09:00:00.000Z',
      };
      const patchedBody = {
        ...body,
        trip: {
          ...trip,
          flights: [injectedFlight, ...(trip.flights ?? [])],
        },
      };
      await route.fulfill({
        response,
        json: patchedBody,
      });
    });

    await page.reload();

    // Wait for both anchors. The chat heading is "Chat with Voyager"
    // (APP_NAME = 'Voyager' in web-client/src/lib/constants.ts).
    // The Flights section heading is the literal h2 inside the
    // first .itinerary block.
    const chatHeading = page
      .locator('h2', { hasText: /Chat with Voyager/i })
      .first();
    const flightsHeading = page.locator('h2', { hasText: 'Flights' }).first();
    await expect(chatHeading).toBeVisible({ timeout: 15_000 });
    await expect(flightsHeading).toBeVisible({ timeout: 15_000 });

    // Measure the chat SECTION container, not just the heading,
    // because the gap we care about is between the bottom of the
    // entire chat module and the Flights heading above the
    // itinerary list.
    const chatBox = await chatHeading.evaluate((el) => {
      // The chatSection wrapper is the heading's parent div.
      const container = el.parentElement;
      const rect = (container ?? el).getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    });

    const flightsBox = await flightsHeading.boundingBox();
    if (!flightsBox) {
      throw new Error('Could not measure Flights heading bounding box');
    }

    const gap = flightsBox.y - (chatBox.y + chatBox.height);
    expect(gap).toBeGreaterThanOrEqual(32);

    // Scroll the Flights heading into view so the clip rectangle
    // (computed against the viewport) lands inside the screenshot.
    // After scrolling, re-measure the bounding boxes because the
    // viewport-relative coordinates change.
    await flightsHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const chatBoxAfter = await chatHeading.evaluate((el) => {
      const container = el.parentElement;
      const rect = (container ?? el).getBoundingClientRect();
      return { y: rect.y, height: rect.height };
    });
    const flightsBoxAfter = await flightsHeading.boundingBox();
    if (!flightsBoxAfter) {
      throw new Error('Could not re-measure Flights heading after scroll');
    }
    const gapAfter = flightsBoxAfter.y - (chatBoxAfter.y + chatBoxAfter.height);

    const viewportWidth = page.viewportSize()?.width ?? 1280;
    const clipY = Math.max(0, chatBoxAfter.y + chatBoxAfter.height - 20);
    const clipHeight = Math.max(40, gapAfter + 80);
    await expect(page).toHaveScreenshot('trip-page-chat-itinerary-gap.png', {
      clip: {
        x: 0,
        y: clipY,
        width: viewportWidth,
        height: clipHeight,
      },
      maxDiffPixelRatio: 0.02,
    });
  });
});
