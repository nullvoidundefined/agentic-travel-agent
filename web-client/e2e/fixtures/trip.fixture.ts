import { type Page, expect } from '@playwright/test';

export async function createTestTrip(page: Page): Promise<string> {
  await page.goto('/trips');
  await page.getByRole('link', { name: /new trip/i }).click();
  await page.waitForURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });
  const url = page.url();
  const tripId = url.split('/trips/')[1];
  return tripId;
}

export async function sendChatMessage(
  page: Page,
  message: string,
): Promise<void> {
  const input = page.getByPlaceholder(/plan your trip|message/i);
  await input.fill(message);
  await page.getByRole('button', { name: 'Send' }).click();
}

export async function waitForAssistantResponse(page: Page): Promise<void> {
  // Wait for the VOYAGER role badge to appear for the latest message
  await page
    .locator('text=VOYAGER')
    .last()
    .waitFor({ state: 'visible', timeout: 30000 });
}
