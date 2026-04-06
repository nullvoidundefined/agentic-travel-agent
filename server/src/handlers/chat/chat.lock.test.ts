import { getActiveConversationCount } from 'app/handlers/chat/chat.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ENG-02 backfill: regression tests for commit `7ad2249`
 * "fix: add conversation lock to prevent concurrent agent loops"
 * which shipped with no test.
 *
 * These tests document that:
 * 1. The chat handler exports getActiveConversationCount so the
 *    rest of the system can observe lock state
 * 2. The handler's source code contains the explicit lock check
 *    pattern so a future refactor that removes it will trip this
 *    guard
 * 3. The 409 conflict path is wired through ApiError
 *
 * A full concurrency test (two overlapping requests to the same
 * conversation, asserting the second gets 409) requires deferred-
 * promise test orchestration and a mocked agent loop that hangs;
 * that is a follow-up ENG-02-b test. These content-level guards
 * are the cheap regression protection that catches the most likely
 * regression, which is someone deleting the lock check during a
 * refactor.
 */

const chatSource = readFileSync(resolve(__dirname, 'chat.ts'), 'utf-8');

describe('chat handler conversation lock (ENG-02 backfill)', () => {
  it('exports getActiveConversationCount for observability', () => {
    expect(typeof getActiveConversationCount).toBe('function');
  });

  it('initial active conversation count is 0', () => {
    expect(getActiveConversationCount()).toBe(0);
  });

  it('handler source contains the activeConversations lock check', () => {
    expect(chatSource).toMatch(/activeConversations\.has\(/);
  });

  it('handler source adds the conversation to the lock set', () => {
    expect(chatSource).toMatch(/activeConversations\.add\(/);
  });

  it('handler source removes the conversation from the lock on close', () => {
    expect(chatSource).toMatch(/activeConversations\.delete\(/);
  });

  it('handler source throws 409 CONFLICT when the lock is already held', () => {
    expect(chatSource).toMatch(/409[\s\S]{0,50}CONFLICT/);
  });
});
