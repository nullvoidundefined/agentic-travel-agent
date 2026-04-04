import type { FlightResult, FlightSearchInput } from '../flights.tool.js';

export function generateMockFlights(input: FlightSearchInput): FlightResult[] {
  const airlines = ['Delta', 'United', 'American'];
  return airlines.map((airline, i) => ({
    offer_id: `mock-flight-${i}`,
    airline,
    airline_logo: null,
    flight_number: `${airline.slice(0, 2).toUpperCase()}${100 + i * 50}`,
    origin: input.origin,
    destination: input.destination,
    departure_time: `${input.departure_date}T${String(8 + i * 4).padStart(2, '0')}:00:00`,
    arrival_time: `${input.departure_date}T${String(14 + i * 4).padStart(2, '0')}:00:00`,
    price: 300 + i * 150,
    currency: 'USD',
    cabin_class: input.cabin_class ?? 'ECONOMY',
    segments: [
      {
        departure: {
          iataCode: input.origin,
          at: `${input.departure_date}T${String(8 + i * 4).padStart(2, '0')}:00:00`,
        },
        arrival: {
          iataCode: input.destination,
          at: `${input.departure_date}T${String(14 + i * 4).padStart(2, '0')}:00:00`,
        },
        carrierCode: airline.slice(0, 2).toUpperCase(),
        number: `${100 + i * 50}`,
      },
    ],
  }));
}
