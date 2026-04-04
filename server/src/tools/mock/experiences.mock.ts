import type {
  ExperienceResult,
  ExperienceSearchInput,
} from '../experiences.tool.js';

export function generateMockExperiences(
  input: ExperienceSearchInput,
): ExperienceResult[] {
  return [
    {
      place_id: 'mock-place-0',
      name: `${input.location} Walking Tour`,
      address: input.location,
      rating: 4.5,
      price_level: 'PRICE_LEVEL_INEXPENSIVE',
      estimated_cost: 25,
      category: 'culture',
      photo_ref: null,
      latitude: null,
      longitude: null,
    },
    {
      place_id: 'mock-place-1',
      name: `${input.location} Food Tour`,
      address: input.location,
      rating: 4.8,
      price_level: 'PRICE_LEVEL_MODERATE',
      estimated_cost: 65,
      category: 'food',
      photo_ref: null,
      latitude: null,
      longitude: null,
    },
    {
      place_id: 'mock-place-2',
      name: `${input.location} Museum Pass`,
      address: input.location,
      rating: 4.3,
      price_level: 'PRICE_LEVEL_INEXPENSIVE',
      estimated_cost: 30,
      category: 'culture',
      photo_ref: null,
      latitude: null,
      longitude: null,
    },
  ];
}
