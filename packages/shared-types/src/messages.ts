import type { ChatNode } from './nodes.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  nodes: ChatNode[];
  sequence: number;
  created_at: string;
}
