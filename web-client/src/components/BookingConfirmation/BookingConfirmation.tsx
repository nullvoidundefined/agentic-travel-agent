'use client';

import { getDestinationImage } from '@/lib/destinationImage';
import { formatCurrency, formatShortDate } from '@/lib/format';
import Image from 'next/image';

import styles from './BookingConfirmation.module.scss';

interface FlightSummary {
  airline: string | null;
  flight_number: string | null;
  origin: string;
  destination: string;
  price: number | null;
  currency: string;
}

interface HotelSummary {
  name: string | null;
  total_price: number | null;
  currency: string;
}

interface CarRentalSummary {
  provider: string;
  car_name: string;
  total_price: number;
  currency: string;
}

interface ExperienceSummary {
  name: string | null;
  estimated_cost: number | null;
}

interface BookingConfirmationProps {
  destination: string;
  departureDate: string | null;
  returnDate: string | null;
  flights: FlightSummary[];
  hotels: HotelSummary[];
  carRentals: CarRentalSummary[];
  experiences: ExperienceSummary[];
  budgetTotal: number | null;
  budgetCurrency: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BookingConfirmation({
  destination,
  departureDate,
  returnDate,
  flights,
  hotels,
  carRentals,
  experiences,
  budgetTotal,
  budgetCurrency,
  onConfirm,
  onCancel,
}: BookingConfirmationProps) {
  const flightTotal = flights.reduce((s, f) => s + (f.price ?? 0), 0);
  const hotelTotal = hotels.reduce((s, h) => s + (h.total_price ?? 0), 0);
  const carRentalTotal = carRentals.reduce((s, c) => s + c.total_price, 0);
  const expTotal = experiences.reduce((s, e) => s + (e.estimated_cost ?? 0), 0);
  const grandTotal = flightTotal + hotelTotal + carRentalTotal + expTotal;

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-label='Booking confirmation'
    >
      <div className={styles.modal}>
        <div className={styles.imageHeader}>
          {(() => {
            const { url } = getDestinationImage(destination);
            return url ? (
              <Image
                src={url}
                alt={destination}
                fill
                sizes='(max-width: 520px) 100vw, 520px'
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className={styles.imageFallback} />
            );
          })()}
          <div className={styles.imageOverlay}>
            <h2 className={styles.imageTitle}>Save your itinerary for</h2>
            <p className={styles.imageDestination}>{destination}</p>
          </div>
        </div>

        <>
          <h2 className={styles.title}>
            Save Your Itinerary for {destination}
          </h2>
          <p className={styles.dates}>
            {formatShortDate(departureDate)} &ndash;{' '}
            {formatShortDate(returnDate)}
          </p>

          <div className={styles.sections}>
            {flights.length > 0 && (
              <div className={styles.section}>
                <h3>Flights</h3>
                {flights.map((f, i) => (
                  <div key={i} className={styles.item}>
                    <span>
                      {f.airline} {f.flight_number} &middot; {f.origin} &rarr;{' '}
                      {f.destination}
                    </span>
                    <span className={styles.price}>
                      {formatCurrency(f.price, f.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hotels.length > 0 && (
              <div className={styles.section}>
                <h3>Hotels</h3>
                {hotels.map((h, i) => (
                  <div key={i} className={styles.item}>
                    <span>{h.name ?? 'Hotel'}</span>
                    <span className={styles.price}>
                      {formatCurrency(h.total_price, h.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {carRentals.length > 0 && (
              <div className={styles.section}>
                <h3>Car Rentals</h3>
                {carRentals.map((c, i) => (
                  <div key={i} className={styles.item}>
                    <span>
                      {c.provider} &middot; {c.car_name}
                    </span>
                    <span className={styles.price}>
                      {formatCurrency(c.total_price, c.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {experiences.length > 0 && (
              <div className={styles.section}>
                <h3>Experiences</h3>
                {experiences.map((e, i) => (
                  <div key={i} className={styles.item}>
                    <span>{e.name ?? 'Experience'}</span>
                    <span className={styles.price}>
                      ~{formatCurrency(e.estimated_cost)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.totalRow}>
            <span>Total</span>
            <span className={styles.totalAmount}>
              {formatCurrency(grandTotal, budgetCurrency)}
            </span>
          </div>

          {budgetTotal != null && (
            <p className={styles.budgetNote}>
              {grandTotal <= budgetTotal
                ? `Under budget by ${formatCurrency(budgetTotal - grandTotal, budgetCurrency)}`
                : `Over budget by ${formatCurrency(grandTotal - budgetTotal, budgetCurrency)}`}
            </p>
          )}

          <p className={styles.demoDisclaimer}>
            Nothing is actually booked. Voyager is a portfolio demo: this action
            saves the itinerary to your trip history. You book each leg yourself
            through the linked provider.
          </p>

          <div className={styles.actions}>
            <button
              type='button'
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              Save itinerary
            </button>
            <button
              type='button'
              className={styles.cancelButton}
              onClick={onCancel}
            >
              Make changes
            </button>
          </div>
        </>
      </div>
    </div>
  );
}
