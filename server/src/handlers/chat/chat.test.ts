import * as chatHandlers from 'app/handlers/chat/chat.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import * as convRepo from 'app/repositories/conversations/conversations.js';
import * as tripRepo from 'app/repositories/trips/trips.js';
import * as agentService from 'app/services/agent.service.js';
import { uuid } from 'app/utils/tests/uuids.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/conversations/conversations.js');
vi.mock('app/repositories/trips/trips.js');
vi.mock('app/repositories/userPreferences/userPreferences.js');
vi.mock('app/services/agent.service.js');
vi.mock('app/services/enrichment.js', () => ({
  getEnrichmentNodes: vi.fn().mockResolvedValue([]),
}));
vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const userId = uuid(0);
const tripId = uuid(1);
const convId = uuid(2);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: userId,
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      created_at: new Date('2025-01-01'),
      updated_at: null,
    };
    next();
  });
  app.post('/trips/:id/chat', chatHandlers.chat);
  app.get('/trips/:id/messages', chatHandlers.getMessages);
  app.use(errorHandler);
  return app;
}

describe('chat handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /trips/:id/chat', () => {
    it('returns 400 when message is missing', async () => {
      const app = createApp();

      const res = await request(app).post(`/trips/${tripId}/chat`).send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when trip not found', async () => {
      const app = createApp();
      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/trips/${tripId}/chat`)
        .send({ message: 'Plan my trip' });

      expect(res.status).toBe(404);
    });

    it('streams SSE events for a successful chat', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        id: tripId,
        user_id: userId,
        destination: 'Barcelona',
        origin: 'JFK',
        departure_date: '2026-07-01',
        return_date: '2026-07-06',
        budget_total: 3000,
        budget_currency: 'USD',
        travelers: 2,
        flights: [],
        hotels: [],
        experiences: [],
      } as never);

      vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
        id: convId,
        trip_id: tripId,
      } as never);

      vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce([]);

      vi.mocked(convRepo.insertMessage).mockResolvedValue({
        id: uuid(3),
        conversation_id: convId,
        role: 'user',
        content: 'Plan my trip',
        sequence: 1,
        created_at: '2026-01-01T00:00:00Z',
      } as never);

      vi.mocked(agentService.runAgentLoop).mockImplementationOnce(
        async (_messages, _ctx, onEvent) => {
          onEvent({
            type: 'tool_progress',
            tool_name: 'search_flights',
            tool_id: 't1',
            status: 'running',
          });
          onEvent({
            type: 'tool_progress',
            tool_name: 'search_flights',
            tool_id: 't1',
            status: 'done',
          });
          onEvent({
            type: 'text_delta',
            content: 'Here is your plan.',
          });
          return {
            response: 'Here is your plan.',
            tool_calls: [
              {
                tool_name: 'search_flights',
                tool_id: 't1',
                input: {},
                result: [],
              },
            ],
            total_tokens: { input: 100, output: 50 },
            nodes: [{ type: 'text', content: 'Here is your plan.' }],
          };
        },
      );

      const res = await request(app)
        .post(`/trips/${tripId}/chat`)
        .send({ message: 'Plan my trip' })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => callback(null, data));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.body).toContain('event: tool_progress');
      expect(res.body).toContain('event: text_delta');
      expect(res.body).toContain('event: done');
    });

    it('persists user and assistant messages', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        id: tripId,
        user_id: userId,
        destination: 'Barcelona',
        origin: 'JFK',
        departure_date: '2026-07-01',
        return_date: '2026-07-06',
        budget_total: 3000,
        budget_currency: 'USD',
        travelers: 2,
        flights: [],
        hotels: [],
        experiences: [],
      } as never);

      vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
        id: convId,
        trip_id: tripId,
      } as never);

      vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce([]);

      vi.mocked(convRepo.insertMessage).mockResolvedValue({
        id: uuid(3),
        conversation_id: convId,
        role: 'user',
        content: 'Hello',
        sequence: 1,
        created_at: '2026-01-01T00:00:00Z',
      } as never);

      vi.mocked(agentService.runAgentLoop).mockResolvedValueOnce({
        response: 'Hi!',
        tool_calls: [],
        total_tokens: { input: 50, output: 20 },
        nodes: [{ type: 'text', content: 'Hi!' }],
      });

      await request(app)
        .post(`/trips/${tripId}/chat`)
        .send({ message: 'Hello' })
        .buffer(true)
        .parse((res, callback) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => callback(null, data));
        });

      // Should persist both user and assistant messages
      expect(convRepo.insertMessage).toHaveBeenCalledTimes(2);
      expect(convRepo.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user', content: 'Hello' }),
      );
      expect(convRepo.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'assistant', content: 'Hi!' }),
      );
    });
  });

  describe('GET /trips/:id/messages', () => {
    it('returns messages for a trip conversation', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        id: tripId,
        user_id: userId,
        destination: 'Barcelona',
        origin: 'JFK',
        departure_date: '2026-07-01',
        return_date: '2026-07-06',
        budget_total: 3000,
        budget_currency: 'USD',
        travelers: 2,
        flights: [],
        hotels: [],
        experiences: [],
      } as never);

      vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
        id: convId,
        trip_id: tripId,
      } as never);

      const messages = [
        { id: uuid(3), role: 'user', content: 'Hi', created_at: '2026-01-01' },
        {
          id: uuid(4),
          role: 'assistant',
          content: 'Hello!',
          created_at: '2026-01-01',
        },
      ];
      vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce(
        messages as never,
      );

      const res = await request(app).get(`/trips/${tripId}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
    });

    it('returns empty messages for new conversation with placeholder destination', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        id: tripId,
        user_id: userId,
        destination: 'Planning...',
        origin: null,
        departure_date: null,
        return_date: null,
        budget_total: null,
        budget_currency: 'USD',
        travelers: 1,
        flights: [],
        hotels: [],
        experiences: [],
      } as never);

      vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
        id: convId,
        trip_id: tripId,
      } as never);

      vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce([]);

      const res = await request(app).get(`/trips/${tripId}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
    });

    it('returns 404 when trip not found', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce(null);

      const res = await request(app).get(`/trips/${tripId}/messages`);

      expect(res.status).toBe(404);
    });

    it('returns welcome message with form for new trip', async () => {
      const app = createApp();

      vi.mocked(tripRepo.getTripWithDetails).mockResolvedValueOnce({
        id: tripId,
        user_id: userId,
        destination: 'Tokyo',
        origin: null,
        departure_date: null,
        return_date: null,
        budget_total: null,
        budget_currency: 'USD',
        travelers: 1,
        flights: [],
        hotels: [],
        experiences: [],
      } as never);

      vi.mocked(convRepo.getOrCreateConversation).mockResolvedValueOnce({
        id: convId,
        trip_id: tripId,
      } as never);

      vi.mocked(convRepo.getMessagesByConversation).mockResolvedValueOnce([]);

      const res = await request(app).get(`/trips/${tripId}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);

      const welcome = res.body.messages[0];
      expect(welcome.id).toBe('welcome');
      expect(welcome.role).toBe('assistant');
      expect(welcome.sequence).toBe(0);

      const nodeTypes = welcome.nodes.map((n: { type: string }) => n.type);
      expect(nodeTypes).toContain('text');
      expect(nodeTypes).toContain('travel_plan_form');

      const textNode = welcome.nodes.find((n: { type: string }) => n.type === 'text');
      expect(textNode.content).toContain('Tokyo');
    });
  });
});
