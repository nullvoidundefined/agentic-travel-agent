// --- Citation ---

export interface Citation {
  id: string;
  label: string;
  url?: string;
  node_ref?: string;
  source_type:
    | 'travel_advisory'
    | 'visa_info'
    | 'weather'
    | 'vaccination'
    | 'general';
}

// --- Tile data interfaces ---

export interface Flight {
  id: string;
  airline: string;
  airline_logo?: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time?: string;
  price: number;
  currency: string;
  cabin_class?: string;
}

export interface Hotel {
  id: string;
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

export interface CarRental {
  id: string;
  provider: string;
  provider_logo?: string;
  car_name: string;
  car_type: string; // 'economy' | 'compact' | 'midsize' | 'suv' | 'luxury' | 'van'
  price_per_day: number;
  total_price: number;
  currency: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  dropoff_date: string;
  features: string[]; // e.g. ['Automatic', 'AC', '5 seats', '2 bags']
  image_url?: string;
}

export interface Experience {
  id: string;
  name: string;
  category: string;
  photo_ref?: string;
  rating?: number;
  estimated_cost: number;
  currency?: string;
  lat?: number;
  lon?: number;
}

export interface FormField {
  name: string;
  label: string;
  field_type: 'text' | 'date' | 'number' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
  default_value?: string;
}

export interface DayPlan {
  day: number;
  title: string;
  items: string[];
}

export interface WeatherDay {
  date: string;
  high_c: number;
  low_c: number;
  high_f: number;
  low_f: number;
  condition: string;
  icon: string; // emoji or icon identifier
  precipitation_chance: number;
}

// --- ChatNode discriminated union ---

export type ChatNode =
  | { type: 'text'; content: string; citations?: Citation[] }
  | { type: 'flight_tiles'; flights: Flight[]; selectable: boolean }
  | { type: 'hotel_tiles'; hotels: Hotel[]; selectable: boolean }
  | { type: 'car_rental_tiles'; rentals: CarRental[]; selectable: boolean }
  | { type: 'experience_tiles'; experiences: Experience[]; selectable: boolean }
  | { type: 'travel_plan_form'; fields: FormField[] }
  | { type: 'itinerary'; days: DayPlan[] }
  | {
      type: 'advisory';
      severity: 'info' | 'warning' | 'critical';
      title: string;
      body: string;
    }
  | { type: 'weather_forecast'; forecast: WeatherDay[] }
  | {
      type: 'budget_bar';
      allocated: number;
      total: number;
      currency: string;
    }
  | { type: 'quick_replies'; options: string[] }
  | {
      type: 'tool_progress';
      tool_name: string;
      tool_id: string;
      status: 'running' | 'done';
    };

// --- Helper type to extract a specific node ---

export type ChatNodeOfType<T extends ChatNode['type']> = Extract<
  ChatNode,
  { type: T }
>;
