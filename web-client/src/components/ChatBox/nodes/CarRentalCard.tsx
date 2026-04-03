import { formatCurrency, formatShortDate } from '@/lib/format';
import type { CarRental } from '@agentic-travel-agent/shared-types';

import styles from './CarRentalCard.module.scss';

interface CarRentalCardProps {
  rental: CarRental;
  selected?: boolean;
  onClick?: () => void;
}

export function CarRentalCard({
  rental,
  selected = false,
  onClick,
}: CarRentalCardProps) {
  const fallbackCode = rental.provider.slice(0, 2).toUpperCase();

  return (
    <button
      type='button'
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <div className={styles.header}>
        <div className={styles.logo}>
          {rental.provider_logo ? (
            <img
              src={rental.provider_logo}
              alt={`${rental.provider} logo`}
              className={styles.logoImg}
            />
          ) : (
            <span className={styles.logoFallback}>{fallbackCode}</span>
          )}
        </div>
        <div className={styles.providerInfo}>
          <span className={styles.provider}>{rental.provider}</span>
          <span className={styles.carType}>{rental.car_type}</span>
        </div>
        <div className={styles.priceBlock}>
          <span className={styles.pricePerDay}>
            {formatCurrency(rental.price_per_day, rental.currency)}
            <small>/day</small>
          </span>
          <span className={styles.totalPrice}>
            {formatCurrency(rental.total_price, rental.currency)} total
          </span>
        </div>
      </div>

      <div className={styles.body}>
        {rental.image_url && (
          <img
            src={rental.image_url}
            alt={rental.car_name}
            className={styles.carImage}
          />
        )}
        <div className={styles.details}>
          <span className={styles.carName}>{rental.car_name}</span>
          <span className={styles.dates}>
            {formatShortDate(rental.pickup_date)} &ndash;{' '}
            {formatShortDate(rental.dropoff_date)}
          </span>
          <span className={styles.location}>{rental.pickup_location}</span>
          {rental.features.length > 0 && (
            <ul className={styles.features} aria-label='Car features'>
              {rental.features.map((feature) => (
                <li key={feature} className={styles.feature}>
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </button>
  );
}
