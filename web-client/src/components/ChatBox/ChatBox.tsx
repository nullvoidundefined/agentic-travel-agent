'use client';

import { type FormEvent, useCallback, useMemo, useRef, useState } from 'react';

import { Toast } from '@/components/Toast/Toast';
import { get, post, put } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '@voyager/shared-types';

import styles from './ChatBox.module.scss';
import { VirtualizedChat } from './VirtualizedChat';
import { useSSEChat } from './useSSEChat';

interface ChatBoxProps {
  tripId: string;
  hasFlights?: boolean;
  hasHotels?: boolean;
  experiencesEmpty?: boolean;
  carRentalsEmpty?: boolean;
  tripStatus?: string;
  onBookTrip?: () => void;
}

export function ChatBox({
  tripId,
  hasFlights,
  hasHotels,
  experiencesEmpty,
  carRentalsEmpty,
  tripStatus,
  onBookTrip,
}: ChatBoxProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [pendingUserMessage, setPendingUserMessage] =
    useState<ChatMessage | null>(null);
  const skipFormAutoSave = useRef(false);

  const { data: serverMessages } = useQuery({
    queryKey: ['messages', tripId],
    queryFn: () =>
      get<{ messages: ChatMessage[] }>(`/trips/${tripId}/messages`).then(
        (r) => r.messages,
      ),
  });

  // Merge server messages with optimistic pending user message
  const allMessages: ChatMessage[] = useMemo(
    () => [
      ...(serverMessages ?? []),
      ...(pendingUserMessage ? [pendingUserMessage] : []),
    ],
    [serverMessages, pendingUserMessage],
  );

  const {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
    error: sseError,
    clearError: clearSseError,
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
    hasHotels &&
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
      if (!skipFormAutoSave.current) {
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
          const el = document.getElementById(
            field.id,
          ) as HTMLInputElement | null;
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
      }
      skipFormAutoSave.current = false;

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

      skipFormAutoSave.current = true;
      handleSend(displayMessage);
    },
    [tripId, queryClient, handleSend],
  );

  const handleSelectItem = useCallback(
    async (type: string, data: Record<string, unknown>) => {
      try {
        await post(`/trips/${tripId}/selections`, { type, data });
        void queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      } catch (err) {
        console.error('Failed to persist selection:', err);
      }
    },
    [tripId, queryClient],
  );

  // Invalidate trips query after booking-related actions
  const handleBookTrip = useCallback(() => {
    onBookTrip?.();
    queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
  }, [onBookTrip, queryClient, tripId]);

  // B6: when booking criteria are met, append a client-only booking_prompt
  // virtual node so the inline tile renders as the last assistant message.
  const messagesWithBookingPrompt = useMemo<ChatMessage[]>(() => {
    if (!showBookingActions) return allMessages;
    const promptNode = {
      type: 'booking_prompt' as const,
      experiences_empty: experiencesEmpty ?? true,
      car_rentals_empty: carRentalsEmpty ?? true,
    };
    const promptMessage: ChatMessage = {
      id: '__booking_prompt__',
      role: 'assistant',
      nodes: [promptNode],
      sequence: allMessages.length + 1,
      created_at: new Date().toISOString(),
    };
    return [...allMessages, promptMessage];
  }, [allMessages, showBookingActions, experiencesEmpty, carRentalsEmpty]);

  return (
    <div className={styles.chatBox}>
      {sseError && <Toast message={sseError} onClose={clearSseError} />}
      <VirtualizedChat
        messages={messagesWithBookingPrompt}
        streamingNodes={streamingNodes}
        toolProgress={toolProgress}
        streamingText={streamingText}
        isSending={isSending}
        onQuickReply={handleSend}
        onSelectItem={handleSelectItem}
        onFormSubmit={handleFormSubmit}
        onBookNow={handleBookTrip}
      />

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
