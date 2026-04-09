'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { APP_NAME } from '@/lib/constants';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ChatMessage, ChatNode } from '@voyager/shared-types';

import { NodeRenderer } from './NodeRenderer';
import styles from './VirtualizedChat.module.scss';
import { ChatProgressBar } from './widgets/ChatProgressBar';

interface VirtualizedChatProps {
  messages: ChatMessage[];
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
  isSending: boolean;
  onQuickReply: (text: string) => void;
  onSelectItem?: (type: string, data: Record<string, unknown>) => void;
  onBookNow?: () => void;
  onFormSubmit?: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
}

// Height estimates by node type for initial virtualized sizing
const NODE_HEIGHT_ESTIMATES: Partial<Record<ChatNode['type'], number>> = {
  text: 60,
  flight_tiles: 240,
  hotel_tiles: 240,
  car_rental_tiles: 240,
  experience_tiles: 200,
  travel_plan_form: 300,
  itinerary: 200,
  advisory: 80,
  weather_forecast: 120,
  budget_bar: 48,
  quick_replies: 48,
  tool_progress: 32,
  booking_prompt: 96,
};

const TOOL_LABELS: Record<string, string> = {
  search_flights: 'Searching flights',
  search_hotels: 'Searching hotels',
  search_car_rentals: 'Searching car rentals',
  search_experiences: 'Finding experiences',
  calculate_remaining_budget: 'Calculating budget',
  get_destination_info: 'Looking up destination',
  format_response: 'Assembling response',
};

function getToolLabelForName(toolName: string): string {
  if (!toolName) return 'Working';
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}

function estimateMessageHeight(nodes: ChatNode[]): number {
  if (nodes.length === 0) return 40;
  return nodes.reduce(
    (sum, node) => sum + (NODE_HEIGHT_ESTIMATES[node.type] ?? 60),
    16, // base padding
  );
}

export function VirtualizedChat({
  messages,
  streamingNodes,
  toolProgress,
  streamingText,
  isSending,
  onQuickReply,
  onSelectItem,
  onBookNow,
  onFormSubmit,
}: VirtualizedChatProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Build a temporary streaming message to append during active turns
  const streamingMessage = useMemo<ChatMessage | null>(
    () =>
      isSending &&
      (streamingNodes.length > 0 || toolProgress.length > 0 || streamingText)
        ? {
            id: '__streaming__',
            role: 'assistant',
            nodes: [
              ...toolProgress,
              ...streamingNodes,
              ...(streamingText
                ? [{ type: 'text' as const, content: streamingText }]
                : []),
            ],
            sequence: messages.length + 1,
            created_at: new Date().toISOString(),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSending, streamingNodes, toolProgress, streamingText, messages.length],
  );

  const allMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  );

  const virtualizer = useVirtualizer({
    count: allMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) =>
      estimateMessageHeight(allMessages[index]?.nodes ?? []),
    overscan: 3,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  // Auto-scroll to bottom on new messages, but only if user was already at bottom
  useEffect(() => {
    if (wasAtBottomRef.current && allMessages.length > 0) {
      virtualizer.scrollToIndex(allMessages.length - 1, { align: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages.length, streamingText]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  return (
    <div
      ref={parentRef}
      className={styles.chatContainer}
      onScroll={handleScroll}
    >
      {allMessages.length === 0 && !isSending && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>&#x2708;&#xFE0F;</p>
          <p className={styles.emptyTitle}>Start planning your trip</p>
          <p className={styles.emptySubtitle}>
            Describe where you want to go, your dates, and budget below.
          </p>
        </div>
      )}
      {isSending &&
        streamingNodes.length === 0 &&
        toolProgress.length === 0 &&
        streamingText === '' &&
        messages.at(-1)?.role !== 'assistant' && (
          <div className={styles.pendingIndicator}>
            <ChatProgressBar mode='indeterminate' label='Thinking' />
          </div>
        )}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = allMessages[virtualItem.index];
          if (!message) return null;

          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                className={`${styles.message} ${styles[message.role]}`}
                data-role={message.role}
              >
                <div className={styles.roleBadge}>
                  {message.role === 'user' ? 'You' : APP_NAME}
                </div>
                <div className={styles.bubble}>
                  {(() => {
                    const toolNodes = message.nodes.filter(
                      (n): n is Extract<ChatNode, { type: 'tool_progress' }> =>
                        n.type === 'tool_progress',
                    );
                    const otherNodes = message.nodes.filter(
                      (n) => n.type !== 'tool_progress',
                    );
                    const latestRunning = toolNodes
                      .filter((n) => n.status === 'running')
                      .at(-1);
                    const latestAny = toolNodes.at(-1);
                    const latestToolName =
                      latestRunning?.tool_name ?? latestAny?.tool_name ?? '';
                    return (
                      <>
                        {toolNodes.length > 0 && (
                          <ChatProgressBar
                            mode='determinate'
                            done={
                              toolNodes.filter((n) => n.status === 'done')
                                .length
                            }
                            total={toolNodes.length}
                            latestLabel={getToolLabelForName(latestToolName)}
                          />
                        )}
                        {otherNodes.map((node, nodeIdx) => (
                          <NodeRenderer
                            key={`${message.id}-${nodeIdx}`}
                            node={node}
                            callbacks={{
                              onQuickReply,
                              onBookNow,
                              onFormSubmit,
                              onConfirmFlight: (label, data) => {
                                onSelectItem?.('flight', data);
                                onQuickReply(
                                  `I've selected the ${label} flight`,
                                );
                              },
                              onConfirmHotel: (label, data) => {
                                onSelectItem?.('hotel', data);
                                onQuickReply(`I've selected ${label}`);
                              },
                              onConfirmCarRental: (label, data) => {
                                onSelectItem?.('car_rental', data);
                                onQuickReply(
                                  `I've selected the ${label} rental`,
                                );
                              },
                              onConfirmExperience: (label, data) => {
                                onSelectItem?.('experience', data);
                                onQuickReply(`I've selected ${label}`);
                              },
                            }}
                          />
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
