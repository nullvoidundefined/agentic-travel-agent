/**
 * Page-object helpers for the chat flow on a trip detail page.
 */
import { type Page, expect } from '@playwright/test';

export async function sendMessage(page: Page, text: string): Promise<void> {
  // The actual ChatBox input has placeholder "Ask the agent to plan
  // your trip..." and matching aria-label. The earlier "message"
  // grep never matched anything in the rendered DOM, so the
  // helper timed out at 30s on every chat-flow spec.
  const input = page
    .locator(
      'input[placeholder*="Ask the agent" i], input[aria-label*="Ask the agent" i], textarea[placeholder*="Ask the agent" i]',
    )
    .first();
  await input.fill(text);
  await page
    .locator('form')
    .filter({ has: input })
    .locator('button[type="submit"]')
    .first()
    .click();
}

export async function waitForAgentResponse(
  page: Page,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 30_000;
  await expect(
    page.locator('[data-role="assistant"], [data-author="agent"]').first(),
  ).toBeVisible({ timeout });
}

export async function assertToolCallIndicator(
  page: Page,
  toolName: string,
): Promise<void> {
  await expect(
    page.locator(`text=/searching ${toolName}|${toolName}/i`).first(),
  ).toBeVisible({ timeout: 15_000 });
}

export async function selectTileCard(
  page: Page,
  cardSelector: string,
): Promise<void> {
  await page.click(cardSelector);
}

export async function assertStreamingText(
  page: Page,
  expectedSubstring: string,
): Promise<void> {
  await expect(page.locator(`text=${expectedSubstring}`).first()).toBeVisible({
    timeout: 15_000,
  });
}
