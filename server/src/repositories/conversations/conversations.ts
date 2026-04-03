import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { query } from 'app/db/pool/pool.js';

export interface Conversation {
  id: string;
  trip_id: string;
  booking_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  tool_calls_json: unknown;
  nodes: ChatNode[];
  schema_version: number;
  sequence: number;
  token_count: number | null;
  created_at: string;
}

export interface InsertMessageInput {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string | null;
  tool_calls_json?: unknown;
  nodes: ChatNode[];
  schema_version?: number;
  token_count?: number | null;
}

export async function getOrCreateConversation(
  tripId: string,
): Promise<Conversation> {
  const result = await query<Conversation>(
    `INSERT INTO conversations (trip_id)
     VALUES ($1)
     ON CONFLICT (trip_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [tripId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to get or create conversation');
  return row;
}

export async function insertMessage(
  input: InsertMessageInput,
): Promise<Message> {
  const result = await query<Message>(
    `INSERT INTO messages (conversation_id, role, content, tool_calls_json, nodes, schema_version, sequence, token_count)
     VALUES ($1, $2, $3, $4, $5, $6,
       (SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE conversation_id = $1),
       $7)
     RETURNING *`,
    [
      input.conversation_id,
      input.role,
      input.content,
      input.tool_calls_json ? JSON.stringify(input.tool_calls_json) : null,
      JSON.stringify(input.nodes),
      input.schema_version ?? 1,
      input.token_count ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to insert message');
  return row;
}

export async function getMessagesByConversation(
  conversationId: string,
): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId],
  );
  return result.rows;
}

export async function updateBookingState(
  conversationId: string,
  bookingState: Record<string, unknown>,
): Promise<void> {
  await query(
    `UPDATE conversations SET booking_state = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(bookingState), conversationId],
  );
}
