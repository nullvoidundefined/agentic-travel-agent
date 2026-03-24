import { query } from "app/db/pool/pool.js";

export interface ToolCallLogEntry {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  tool_name: string;
  tool_input_json: unknown;
  tool_result_json: unknown;
  latency_ms: number;
  cache_hit: boolean;
  error: string | null;
  created_at: string;
}

export interface InsertToolCallLogInput {
  conversation_id: string | null;
  message_id?: string | null;
  tool_name: string;
  tool_input_json: unknown;
  tool_result_json: unknown;
  latency_ms: number;
  cache_hit: boolean;
  error: string | null;
}

export async function insertToolCallLog(input: InsertToolCallLogInput): Promise<ToolCallLogEntry> {
  const result = await query<ToolCallLogEntry>(
    `INSERT INTO tool_call_log
       (conversation_id, message_id, tool_name, tool_input_json, tool_result_json, latency_ms, cache_hit, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.conversation_id,
      input.message_id ?? null,
      input.tool_name,
      JSON.stringify(input.tool_input_json),
      input.tool_result_json != null ? JSON.stringify(input.tool_result_json) : null,
      input.latency_ms,
      input.cache_hit,
      input.error,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function getToolCallLogsByConversation(
  conversationId: string,
): Promise<ToolCallLogEntry[]> {
  const result = await query<ToolCallLogEntry>(
    `SELECT * FROM tool_call_log WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId],
  );
  return result.rows;
}
