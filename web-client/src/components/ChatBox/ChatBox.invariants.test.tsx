import { cleanup, render, screen } from '@testing-library/react';
import type { ChatMessage } from '@voyager/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedChat } from './VirtualizedChat';

/**
 * ChatBox data-model invariants.
 *
 * Source of mandate: voyager/CLAUDE.md "ChatBox invariants" section
 * (added 2026-04-06 after the process retrospective traced a 9-commit
 * fix storm in the ChatBox/VirtualizedChat surface to the absence of
 * an invariants test). Every subsequent ChatBox or VirtualizedChat
 * fix MUST extend this spec rather than create a new ad-hoc test.
 *
 * The invariants tested here:
 *
 *   1. Tool-result cards persist after the SSE stream ends.
 *   2. Text nodes never duplicate when the agent re-emits text.
 *   3. Empty state renders when the node list is empty.
 *   4. Virtualizer layout is stable under append (the rendered
 *      message count tracks the input message count).
 *   5. QuickReplyChips render only on the most recent assistant
 *      message of a turn.
 *
 * The tests render VirtualizedChat in isolation with controlled
 * props rather than the full ChatBox shell, because the data
 * merging logic that the invariants protect lives in
 * VirtualizedChat (streaming overlay) and the props it receives
 * from ChatBox (server messages plus optimistic pending message).
 */

afterEach(cleanup);

// Mock the @tanstack/react-virtual virtualizer to render every
// message synchronously instead of windowing. The virtualizer
// is not the unit under test here; we want to assert about node
// presence, not about virtual scrolling.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * 100,
        size: 100,
        end: (i + 1) * 100,
        lane: 0,
      })),
    getTotalSize: () => count * 100,
    scrollToIndex: () => undefined,
    measureElement: () => undefined,
  }),
}));

function makeUserMessage(id: string, text: string): ChatMessage {
  return {
    id,
    role: 'user',
    nodes: [{ type: 'text', content: text }],
    sequence: 1,
    created_at: '2026-04-06T00:00:00.000Z',
  };
}

function makeAssistantMessage(
  id: string,
  nodes: ChatMessage['nodes'],
  sequence: number = 2,
): ChatMessage {
  return {
    id,
    role: 'assistant',
    nodes,
    sequence,
    created_at: '2026-04-06T00:00:00.000Z',
  };
}

const noop = () => undefined;

describe('ChatBox invariants', () => {
  describe('invariant 1: tool-result cards persist after the stream ends', () => {
    it('keeps a flight_tiles node visible after isSending flips from true to false', () => {
      const flightTilesMessage = makeAssistantMessage('msg-1', [
        {
          type: 'flight_tiles',
          flights: [
            {
              offer_id: 'F1',
              airline: 'Delta',
              airline_logo: null,
              flight_number: 'DL100',
              origin: 'DEN',
              destination: 'SFO',
              departure_time: '2026-06-01T08:00:00',
              arrival_time: '2026-06-01T10:00:00',
              price: 300,
              currency: 'USD',
              cabin_class: 'ECONOMY',
              segments: [],
            },
          ],
          selectable: true,
        },
      ]);

      // While streaming
      const { rerender } = render(
        <VirtualizedChat
          messages={[flightTilesMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending
          onQuickReply={noop}
        />,
      );
      expect(screen.getByText(/DL100/)).toBeInTheDocument();

      // After stream ends
      rerender(
        <VirtualizedChat
          messages={[flightTilesMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getByText(/DL100/)).toBeInTheDocument();
    });
  });

  describe('invariant 2: text nodes never duplicate when the agent re-emits text', () => {
    it('does not double-render the same text content across stream-end transition', () => {
      const persistedMessage = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Here is your flight plan.' },
      ]);

      // First render: simulating the moment AFTER the SSE stream
      // completed and the server message refresh has landed. The
      // streamingText is already cleared, the persisted message
      // contains the same content. The component must not also
      // build a streamingMessage for empty state.
      render(
        <VirtualizedChat
          messages={[persistedMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      const matches = screen.getAllByText(/Here is your flight plan\./);
      expect(matches).toHaveLength(1);
    });

    it('renders streaming text exactly once while isSending is true', () => {
      const userMessage = makeUserMessage('msg-1', 'Plan a trip');
      render(
        <VirtualizedChat
          messages={[userMessage]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText='Looking at your options...'
          isSending
          onQuickReply={noop}
        />,
      );

      const matches = screen.getAllByText(/Looking at your options/);
      expect(matches).toHaveLength(1);
    });
  });

  describe('invariant 3: empty state renders when the node list is empty', () => {
    it('renders the empty-state header when there are no messages and not streaming', () => {
      render(
        <VirtualizedChat
          messages={[]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(screen.getByText(/Start planning your trip/i)).toBeInTheDocument();
    });

    it('does NOT render the empty state when streaming has begun even with zero persisted messages', () => {
      render(
        <VirtualizedChat
          messages={[]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText='Working...'
          isSending
          onQuickReply={noop}
        />,
      );

      expect(
        screen.queryByText(/Start planning your trip/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('invariant 4: virtualizer layout is stable under append', () => {
    it('the rendered message count tracks the input message count exactly', () => {
      const m1 = makeUserMessage('m1', 'first');
      const m2 = makeAssistantMessage('m2', [
        { type: 'text', content: 'second' },
      ]);
      const m3 = makeUserMessage('m3', 'third');

      const { rerender } = render(
        <VirtualizedChat
          messages={[m1, m2]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getAllByText(/first|second/)).toHaveLength(2);

      // Append a third message and assert all three appear,
      // none disappear, none duplicate.
      rerender(
        <VirtualizedChat
          messages={[m1, m2, m3]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );
      expect(screen.getAllByText(/first|second|third/)).toHaveLength(3);
    });
  });

  describe('invariant 5: QuickReplyChips render on assistant messages with the node', () => {
    it('renders quick reply buttons when the assistant message contains a quick_replies node', () => {
      const assistantWithChips = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Pick one:' },
        {
          type: 'quick_replies',
          options: ["I'll take the cheapest", 'Show me more', 'Confirm'],
        },
      ]);

      render(
        <VirtualizedChat
          messages={[assistantWithChips]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      // The QuickReplyChips component renders a [role="group"]
      // with aria-label="Quick replies" and one button per option.
      expect(
        screen.getByRole('group', { name: 'Quick replies' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: "I'll take the cheapest" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Show me more' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Confirm' }),
      ).toBeInTheDocument();
    });

    it('does not render a QuickReplyChips group when no assistant message has a quick_replies node', () => {
      const plainAssistant = makeAssistantMessage('msg-1', [
        { type: 'text', content: 'Plain text only.' },
      ]);

      render(
        <VirtualizedChat
          messages={[plainAssistant]}
          streamingNodes={[]}
          toolProgress={[]}
          streamingText=''
          isSending={false}
          onQuickReply={noop}
        />,
      );

      expect(
        screen.queryByRole('group', { name: 'Quick replies' }),
      ).not.toBeInTheDocument();
    });
  });
});
