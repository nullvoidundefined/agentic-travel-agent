'use client';

import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';

import { HotelCard } from '../widgets/HotelCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';

interface HotelTilesProps {
  node: ChatNodeOfType<'hotel_tiles'>;
  onConfirm?: (label: string) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function HotelTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: HotelTilesProps) {
  const items = node.hotels.map((hotel) => ({
    id: hotel.id,
    label: `${hotel.name}, ${hotel.city}`,
    node: (selected: boolean, onClick: () => void) => (
      <HotelCard
        name={hotel.name}
        city={hotel.city}
        imageUrl={hotel.image_url ?? null}
        starRating={hotel.star_rating}
        pricePerNight={hotel.price_per_night}
        totalPrice={hotel.total_price}
        currency={hotel.currency}
        checkIn={hotel.check_in}
        checkOut={hotel.check_out}
        latitude={hotel.lat ?? null}
        longitude={hotel.lon ?? null}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div
        style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}
      >
        {node.hotels.map((hotel) => (
          <HotelCard
            key={hotel.id}
            name={hotel.name}
            city={hotel.city}
            imageUrl={hotel.image_url ?? null}
            starRating={hotel.star_rating}
            pricePerNight={hotel.price_per_night}
            totalPrice={hotel.total_price}
            currency={hotel.currency}
            checkIn={hotel.check_in}
            checkOut={hotel.check_out}
            latitude={hotel.lat ?? null}
            longitude={hotel.lon ?? null}
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
