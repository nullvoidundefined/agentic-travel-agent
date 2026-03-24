import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/db/pool/pool.js", () => ({
  query: vi.fn(),
}));

import { query } from "app/db/pool/pool.js";
import {
  insertToolCallLog,
  getToolCallLogsByConversation,
} from "app/repositories/tool-call-log/tool-call-log.js";

describe("tool-call-log repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("insertToolCallLog", () => {
    it("inserts a tool call log entry and returns it", async () => {
      const mockRow = {
        id: "log-1",
        conversation_id: "conv-1",
        message_id: null,
        tool_name: "search_flights",
        tool_input_json: { origin: "SFO" },
        tool_result_json: [{ price: 450 }],
        latency_ms: 120,
        cache_hit: false,
        error: null,
        created_at: new Date().toISOString(),
      };
      vi.mocked(query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await insertToolCallLog({
        conversation_id: "conv-1",
        tool_name: "search_flights",
        tool_input_json: { origin: "SFO" },
        tool_result_json: [{ price: 450 }],
        latency_ms: 120,
        cache_hit: false,
        error: null,
      });

      expect(result).toEqual(mockRow);
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = vi.mocked(query).mock.calls[0];
      expect(sql).toContain("INSERT INTO tool_call_log");
      expect(params).toContain("search_flights");
    });

    it("stores error string when tool fails", async () => {
      const mockRow = {
        id: "log-2",
        conversation_id: "conv-1",
        message_id: null,
        tool_name: "search_flights",
        tool_input_json: { origin: "SFO" },
        tool_result_json: null,
        latency_ms: 50,
        cache_hit: false,
        error: "Amadeus API timeout",
        created_at: new Date().toISOString(),
      };
      vi.mocked(query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await insertToolCallLog({
        conversation_id: "conv-1",
        tool_name: "search_flights",
        tool_input_json: { origin: "SFO" },
        tool_result_json: null,
        latency_ms: 50,
        cache_hit: false,
        error: "Amadeus API timeout",
      });

      expect(result.error).toBe("Amadeus API timeout");
    });

    it("accepts null conversation_id", async () => {
      const mockRow = {
        id: "log-3",
        conversation_id: null,
        message_id: null,
        tool_name: "get_destination_info",
        tool_input_json: { city_name: "Paris" },
        tool_result_json: { iata_code: "CDG" },
        latency_ms: 1,
        cache_hit: false,
        error: null,
        created_at: new Date().toISOString(),
      };
      vi.mocked(query).mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 } as never);

      const result = await insertToolCallLog({
        conversation_id: null,
        tool_name: "get_destination_info",
        tool_input_json: { city_name: "Paris" },
        tool_result_json: { iata_code: "CDG" },
        latency_ms: 1,
        cache_hit: false,
        error: null,
      });

      expect(result.conversation_id).toBeNull();
    });
  });

  describe("getToolCallLogsByConversation", () => {
    it("returns tool call logs for a conversation ordered by created_at", async () => {
      const rows = [
        { id: "log-1", tool_name: "search_flights", created_at: "2026-01-01T00:00:00Z" },
        { id: "log-2", tool_name: "search_hotels", created_at: "2026-01-01T00:01:00Z" },
      ];
      vi.mocked(query).mockResolvedValueOnce({ rows, rowCount: 2 } as never);

      const result = await getToolCallLogsByConversation("conv-1");

      expect(result).toHaveLength(2);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("conversation_id"), ["conv-1"]);
    });

    it("returns empty array when no logs exist", async () => {
      vi.mocked(query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const result = await getToolCallLogsByConversation("conv-999");

      expect(result).toEqual([]);
    });
  });
});
