'use client';

import type { ChatNode } from '@voyager/shared-types';

import { TripDetailsForm } from './TripDetailsForm';
import { AdvisoryCard } from './nodes/AdvisoryCard';
import { BookingPrompt } from './nodes/BookingPrompt';
import { BudgetBar } from './nodes/BudgetBar';
import { CarRentalTiles } from './nodes/CarRentalTiles';
import { ExperienceTiles } from './nodes/ExperienceTiles';
import { FlightTiles } from './nodes/FlightTiles';
import { HotelTiles } from './nodes/HotelTiles';
import { MarkdownText } from './nodes/MarkdownText';
import { WeatherForecast } from './nodes/WeatherForecast';
import { ItineraryTimeline } from './widgets/ItineraryTimeline';
import { QuickReplyChips } from './widgets/QuickReplyChips';

export interface NodeRendererCallbacks {
  onConfirmFlight?: (label: string, data: Record<string, unknown>) => void;
  onConfirmHotel?: (label: string, data: Record<string, unknown>) => void;
  onConfirmCarRental?: (label: string, data: Record<string, unknown>) => void;
  onConfirmExperience?: (label: string, data: Record<string, unknown>) => void;
  onQuickReply?: (text: string) => void;
  onBookNow?: () => void;
  onFormSubmit?: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
  disabled?: boolean;
  confirmedFlightId?: string | null;
  confirmedHotelId?: string | null;
  confirmedCarRentalId?: string | null;
  confirmedExperienceId?: string | null;
}

interface NodeRendererProps {
  node: ChatNode;
  callbacks?: NodeRendererCallbacks;
}

export function NodeRenderer({ node, callbacks = {} }: NodeRendererProps) {
  const cb: NodeRendererCallbacks = callbacks;

  switch (node.type) {
    case 'text':
      return <MarkdownText node={node} />;

    case 'flight_tiles':
      return (
        <FlightTiles
          node={node}
          onConfirm={cb.onConfirmFlight}
          disabled={cb.disabled}
          confirmedId={cb.confirmedFlightId}
        />
      );

    case 'hotel_tiles':
      return (
        <HotelTiles
          node={node}
          onConfirm={cb.onConfirmHotel}
          disabled={cb.disabled}
          confirmedId={cb.confirmedHotelId}
        />
      );

    case 'car_rental_tiles':
      return (
        <CarRentalTiles
          node={node}
          onConfirm={cb.onConfirmCarRental}
          disabled={cb.disabled}
          confirmedId={cb.confirmedCarRentalId}
        />
      );

    case 'experience_tiles':
      return (
        <ExperienceTiles
          node={node}
          onConfirm={cb.onConfirmExperience}
          disabled={cb.disabled}
          confirmedId={cb.confirmedExperienceId}
        />
      );

    case 'itinerary': {
      // Adapt shared-types DayPlan (field: day) to ItineraryTimeline (field: dayNumber)
      const adaptedDays = node.days.map((d) => ({
        dayNumber: d.day,
        title: d.title,
        items: d.items,
      }));
      return <ItineraryTimeline days={adaptedDays} />;
    }

    case 'advisory':
      return <AdvisoryCard node={node} />;

    case 'weather_forecast':
      return <WeatherForecast node={node} />;

    case 'budget_bar':
      return <BudgetBar node={node} />;

    case 'quick_replies':
      return (
        <QuickReplyChips
          chips={node.options}
          onSelect={cb.onQuickReply ?? (() => {})}
          disabled={cb.disabled}
        />
      );

    case 'tool_progress':
      // Rendered as part of a consolidated ChatProgressBar by VirtualizedChat.
      // Returning null here prevents per-node chip rendering. See invariant 6.
      return null;

    case 'travel_plan_form': {
      // Map FormField to TripField for the TripDetailsForm component
      const tripFields = node.fields.map((f) => ({
        type: f.name as
          | 'destination'
          | 'origin'
          | 'departure_date'
          | 'return_date'
          | 'budget'
          | 'travelers',
        label: f.label,
      }));
      return (
        <TripDetailsForm
          fields={tripFields}
          onSubmit={cb.onFormSubmit ?? (() => {})}
          disabled={cb.disabled}
        />
      );
    }

    case 'booking_prompt':
      return (
        <BookingPrompt
          experiencesEmpty={node.experiences_empty}
          carRentalsEmpty={node.car_rentals_empty}
          onBookNow={cb.onBookNow ?? (() => {})}
          onQuickReply={cb.onQuickReply ?? (() => {})}
        />
      );

    default: {
      // Exhaustive check — TypeScript will error if a node type is unhandled
      const _exhaustive: never = node;
      void _exhaustive;
      return null;
    }
  }
}
