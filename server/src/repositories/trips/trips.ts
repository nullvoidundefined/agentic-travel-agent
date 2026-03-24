import { query } from "app/db/pool/pool.js";
import type {
  CreateTripInput,
  Trip,
  TripExperience,
  TripFlight,
  TripHotel,
  TripWithDetails,
} from "app/schemas/trips.js";

export async function createTrip(userId: string, input: CreateTripInput): Promise<Trip> {
  const result = await query<Trip>(
    `INSERT INTO trips (user_id, destination, origin, departure_date, return_date,
       budget_total, budget_currency, travelers, preferences)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      input.destination,
      input.origin ?? null,
      input.departure_date ?? null,
      input.return_date ?? null,
      input.budget_total ?? null,
      input.budget_currency,
      input.travelers,
      JSON.stringify(input.preferences),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function listTrips(userId: string): Promise<Trip[]> {
  const result = await query<Trip>(
    `SELECT * FROM trips WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getTripWithDetails(
  tripId: string,
  userId: string,
): Promise<TripWithDetails | null> {
  const tripResult = await query<Trip>(`SELECT * FROM trips WHERE id = $1 AND user_id = $2`, [
    tripId,
    userId,
  ]);
  const trip = tripResult.rows[0];
  if (!trip) return null;

  const [flightsResult, hotelsResult, experiencesResult] = await Promise.all([
    query<TripFlight>(`SELECT * FROM trip_flights WHERE trip_id = $1 ORDER BY created_at`, [
      tripId,
    ]),
    query<TripHotel>(`SELECT * FROM trip_hotels WHERE trip_id = $1 ORDER BY created_at`, [tripId]),
    query<TripExperience>(`SELECT * FROM trip_experiences WHERE trip_id = $1 ORDER BY created_at`, [
      tripId,
    ]),
  ]);

  return {
    ...trip,
    flights: flightsResult.rows,
    hotels: hotelsResult.rows,
    experiences: experiencesResult.rows,
  };
}

export async function deleteTrip(tripId: string, userId: string): Promise<boolean> {
  const result = await query(`DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id`, [
    tripId,
    userId,
  ]);
  return (result.rowCount ?? 0) > 0;
}
