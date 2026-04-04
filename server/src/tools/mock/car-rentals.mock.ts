import type { CarRentalInput, CarRentalResult } from '../car-rentals.tool.js';

export function generateMockCarRentals(input: CarRentalInput): {
  rentals: CarRentalResult[];
} {
  return {
    rentals: [
      {
        provider: 'Hertz',
        car_name: 'Toyota Corolla',
        car_type: 'economy',
        price_per_day: 35,
        total_price: 175,
        currency: 'USD',
        pickup_location: input.pickup_location,
        dropoff_location: input.dropoff_location ?? input.pickup_location,
        pickup_date: input.pickup_date,
        dropoff_date: input.dropoff_date,
        features: [],
      },
      {
        provider: 'Enterprise',
        car_name: 'Honda CR-V',
        car_type: 'suv',
        price_per_day: 55,
        total_price: 275,
        currency: 'USD',
        pickup_location: input.pickup_location,
        dropoff_location: input.dropoff_location ?? input.pickup_location,
        pickup_date: input.pickup_date,
        dropoff_date: input.dropoff_date,
        features: [],
      },
      {
        provider: 'Avis',
        car_name: 'Ford Mustang',
        car_type: 'convertible',
        price_per_day: 75,
        total_price: 375,
        currency: 'USD',
        pickup_location: input.pickup_location,
        dropoff_location: input.dropoff_location ?? input.pickup_location,
        pickup_date: input.pickup_date,
        dropoff_date: input.dropoff_date,
        features: [],
      },
    ],
  };
}
