'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { get } from '@/lib/api';

import styles from './ChatBox.module.scss';
import { TripDetailsForm, parseTripFormFields } from './TripDetailsForm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ToolProgress {
    tool_name: string;
    tool_id: string;
    status: 'running' | 'done';
}

interface ChatBoxProps {
    tripId: string;
}

export function ChatBox({ tripId }: ChatBoxProps) {
    const queryClient = useQueryClient();
    const [input, setInput] = useState('');
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const [streamingText, setStreamingText] = useState('');
    const [tools, setTools] = useState<ToolProgress[]>([]);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { data: serverMessages } = useQuery({
        queryKey: ['messages', tripId],
        queryFn: () =>
            get<{ messages: Message[] }>(`/trips/${tripId}/messages`).then(
                (r) => r.messages,
            ),
    });

    const allMessages = [...(serverMessages ?? []), ...localMessages];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [allMessages.length, streamingText]);

    const sendMessage = useCallback(
        async (msg: string) => {
            if (!msg || isSending) {
                return;
            }

            function handleSSEEvent(
                eventType: string,
                data: Record<string, unknown>,
            ) {
                switch (eventType) {
                    case 'tool_start':
                        setTools((prev) => [
                            ...prev,
                            {
                                tool_name: data.tool_name as string,
                                tool_id: data.tool_id as string,
                                status: 'running',
                            },
                        ]);
                        break;
                    case 'tool_result':
                        setTools((prev) => {
                            const completedTool = prev.find(
                                (t) => t.tool_id === data.tool_id,
                            );
                            if (completedTool?.tool_name === 'update_trip') {
                                queryClient.invalidateQueries({
                                    queryKey: ['trips', tripId],
                                });
                            }
                            return prev.map((t) =>
                                t.tool_id === data.tool_id
                                    ? { ...t, status: 'done' as const }
                                    : t,
                            );
                        });
                        break;
                    case 'assistant':
                        setStreamingText(data.text as string);
                        break;
                    case 'done':
                        setStreamingText(data.response as string);
                        break;
                    case 'error':
                        setStreamingText(
                            (data.error as string) ?? 'An error occurred.',
                        );
                        break;
                }
            }

            setIsSending(true);
            setStreamingText('');
            setTools([]);

            const userMsg: Message = {
                id: `local-${Date.now()}`,
                role: 'user',
                content: msg,
            };
            setLocalMessages((prev) => [...prev, userMsg]);

            try {
                const res = await fetch(`${API_BASE}/trips/${tripId}/chat`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ message: msg }),
                });

                if (!res.ok || !res.body) {
                    throw new Error('Chat request failed');
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    let eventType = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7);
                        } else if (line.startsWith('data: ')) {
                            const data = JSON.parse(line.slice(6));
                            handleSSEEvent(eventType, data);
                        }
                    }
                }
            } catch {
                setLocalMessages((prev) => [
                    ...prev,
                    {
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: 'Something went wrong. Please try again.',
                    },
                ]);
            } finally {
                setIsSending(false);
                await queryClient.invalidateQueries({
                    queryKey: ['messages', tripId],
                });
                setLocalMessages([]);
                setStreamingText('');
                queryClient.invalidateQueries({
                    queryKey: ['trips', tripId],
                });
            }
        },
        [isSending, tripId, queryClient],
    );

    const handleSubmit = useCallback(
        (e: FormEvent) => {
            e.preventDefault();
            const msg = input.trim();
            if (!msg) {
                return;
            }
            setInput('');
            sendMessage(msg);
        },
        [input, sendMessage],
    );

    const toolLabel = (name: string) =>
        name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    function renderText(text: string) {
        if (!text.trim()) {
            return null;
        }
        return text.split('\n').map((line, i) => (
            <p key={i}>
                {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
            </p>
        ));
    }

    return (
        <div className={styles.chatBox}>
            <div className={styles.messageList}>
                {allMessages.length === 0 && !isSending && (
                    <div className={`${styles.message} ${styles.assistant}`}>
                        <div className={styles.roleBadge}>Atlas</div>
                        <div className={styles.bubble}>
                            <p>
                                Hi! I&apos;m Atlas, your AI travel planner. Tell
                                me where you&apos;d like to go, your budget, and
                                your dates — I&apos;ll search real flights,
                                hotels, and experiences to build your itinerary.
                            </p>
                        </div>
                    </div>
                )}
                {allMessages.map((msg) => {
                    const formData =
                        msg.role === 'assistant'
                            ? parseTripFormFields(msg.content)
                            : null;

                    return (
                        <div
                            key={msg.id}
                            className={`${styles.message} ${styles[msg.role]}`}
                        >
                            <div className={styles.roleBadge}>
                                {msg.role === 'user' ? 'You' : 'Atlas'}
                            </div>
                            <div className={styles.bubble}>
                                {formData ? (
                                    <>
                                        {renderText(formData.before)}
                                        <TripDetailsForm
                                            fields={formData.fields}
                                            onSubmit={sendMessage}
                                            disabled={isSending}
                                        />
                                        {renderText(formData.after)}
                                    </>
                                ) : (
                                    renderText(msg.content)
                                )}
                            </div>
                        </div>
                    );
                })}

                {isSending && tools.length === 0 && !streamingText && (
                    <div className={`${styles.message} ${styles.assistant}`}>
                        <div className={styles.roleBadge}>Atlas</div>
                        <div className={styles.bubble}>
                            <span className={styles.typing}>
                                <span />
                                <span />
                                <span />
                            </span>
                        </div>
                    </div>
                )}

                {isSending && tools.length > 0 && (
                    <div className={`${styles.message} ${styles.assistant}`}>
                        <div className={styles.roleBadge}>Atlas</div>
                        <div className={styles.toolProgress}>
                            {tools.map((t) => (
                                <div key={t.tool_id} className={styles.toolRow}>
                                    <span className={styles.toolIcon}>
                                        {t.status === 'running'
                                            ? '\u23F3'
                                            : '\u2705'}
                                    </span>
                                    <span>{toolLabel(t.tool_name)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {streamingText && isSending && (
                    <div className={`${styles.message} ${styles.assistant}`}>
                        <div className={styles.roleBadge}>Atlas</div>
                        <div className={styles.bubble}>
                            {streamingText.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className={styles.inputArea}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Ask the agent to plan your trip..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isSending}
                />
                <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={isSending || !input.trim()}
                >
                    {isSending ? '...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
