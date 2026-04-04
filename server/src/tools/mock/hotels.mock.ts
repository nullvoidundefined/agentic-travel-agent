import type { HotelResult, HotelSearchInput } from '../hotels.tool.js';

export function generateMockHotels(input: HotelSearchInput): HotelResult[] {
  const mockHotels = [
    { name: `${input.city} Backpacker Hostel`, stars: 1, pricePerNight: 25 },
    { name: `${input.city} Budget Inn`, stars: 2, pricePerNight: 55 },
    { name: `${input.city} Central Hotel`, stars: 3, pricePerNight: 110 },
    { name: `${input.city} Grand Hotel`, stars: 4, pricePerNight: 180 },
    {
      name: `${input.city} Luxury Resort & Spa`,
      stars: 5,
      pricePerNight: 350,
    },
  ];
  return mockHotels.map((h, i) => ({
    hotel_id: `mock-hotel-${i}`,
    offer_id: `mock-hotel-offer-${i}`,
    name: h.name,
    address: `123 Main St, ${input.city}`,
    city: input.city,
    star_rating: h.stars,
    price_per_night: h.pricePerNight,
    total_price: h.pricePerNight * 5,
    currency: 'USD',
    check_in: input.check_in,
    check_out: input.check_out,
    image_url: null,
    latitude: null,
    longitude: null,
  }));
}
