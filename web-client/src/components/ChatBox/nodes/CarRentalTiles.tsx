'use client';

import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';

import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import { CarRentalCard } from './CarRentalCard';

interface CarRentalTilesProps {
  node: ChatNodeOfType<'car_rental_tiles'>;
  onConfirm?: (label: string) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function CarRentalTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: CarRentalTilesProps) {
  const items = node.rentals.map((rental) => ({
    id: rental.id,
    label: `${rental.car_name} (${rental.provider})`,
    node: (selected: boolean, onClick: () => void) => (
      <CarRentalCard rental={rental} selected={selected} onClick={onClick} />
    ),
  }));

  if (!node.selectable) {
    return (
      <div
        style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}
      >
        {node.rentals.map((rental) => (
          <CarRentalCard key={rental.id} rental={rental} />
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
