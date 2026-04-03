import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';
import { describe, expect, it } from 'vitest';

describe('tool definitions', () => {
  it('exports exactly 12 tool definitions', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(12);
  });

  const expectedTools = [
    'search_flights',
    'search_hotels',
    'search_experiences',
    'calculate_remaining_budget',
    'update_trip',
    'get_destination_info',
    'search_car_rentals',
    'select_flight',
    'select_hotel',
    'select_car_rental',
    'select_experience',
    'format_response',
  ];

  for (const toolName of expectedTools) {
    it(`includes ${toolName} definition`, () => {
      const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool!.description).toBeDefined();
      expect(tool!.description.length).toBeGreaterThan(10);
      expect(tool!.input_schema).toBeDefined();
      expect(tool!.input_schema.type).toBe('object');
      expect(tool!.input_schema.properties).toBeDefined();
    });
  }

  it('search_flights requires origin, destination, departure_date, passengers', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'search_flights')!;
    expect(tool.input_schema.required).toContain('origin');
    expect(tool.input_schema.required).toContain('destination');
    expect(tool.input_schema.required).toContain('departure_date');
    expect(tool.input_schema.required).toContain('passengers');
  });

  it('search_hotels requires city, check_in, check_out, guests', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'search_hotels')!;
    expect(tool.input_schema.required).toContain('city');
    expect(tool.input_schema.required).toContain('check_in');
    expect(tool.input_schema.required).toContain('check_out');
    expect(tool.input_schema.required).toContain('guests');
  });

  it('calculate_remaining_budget requires total_budget', () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.name === 'calculate_remaining_budget',
    )!;
    expect(tool.input_schema.required).toContain('total_budget');
  });

  it('get_destination_info requires city_name', () => {
    const tool = TOOL_DEFINITIONS.find(
      (t) => t.name === 'get_destination_info',
    )!;
    expect(tool.input_schema.required).toContain('city_name');
  });
});
