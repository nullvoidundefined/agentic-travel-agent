'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatNode, SSEEvent } from '@voyager/shared-types';

interface UseSSEChatOptions {
  tripId: string;
  onComplete?: () => void;
}

interface UseSSEChatReturn {
  sendMessage: (message: string) => Promise<void>;
  isSending: boolean;
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
  error: string | null;
  clearError: () => void;
}

export function useSSEChat({
  tripId,
  onComplete,
}: UseSSEChatOptions): UseSSEChatReturn {
  const [isSending, setIsSending] = useState(false);
  const [streamingNodes, setStreamingNodes] = useState<ChatNode[]>([]);
  const [toolProgress, setToolProgress] = useState<ChatNode[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case 'node':
        setStreamingNodes((prev) => [...prev, event.node]);
        break;

      case 'text_delta':
        setStreamingText((prev) => prev + event.content);
        break;

      case 'tool_progress':
        setToolProgress((prev) => {
          const existing = prev.findIndex(
            (n) => n.type === 'tool_progress' && n.tool_id === event.tool_id,
          );
          const node: ChatNode = {
            type: 'tool_progress',
            tool_name: event.tool_name ?? '',
            tool_id: event.tool_id,
            status: event.status,
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = node;
            return next;
          }
          return [...prev, node];
        });
        break;

      case 'done':
        // Cleanup is handled in the finally block
        break;

      case 'error':
        setError(
          event.error ||
            'The agent ran into a problem mid-response. Try sending the message again.',
        );
        break;
    }
  }

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isSending) return;

      setIsSending(true);
      setStreamingNodes([]);
      setToolProgress([]);
      setStreamingText('');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        const res = await fetch(`${API_BASE}/trips/${tripId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              // Attach the event type from the SSE envelope if not in the payload
              if (!event.type) {
                (event as Record<string, unknown>).type = eventType;
              }
              handleEvent(event);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('SSE chat error:', err);
          setError(
            'Could not reach the agent. Check your connection and try again.',
          );
        }
      } finally {
        try {
          await reader?.cancel();
        } catch {
          // ignore cancel errors
        }
        abortControllerRef.current = null;
        // Invalidate queries first so the refetched data is ready before we
        // clear the streaming state. This prevents a blank-gap flash where the
        // streaming message disappears but the persisted message has not yet
        // loaded — especially noticeable on fast streams where tool_progress
        // indicators would flash and vanish before the user could read them.
        await queryClient.invalidateQueries({ queryKey: ['messages', tripId] });
        await queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
        void queryClient.invalidateQueries({
          queryKey: ['trips'],
          exact: true,
        });
        setIsSending(false);
        setToolProgress([]);
        setStreamingNodes([]);
        setStreamingText('');
        onComplete?.();
      }
    },
    [tripId, queryClient, isSending, onComplete],
  );

  return {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
    error,
    clearError,
  };
}
