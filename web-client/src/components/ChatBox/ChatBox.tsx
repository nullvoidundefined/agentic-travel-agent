'use client';

import { type FormEvent, useCallback, useState } from 'react';

import { get, put } from '@/lib/api';
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

  // Suppress booking actions when the most recent assistant message contains
  // selectable tile nodes — the SelectableCardGroup "Confirm Selection" button
  // serves as the confirmation mechanism in that case.
  const lastAssistantMessage = serverMessages
    ?.slice()
    .reverse()
    .find((m) => m.role === 'assistant');
  const hasActiveTileSelection =
    lastAssistantMessage?.nodes.some(
      (n) =>
        (n.type === 'flight_tiles' ||
          n.type === 'hotel_tiles' ||
          n.type === 'car_rental_tiles' ||
          n.type === 'experience_tiles') &&
        n.selectable,
    ) ?? false;

  const showBookingActions =
    hasFlights &&
    tripStatus === 'planning' &&
    !isSending &&
    !hasActiveTileSelection;
  const isBooked = tripStatus === 'saved';

  const handleSend = useCallback(
    (msg: string) => {
      if (!msg.trim()) return;

      // Intercept booking confirmation — open modal instead of sending chat message
      if (msg.trim() === 'Confirm booking') {
        onBookTrip?.();
        return;
      }

      // Auto-save any form data that hasn't been submitted yet.
      // If the user typed in the chat input while the trip details form has values,
      // we treat that data as canonical and persist it before sending the message.
      const formData: Record<string, unknown> = {};
      const formFields = [
        { id: 'destination', key: 'destination' },
        { id: 'origin', key: 'origin' },
        { id: 'departure_date', key: 'departure_date' },
        { id: 'return_date', key: 'return_date' },
        { id: 'budget', key: 'budget_total', transform: Number },
        { id: 'travelers', key: 'travelers', transform: Number },
      ] as const;

      for (const field of formFields) {
        const el = document.getElementById(field.id) as HTMLInputElement | null;
        if (el?.value?.trim()) {
          formData[field.key] =
            'transform' in field ? field.transform(el.value) : el.value;
        }
      }

      if (Object.keys(formData).length > 0) {
        put(`/trips/${tripId}`, formData).catch((err) =>
          console.error('Failed to auto-save form data:', err),
        );
      }

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
    [sendMessage, serverMessages?.length, onBookTrip, tripId],
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

  const handleFormSubmit = useCallback(
    async (structuredData: Record<string, string>, displayMessage: string) => {
      const tripUpdate: Record<string, unknown> = {};
      if (structuredData.destination)
        tripUpdate.destination = structuredData.destination;
      if (structuredData.origin) tripUpdate.origin = structuredData.origin;
      if (structuredData.departure_date)
        tripUpdate.departure_date = structuredData.departure_date;
      if (structuredData.return_date)
        tripUpdate.return_date = structuredData.return_date;
      if (structuredData.budget)
        tripUpdate.budget_total = Number(structuredData.budget);
      if (structuredData.travelers)
        tripUpdate.travelers = Number(structuredData.travelers);

      try {
        await put(`/trips/${tripId}`, tripUpdate);
        void queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      } catch (err) {
        console.error('Failed to update trip:', err);
      }

      handleSend(displayMessage);
    },
    [tripId, queryClient, handleSend],
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
        onFormSubmit={handleFormSubmit}
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
          placeholder={
            isBooked
              ? 'Trip booked! Enjoy your adventure.'
              : 'Ask the agent to plan your trip...'
          }
          aria-label={
            isBooked
              ? 'Trip booked! Enjoy your adventure.'
              : 'Ask the agent to plan your trip...'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending || isBooked}
        />
        <button
          type='submit'
          className={styles.sendButton}
          disabled={isSending || isBooked || !input.trim()}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
