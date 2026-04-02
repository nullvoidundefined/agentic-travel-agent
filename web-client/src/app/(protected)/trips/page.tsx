"use client";

import { del, get } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import styles from "./trips.module.scss";

interface Trip {
  id: string;
  destination: string;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  budget_currency: string;
  status: "planning" | "saved" | "archived";
}

function formatDates(
  departure: string | null,
  returnDate: string | null,
): string {
  if (!departure) {
    return "Dates TBD";
  }
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  if (!returnDate) {
    return fmt(departure);
  }
  return `${fmt(departure)} - ${fmt(returnDate)}`;
}

function formatBudget(amount: number | null, currency: string): string {
  if (amount == null) {
    return "No budget set";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function TripsPage() {
  const queryClient = useQueryClient();

  const {
    data: trips,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trips"],
    queryFn: () => get<{ trips: Trip[] }>("/trips").then((r) => r.trips),
  });

  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => del(`/trips/${tripId}`),
    onMutate: async (tripId: string) => {
      await queryClient.cancelQueries({ queryKey: ["trips"] });
      const previous = queryClient.getQueryData<Trip[]>(["trips"]);
      queryClient.setQueryData<Trip[]>(["trips"], (old) =>
        old ? old.filter((t) => t.id !== tripId) : [],
      );
      return { previous };
    },
    onError: (_err, _tripId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["trips"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>My Trips</h1>
        <Link href="/trips/new" className={styles.newTrip}>
          + New Trip
        </Link>
      </div>

      {isLoading && <p className={styles.loading}>Loading trips...</p>}

      {error && (
        <p className={styles.error}>Failed to load trips. Please try again.</p>
      )}

      {trips && trips.length > 0 && (
        <div className={styles.tripList}>
          {trips.map((trip) => (
            <div key={trip.id} className={styles.tripCard}>
              <Link href={`/trips/${trip.id}`} className={styles.tripLink}>
                <div className={styles.tripInfo}>
                  <h2>{trip.destination}</h2>
                  <p className={styles.dates}>
                    {formatDates(trip.departure_date, trip.return_date)}
                  </p>
                </div>
                <div className={styles.tripMeta}>
                  <span className={styles.budget}>
                    {formatBudget(trip.budget_total, trip.budget_currency)}
                  </span>
                  <span className={`${styles.status} ${styles[trip.status]}`}>
                    {statusLabel(trip.status)}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                className={styles.deleteBtn}
                aria-label="Delete trip"
                onClick={() => deleteMutation.mutate(trip.id)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {trips && trips.length === 0 && (
        <div className={styles.empty}>
          <p>No trips yet. Start planning your first adventure!</p>
          <Link href="/trips/new" className={styles.newTrip}>
            + New Trip
          </Link>
        </div>
      )}
    </div>
  );
}
