import {
  findByUserId,
  upsert,
} from "app/repositories/userPreferences/userPreferences.js";
import type { Request, Response } from "express";

export async function getPreferences(req: Request, res: Response) {
  const userId = req.user!.id;
  const prefs = await findByUserId(userId);
  res.json({ preferences: prefs });
}

export async function upsertPreferences(req: Request, res: Response) {
  const userId = req.user!.id;
  const input = req.body as Record<string, unknown>;

  // Validate: only allow known preference fields
  const allowedFields = [
    "accommodation",
    "travel_pace",
    "dietary",
    "dining_style",
    "activities",
    "travel_party",
    "budget_comfort",
    "completed_steps",
    "schema_version",
  ];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in input) {
      filtered[key] = input[key];
    }
  }

  const result = await upsert(userId, filtered);
  res.json({ preferences: result });
}
