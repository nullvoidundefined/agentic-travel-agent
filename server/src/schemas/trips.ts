import { z } from 'zod';

export const createTripSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  origin: z.string().optional(),
  departure_date: z.string().optional(),
  return_date: z.string().optional(),
  budget_total: z.number().positive().optional(),
  budget_currency: z.string().default('USD'),
  travelers: z.number().int().positive().default(1),
  preferences: z
    .object({
      style: z.enum(['luxury', 'budget', 'mid-range']).optional(),
      pace: z.enum(['relaxed', 'moderate', 'packed']).optional(),
      interests: z.array(z.string()).optional(),
    })
    .default({}),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  budget_currency: string;
  travelers: number;
  preferences: Record<string, unknown>;
  status: 'planning' | 'saved' | 'archived';
  transport_mode: 'flying' | 'driving' | null;
  created_at: Date;
  updated_at: Date;
}

export interface TripFlight {
  id: string;
  trip_id: string;
  amadeus_offer_id: string | null;
  origin: string;
  destination: string;
  departure_time: Date | null;
  arrival_time: Date | null;
  airline: string | null;
  flight_number: string | null;
  price: number | null;
  currency: string;
  cabin_class: string | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripHotel {
  id: string;
  trip_id: string;
  amadeus_hotel_id: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  star_rating: number | null;
  price_per_night: number | null;
  total_price: number | null;
  currency: string;
  check_in: string | null;
  check_out: string | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripExperience {
  id: string;
  trip_id: string;
  google_place_id: string | null;
  name: string | null;
  category: string | null;
  address: string | null;
  rating: number | null;
  price_level: number | null;
  estimated_cost: number | null;
  data_json: Record<string, unknown> | null;
  selected: boolean;
  created_at: Date;
}

export interface TripWithDetails extends Trip {
  flights: TripFlight[];
  hotels: TripHotel[];
  experiences: TripExperience[];
}
