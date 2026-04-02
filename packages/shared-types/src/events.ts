import type { ChatNode } from './nodes.js';
import type { ChatMessage } from './messages.js';

export type SSEEvent =
  | { type: 'node'; node: ChatNode }
  | { type: 'text_delta'; content: string }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    }
  | { type: 'done'; message: ChatMessage }
  | { type: 'error'; error: string };
