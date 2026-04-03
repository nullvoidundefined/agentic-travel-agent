import type { ChatNode } from '@agentic-travel-agent/shared-types';
import { describe, expect, it } from 'vitest';

import { buildNodeFromToolResult } from './node-builder.js';

describe('buildNodeFromToolResult', () => {
  it('maps search_flights result to flight_tiles node', () => {
    // Tool results are arrays, not { flights: [...] }
    const result = [
      {
        airline: 'Delta',
        airline_logo: 'https://logo.com/delta.png',
        flight_number: 'DL123',
        origin: 'JFK',
        destination: 'NRT',
        departure_time: '2026-05-01T08:00:00',
        arrival_time: '2026-05-02T12:00:00',
        price: 850,
        currency: 'USD',
      },
    ];

    const node = buildNodeFromToolResult('search_flights', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('flight_tiles');
    if (node!.type === 'flight_tiles') {
      expect(node!.flights).toHaveLength(1);
      expect(node!.flights[0]!.airline).toBe('Delta');
      expect(node!.flights[0]!.origin).toBe('JFK');
      expect(node!.flights[0]!.destination).toBe('NRT');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_hotels result to hotel_tiles node', () => {
    const result = [
      {
        name: 'Tokyo Grand',
        city: 'Tokyo',
        star_rating: 4,
        price_per_night: 120,
        total_price: 840,
        currency: 'USD',
        check_in: '2026-05-01',
        check_out: '2026-05-08',
      },
    ];

    const node = buildNodeFromToolResult('search_hotels', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('hotel_tiles');
    if (node!.type === 'hotel_tiles') {
      expect(node!.hotels).toHaveLength(1);
      expect(node!.hotels[0]!.name).toBe('Tokyo Grand');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_car_rentals result to car_rental_tiles node', () => {
    const result = [
      {
        provider: 'Hertz',
        car_name: 'Toyota Corolla',
        car_type: 'compact',
        price_per_day: 45,
        total_price: 315,
        currency: 'USD',
        pickup_location: 'NRT Airport',
        dropoff_location: 'NRT Airport',
        pickup_date: '2026-05-01',
        dropoff_date: '2026-05-08',
        features: ['Automatic', 'AC', '5 seats'],
      },
    ];

    const node = buildNodeFromToolResult('search_car_rentals', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('car_rental_tiles');
    if (node!.type === 'car_rental_tiles') {
      expect(node!.rentals).toHaveLength(1);
      expect(node!.rentals[0]!.provider).toBe('Hertz');
      expect(node!.selectable).toBe(true);
    }
  });

  it('maps search_experiences result to experience_tiles node', () => {
    const result = [
      {
        name: 'Senso-ji Temple',
        category: 'Temple',
        rating: 4.6,
        estimated_cost: 0,
      },
    ];

    const node = buildNodeFromToolResult('search_experiences', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('experience_tiles');
  });

  it('maps calculate_remaining_budget to budget_bar node', () => {
    const result = {
      total_budget: 3000,
      total_spent: 1850,
      remaining: 1150,
      currency: 'USD',
    };

    const node = buildNodeFromToolResult('calculate_remaining_budget', result);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('budget_bar');
    if (node!.type === 'budget_bar') {
      expect(node!.allocated).toBe(1850);
      expect(node!.total).toBe(3000);
      expect(node!.currency).toBe('USD');
    }
  });

  it('returns null for tools without a node mapping (update_trip, get_destination_info)', () => {
    expect(buildNodeFromToolResult('update_trip', {})).toBeNull();
    expect(buildNodeFromToolResult('get_destination_info', {})).toBeNull();
    expect(buildNodeFromToolResult('format_response', {})).toBeNull();
  });
});
