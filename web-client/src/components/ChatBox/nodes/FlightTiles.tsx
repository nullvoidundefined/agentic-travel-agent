'use client';

import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';

import { FlightCard } from '../widgets/FlightCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';

interface FlightTilesProps {
  node: ChatNodeOfType<'flight_tiles'>;
  onConfirm?: (label: string) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function FlightTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: FlightTilesProps) {
  const items = node.flights.map((flight) => ({
    id: flight.id,
    label: `${flight.airline} ${flight.flight_number} — ${flight.origin} to ${flight.destination}`,
    node: (selected: boolean, onClick: () => void) => (
      <FlightCard
        airline={flight.airline}
        airlineLogo={flight.airline_logo ?? null}
        flightNumber={flight.flight_number}
        origin={flight.origin}
        destination={flight.destination}
        departureTime={flight.departure_time}
        price={flight.price}
        currency={flight.currency}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {node.flights.map((flight) => (
          <FlightCard
            key={flight.id}
            airline={flight.airline}
            airlineLogo={flight.airline_logo ?? null}
            flightNumber={flight.flight_number}
            origin={flight.origin}
            destination={flight.destination}
            departureTime={flight.departure_time}
            price={flight.price}
            currency={flight.currency}
          />
        ))}
      </div>
    );
  }

  return (
    <SelectableCardGroup
      items={items}
      onConfirm={onConfirm ?? (() => {})}
      disabled={disabled}
      confirmedId={confirmedId}
    />
  );
}
