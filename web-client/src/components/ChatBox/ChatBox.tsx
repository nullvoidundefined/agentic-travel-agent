'use client';

import { type FormEvent, useCallback, useState } from 'react';

import { get } from '@/lib/api';
import type { ChatMessage } from '@agentic-travel-agent/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import styles from './ChatBox.module.scss';
import { VirtualizedChat } from './VirtualizedChat';
import { useSSEChat } from './useSSEChat';

interface ChatBoxProps {
  tripId: string;
  hasFlights?: boolean;
  tripStatus?: string;
  onBookTrip?: () => void;
}

export function ChatBox({
  tripId,
  hasFlights,
  tripStatus,
  onBookTrip,
}: ChatBoxProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [pendingUserMessage, setPendingUserMessage] =
    useState<ChatMessage | null>(null);

  const { data: serverMessages } = useQuery({
    queryKey: ['messages', tripId],
    queryFn: () =>
      get<{ messages: ChatMessage[] }>(`/trips/${tripId}/messages`).then(
        (r) => r.messages,
      ),
  });

  // Merge server messages with optimistic pending user message
  const allMessages: ChatMessage[] = [
    ...(serverMessages ?? []),
    ...(pendingUserMessage ? [pendingUserMessage] : []),
  ];

  const {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
  } = useSSEChat({ tripId, onComplete: () => setPendingUserMessage(null) });

  const showBookingActions =
    hasFlights && tripStatus === 'planning' && !isSending;

  const handleSend = useCallback(
    (msg: string) => {
      if (!msg.trim()) return;
      // Optimistic: show user message immediately
      setPendingUserMessage({
        id: `pending-${Date.now()}`,
        role: 'user',
        nodes: [{ type: 'text', content: msg }],
        sequence: (serverMessages?.length ?? 0) + 1,
        created_at: new Date().toISOString(),
      });
      sendMessage(msg);
    },
    [sendMessage, serverMessages?.length],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const msg = input.trim();
      if (!msg) return;
      setInput('');
      handleSend(msg);
    },
    [input, handleSend],
  );

  // Invalidate trips query after booking-related actions
  const handleBookTrip = useCallback(() => {
    onBookTrip?.();
    queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
  }, [onBookTrip, queryClient, tripId]);

  return (
    <div className={styles.chatBox}>
      <VirtualizedChat
        messages={allMessages}
        streamingNodes={streamingNodes}
        toolProgress={toolProgress}
        streamingText={streamingText}
        isSending={isSending}
        onQuickReply={handleSend}
      />

      {showBookingActions && (
        <div className={styles.bookingActions}>
          <button
            type='button'
            className={styles.bookButton}
            onClick={handleBookTrip}
          >
            Book This Trip
          </button>
          <button
            type='button'
            className={styles.tryAgainButton}
            onClick={() =>
              handleSend(
                "I'd like to make some changes to the itinerary. What would you suggest adjusting?",
              )
            }
          >
            Try Again
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type='text'
          className={styles.input}
          placeholder='Ask the agent to plan your trip...'
          aria-label='Ask the agent to plan your trip...'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
        />
        <button
          type='submit'
          className={styles.sendButton}
          disabled={isSending || !input.trim()}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
