import * as prefsHandlers from "app/handlers/userPreferences/userPreferences.js";
import { errorHandler } from "app/middleware/errorHandler/errorHandler.js";
import { requireAuth } from "app/middleware/requireAuth/requireAuth.js";
import * as prefsRepo from "app/repositories/userPreferences/userPreferences.js";
import type { User } from "app/schemas/auth.js";
import type { UserPreferences } from "app/schemas/userPreferences.js";
import { uuid } from "app/utils/tests/uuids.js";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/repositories/userPreferences/userPreferences.js");
vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const id = uuid();
const mockUser: User = {
  id,
  email: "user@example.com",
  first_name: "Test",
  last_name: "User",
  created_at: new Date("2025-01-01"),
  updated_at: null,
};

function buildApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  if (authenticated) {
    app.use((req, _res, next) => {
      req.user = mockUser;
      next();
    });
  }

  app.get("/user-preferences", requireAuth, prefsHandlers.getPreferences);
  app.put("/user-preferences", requireAuth, prefsHandlers.upsertPreferences);
  app.use(errorHandler);
  return app;
}

const normalizedPrefs: UserPreferences = {
  schema_version: 1,
  accommodation: "mid-range",
  travel_pace: "moderate",
  dietary: ["vegetarian"],
  dining_style: "casual",
  activities: ["history-culture"],
  travel_party: "solo",
  budget_comfort: "value-seeker",
  completed_steps: ["accommodation", "travel_pace"],
  lgbtq_safety: false,
  gender: null,
};

describe("userPreferences handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /user-preferences", () => {
    it("returns 401 when not authenticated", async () => {
      const app = buildApp(false);
      const res = await request(app).get("/user-preferences");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHORIZED");
    });

    it("returns 200 with normalized preferences when found", async () => {
      const app = buildApp();
      vi.mocked(prefsRepo.findByUserId).mockResolvedValueOnce(normalizedPrefs);

      const res = await request(app).get("/user-preferences");

      expect(res.status).toBe(200);
      expect(res.body.preferences.accommodation).toBe("mid-range");
      expect(res.body.preferences.travel_pace).toBe("moderate");
      expect(res.body.preferences.dietary).toEqual(["vegetarian"]);
      expect(res.body.preferences.travel_party).toBe("solo");
      expect(res.body.preferences.completed_steps).toEqual([
        "accommodation",
        "travel_pace",
      ]);
      expect(prefsRepo.findByUserId).toHaveBeenCalledWith(id);
    });

    it("returns 200 with null when no preferences exist", async () => {
      const app = buildApp();
      vi.mocked(prefsRepo.findByUserId).mockResolvedValueOnce(null);

      const res = await request(app).get("/user-preferences");

      expect(res.status).toBe(200);
      expect(res.body.preferences).toBeNull();
    });
  });

  describe("PUT /user-preferences", () => {
    it("returns 401 when not authenticated", async () => {
      const app = buildApp(false);
      const res = await request(app).put("/user-preferences").send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("UNAUTHORIZED");
    });

    it("returns 200 and upserts partial preferences", async () => {
      const app = buildApp();
      const input = {
        accommodation: "budget",
        completed_steps: ["accommodation"],
      };
      vi.mocked(prefsRepo.upsert).mockResolvedValueOnce({
        ...normalizedPrefs,
        accommodation: "budget",
        completed_steps: ["accommodation"],
      });

      const res = await request(app).put("/user-preferences").send(input);

      expect(res.status).toBe(200);
      expect(res.body.preferences.accommodation).toBe("budget");
      expect(res.body.preferences.completed_steps).toEqual(["accommodation"]);
      expect(prefsRepo.upsert).toHaveBeenCalledWith(id, input);
    });

    it("strips unknown fields from the request", async () => {
      const app = buildApp();
      const input = {
        accommodation: "upscale",
        unknown_field: "should-be-stripped",
        another_bad_field: 123,
      };
      vi.mocked(prefsRepo.upsert).mockResolvedValueOnce({
        ...normalizedPrefs,
        accommodation: "upscale",
      });

      const res = await request(app).put("/user-preferences").send(input);

      expect(res.status).toBe(200);
      // upsert should only receive the allowed field
      expect(prefsRepo.upsert).toHaveBeenCalledWith(id, {
        accommodation: "upscale",
      });
    });

    it("returns 500 when repo throws", async () => {
      const app = buildApp();
      vi.mocked(prefsRepo.upsert).mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .put("/user-preferences")
        .send({ accommodation: "budget" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("INTERNAL_ERROR");
    });
  });
});
