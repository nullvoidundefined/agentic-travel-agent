"use client";

import { type FormEvent, useState } from "react";

import styles from "./TripDetailsForm.module.scss";

export interface TripField {
  type: "origin" | "departure_date" | "return_date" | "budget" | "travelers";
  label: string;
}

interface TripDetailsFormProps {
  fields: TripField[];
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export function TripDetailsForm({
  fields,
  onSubmit,
  disabled,
}: TripDetailsFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const set = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const allFilled = fields.every((f) => values[f.type]?.trim());

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allFilled) {
      return;
    }

    const parts: string[] = [];

    if (values.origin) {
      parts.push(`I'm traveling from ${values.origin}`);
    }
    if (values.departure_date && values.return_date) {
      const fmt = (d: string) =>
        new Date(d + "T00:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      parts.push(
        `from ${fmt(values.departure_date)} to ${fmt(values.return_date)}`,
      );
    } else if (values.departure_date) {
      const fmt = (d: string) =>
        new Date(d + "T00:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      parts.push(`departing ${fmt(values.departure_date)}`);
    }
    if (values.budget) {
      parts.push(`with a $${values.budget} budget`);
    }
    if (values.travelers) {
      parts.push(
        values.travelers === "1"
          ? "for 1 traveler"
          : `for ${values.travelers} travelers`,
      );
    }

    onSubmit(parts.join(", ") + ".");
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {fields.map((field) => (
        <div key={field.type} className={styles.field}>
          <label htmlFor={field.type} className={styles.label}>
            {field.label}
          </label>
          {field.type === "origin" && (
            <input
              id="origin"
              type="text"
              className={styles.input}
              placeholder="e.g. New York, San Francisco"
              value={values.origin ?? ""}
              onChange={(e) => set("origin", e.target.value)}
              disabled={disabled}
            />
          )}
          {field.type === "departure_date" && (
            <input
              id="departure_date"
              type="date"
              className={styles.input}
              min={today}
              value={values.departure_date ?? ""}
              onChange={(e) => set("departure_date", e.target.value)}
              disabled={disabled}
            />
          )}
          {field.type === "return_date" && (
            <input
              id="return_date"
              type="date"
              className={styles.input}
              min={values.departure_date || today}
              value={values.return_date ?? ""}
              onChange={(e) => set("return_date", e.target.value)}
              disabled={disabled}
            />
          )}
          {field.type === "budget" && (
            <div className={styles.budgetInput}>
              <span className={styles.prefix}>$</span>
              <input
                id="budget"
                type="number"
                className={styles.input}
                placeholder="3000"
                min={100}
                value={values.budget ?? ""}
                onChange={(e) => set("budget", e.target.value)}
                disabled={disabled}
              />
            </div>
          )}
          {field.type === "travelers" && (
            <input
              id="travelers"
              type="number"
              className={styles.input}
              placeholder="2"
              min={1}
              max={10}
              value={values.travelers ?? ""}
              onChange={(e) => set("travelers", e.target.value)}
              disabled={disabled}
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        className={styles.submit}
        disabled={disabled || !allFilled}
      >
        Start Planning
      </button>
    </form>
  );
}

/** Detect numbered list items asking for trip details and return form fields */
export function parseTripFormFields(content: string): {
  before: string;
  fields: TripField[];
  after: string;
} | null {
  const lines = content.split("\n");
  let listStart = -1;
  let listEnd = -1;

  // Find consecutive numbered list block
  for (let i = 0; i < lines.length; i++) {
    if (/^\d+\.\s/.test(lines[i].trim())) {
      if (listStart === -1) {
        listStart = i;
      }
      listEnd = i;
    } else if (listStart !== -1 && listEnd === i - 1) {
      // non-numbered line right after list — list ended
      break;
    }
  }

  if (listStart === -1 || listEnd - listStart < 1) {
    return null;
  }

  const listLines = lines.slice(listStart, listEnd + 1);
  const fields: TripField[] = [];

  for (const line of listLines) {
    const lower = line.toLowerCase();
    if (/travel(ing|l?)\s+from|origin|departure\s+(city|airport)/.test(lower)) {
      fields.push({ type: "origin", label: "Origin city" });
    } else if (/travel\s+dates|departure.*return|when.*travel/.test(lower)) {
      fields.push({ type: "departure_date", label: "Departure date" });
      fields.push({ type: "return_date", label: "Return date" });
    } else if (/budget/.test(lower)) {
      fields.push({ type: "budget", label: "Budget (USD)" });
    } else if (/traveler|passenger|how\s+many\s+(people|guest)/.test(lower)) {
      fields.push({ type: "travelers", label: "Travelers" });
    }
  }

  // Only show form if we matched at least 2 fields
  if (fields.length < 2) {
    return null;
  }

  const before = lines.slice(0, listStart).join("\n").trimEnd();
  const after = lines
    .slice(listEnd + 1)
    .join("\n")
    .trimStart();

  return { before, fields, after };
}
