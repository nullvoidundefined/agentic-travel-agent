import { randomUUID } from 'crypto';
import type { ChatNode, Flight, Hotel, CarRental, Experience } from '@agentic-travel-agent/shared-types';

interface FlightRaw {
  airline: string;
  airline_logo?: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time?: string;
  price: number;
  currency: string;
  cabin_class?: string;
}

interface HotelRaw {
  name: string;
  city: string;
  image_url?: string;
  star_rating: number;
  price_per_night: number;
  total_price: number;
  currency: string;
  check_in: string;
  check_out: string;
  lat?: number;
  lon?: number;
}

interface CarRentalRaw {
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string;
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[];
  image_url?: string;
}

interface ExperienceRaw {
  name: string;
  category: string;
  photo_ref?: string;
  rating?: number;
  estimated_cost: number;
  currency?: string;
  lat?: number;
  lon?: number;
}

function normalizeFlights(raw: FlightRaw[]): Flight[] {
  return raw.map((f) => ({
    id: randomUUID(),
    airline: f.airline,
    airline_logo: f.airline_logo,
    flight_number: f.flight_number,
    origin: f.departure_airport,
    destination: f.arrival_airport,
    departure_time: f.departure_time,
    arrival_time: f.arrival_time,
    price: f.price,
    currency: f.currency,
    cabin_class: f.cabin_class,
  }));
}

function normalizeHotels(raw: HotelRaw[]): Hotel[] {
  return raw.map((h) => ({
    id: randomUUID(),
    name: h.name,
    city: h.city,
    image_url: h.image_url,
    star_rating: h.star_rating,
    price_per_night: h.price_per_night,
    total_price: h.total_price,
    currency: h.currency,
    check_in: h.check_in,
    check_out: h.check_out,
    lat: h.lat,
    lon: h.lon,
  }));
}

function normalizeCarRentals(raw: CarRentalRaw[]): CarRental[] {
  return raw.map((c) => ({
    id: randomUUID(),
    provider: c.provider,
    provider_logo: c.provider_logo,
    car_name: c.car_name,
    car_type: c.car_type,
    price_per_day: c.price_per_day,
    total_price: c.total_price,
    currency: c.currency,
    pickup_location: c.pickup_location,
    dropoff_location: c.dropoff_location,
    pickup_date: c.pickup_date,
    dropoff_date: c.dropoff_date,
    features: c.features ?? [],
    image_url: c.image_url,
  }));
}

function normalizeExperiences(raw: ExperienceRaw[]): Experience[] {
  return raw.map((e) => ({
    id: randomUUID(),
    name: e.name,
    category: e.category,
    photo_ref: e.photo_ref,
    rating: e.rating,
    estimated_cost: e.estimated_cost,
    currency: e.currency,
    lat: e.lat,
    lon: e.lon,
  }));
}

export function buildNodeFromToolResult(
  toolName: string,
  result: unknown,
): ChatNode | null {
  const data = result as Record<string, unknown>;

  switch (toolName) {
    case 'search_flights':
      return {
        type: 'flight_tiles',
        flights: normalizeFlights((data.flights as FlightRaw[]) ?? []),
        selectable: true,
      };

    case 'search_hotels':
      return {
        type: 'hotel_tiles',
        hotels: normalizeHotels((data.hotels as HotelRaw[]) ?? []),
        selectable: true,
      };

    case 'search_car_rentals':
      return {
        type: 'car_rental_tiles',
        rentals: normalizeCarRentals((data.rentals as CarRentalRaw[]) ?? []),
        selectable: true,
      };

    case 'search_experiences':
      return {
        type: 'experience_tiles',
        experiences: normalizeExperiences(
          (data.experiences as ExperienceRaw[]) ?? [],
        ),
        selectable: true,
      };

    case 'calculate_remaining_budget':
      return {
        type: 'budget_bar',
        allocated: (data.total_spent as number) ?? 0,
        total: (data.total_budget as number) ?? 0,
        currency: (data.currency as string) ?? 'USD',
      };

    default:
      return null;
  }
}
