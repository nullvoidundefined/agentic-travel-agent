import { formatCurrency, formatShortDate } from '@/lib/format';

import styles from './HotelCard.module.scss';
import { MapPreviewCard } from './MapPreviewCard';

interface HotelCardProps {
  name: string;
  city: string;
  imageUrl: string | null;
  starRating: number | null;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  latitude?: number | null;
  longitude?: number | null;
  selected?: boolean;
  onClick?: () => void;
}

export function HotelCard({
  name,
  city,
  imageUrl,
  starRating,
  pricePerNight,
  totalPrice,
  currency,
  checkIn,
  checkOut,
  latitude,
  longitude,
  selected = false,
  onClick,
}: HotelCardProps) {
  const stars =
    starRating != null ? '\u2605'.repeat(Math.round(starRating)) : null;

  return (
    <button
      type='button'
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      data-tile-card='hotel'
      onClick={onClick}
    >
      <div className={styles.imageArea}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className={styles.image} />
        ) : (
          <div className={styles.imageFallback} />
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.name}>{name}</span>
        {stars && <span className={styles.stars}>{stars}</span>}
        <span className={styles.city}>{city}</span>
        <span className={styles.dates}>
          {formatShortDate(checkIn)} &ndash; {formatShortDate(checkOut)}
        </span>
        <div className={styles.pricing}>
          <span className={styles.perNight}>
            {formatCurrency(pricePerNight, currency)}
            <small>/night</small>
          </span>
          <span className={styles.total}>
            {formatCurrency(totalPrice, currency)} total
          </span>
        </div>
      </div>

      {latitude != null && longitude != null && (
        <MapPreviewCard latitude={latitude} longitude={longitude} name={name} />
      )}
    </button>
  );
}
