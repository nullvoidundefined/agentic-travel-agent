'use client';

import { useCallback, useState } from 'react';

import { BookingConfirmation } from '@/components/BookingConfirmation/BookingConfirmation';
import { ChatBox } from '@/components/ChatBox/ChatBox';
import { get, put } from '@/lib/api';
import { APP_NAME } from '@/lib/constants';
import {
  getDestinationImage,
  getDestinationImageUrl,
} from '@/lib/destinationImage';
import { formatCurrency, formatShortDate } from '@/lib/format';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import styles from './tripDetail.module.scss';

interface TripFlight {
  id: string;
  origin: string;
  destination: string;
  airline: string | null;
  flight_number: string | null;
  price: number | null;
  currency: string;
  departure_time: string | null;
}

interface TripHotel {
  id: string;
  name: string | null;
  city: string | null;
  price_per_night: number | null;
  total_price: number | null;
  currency: string;
  check_in: string | null;
  check_out: string | null;
}

interface TripCarRental {
  id: string;
  provider: string;
  car_name: string;
  car_type: string;
  total_price: number | null;
  currency: string;
}

interface TripExperience {
  id: string;
  name: string | null;
  category: string | null;
  estimated_cost: number | null;
  rating: number | null;
}

interface Trip {
  id: string;
  destination: string;
  origin: string | null;
  departure_date: string | null;
  return_date: string | null;
  budget_total: number | null;
  budget_currency: string;
  travelers: number;
  status: string;
  flights: TripFlight[];
  hotels: TripHotel[];
  car_rentals: TripCarRental[];
  experiences: TripExperience[];
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trips', id],
    queryFn: () => get<{ trip: Trip }>(`/trips/${id}`).then((r) => r.trip),
  });

  const handleConfirmBooking = useCallback(async () => {
    try {
      await put(`/trips/${id}`, { status: 'saved' });
    } catch {
      // Mock: update cache directly if no endpoint exists
    }
    queryClient.setQueryData<Trip>(['trips', id], (old) =>
      old ? { ...old, status: 'saved' } : old,
    );
    await queryClient.invalidateQueries({ queryKey: ['trips', id] });
    setShowConfirmation(false);
  }, [id, queryClient]);

  const handleCancelBooking = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p>Loading trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className={styles.page}>
        <Link href='/trips' className={styles.back}>
          &larr; Back to trips
        </Link>
        <p>Trip not found.</p>
      </div>
    );
  }

  const flightTotal = trip.flights.reduce((sum, f) => sum + (f.price ?? 0), 0);
  const hotelTotal = trip.hotels.reduce(
    (sum, h) => sum + (h.total_price ?? 0),
    0,
  );
  const carRentalTotal = trip.car_rentals.reduce(
    (sum, c) =>
      sum + (Number.isFinite(c.total_price) ? (c.total_price ?? 0) : 0),
    0,
  );
  const experienceTotal = trip.experiences.reduce(
    (sum, e) => sum + (e.estimated_cost ?? 0),
    0,
  );
  const rawAllocated =
    flightTotal + hotelTotal + carRentalTotal + experienceTotal;
  const allocated = Number.isFinite(rawAllocated) ? rawAllocated : 0;
  const remaining =
    trip.budget_total != null && Number.isFinite(trip.budget_total - allocated)
      ? trip.budget_total - allocated
      : null;

  const hasFlights = trip.flights.length > 0;

  const { url, unsplashId } = getDestinationImage(trip.destination);
  const hasHero = url !== null && unsplashId !== null;

  return (
    <div className={styles.page}>
      <Link href='/trips' className={styles.back}>
        &larr; Back to trips
      </Link>

      {hasHero && unsplashId && (
        <div className={styles.destinationHero}>
          <Image
            src={getDestinationImageUrl(unsplashId, 1400, 400)}
            alt={trip.destination}
            fill
            sizes='(max-width: 1200px) 100vw, 1200px'
            style={{ objectFit: 'cover' }}
            priority
          />
          <div className={styles.destinationHeroOverlay}>
            <h1 className={styles.destinationHeroTitle}>{trip.destination}</h1>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div>
          {!hasHero && <h1>{trip.destination}</h1>}
          <p className={styles.dates}>
            {!trip.departure_date && !trip.return_date
              ? 'Dates not set'
              : `${formatShortDate(trip.departure_date)} \u2013 ${formatShortDate(trip.return_date)}`}
          </p>
        </div>
        <div className={styles.headerRight}>
          {trip.status === 'saved' && (
            <span className={styles.bookedBadge}>Booked</span>
          )}
          {trip.budget_total != null && (
            <div className={styles.budgetCard}>
              <span className={styles.budgetLabel}>Budget</span>
              <span className={styles.budgetAmount}>
                {formatCurrency(trip.budget_total, trip.budget_currency)}
              </span>
              <span className={styles.budgetSpent}>
                {formatCurrency(allocated, trip.budget_currency)} allocated
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.chatSection}>
        <h2>Chat with {APP_NAME}</h2>
        <ChatBox
          tripId={trip.id}
          hasFlights={hasFlights}
          hasHotels={trip.hotels.length > 0}
          experiencesEmpty={trip.experiences.length === 0}
          carRentalsEmpty={trip.car_rentals.length === 0}
          tripStatus={trip.status}
          onBookTrip={() => setShowConfirmation(true)}
        />
      </div>

      {trip.flights.length > 0 && (
        <div className={styles.itinerary}>
          <h2>Flights</h2>
          <div className={styles.days}>
            {trip.flights.map((f) => (
              <div key={f.id} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayNumber}>
                    {f.airline} {f.flight_number}
                  </span>
                  <span className={styles.dayTitle}>
                    {f.origin} &rarr; {f.destination}
                  </span>
                </div>
                <ul className={styles.dayItems}>
                  {f.departure_time && (
                    <li>
                      Departs: {new Date(f.departure_time).toLocaleString()}
                    </li>
                  )}
                  {f.price != null && (
                    <li>Price: {formatCurrency(f.price, f.currency)}</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {trip.hotels.length > 0 && (
        <div className={styles.itinerary}>
          <h2>Hotels</h2>
          <div className={styles.days}>
            {trip.hotels.map((h) => (
              <div key={h.id} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayNumber}>{h.name ?? 'Hotel'}</span>
                  <span className={styles.dayTitle}>{h.city}</span>
                </div>
                <ul className={styles.dayItems}>
                  {h.check_in && (
                    <li>Check-in: {formatShortDate(h.check_in)}</li>
                  )}
                  {h.check_out && (
                    <li>Check-out: {formatShortDate(h.check_out)}</li>
                  )}
                  {h.price_per_night != null && (
                    <li>
                      {formatCurrency(h.price_per_night, h.currency)}
                      /night
                    </li>
                  )}
                  {h.total_price != null && (
                    <li>Total: {formatCurrency(h.total_price, h.currency)}</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {trip.experiences.length > 0 && (
        <div className={styles.itinerary}>
          <h2>Experiences</h2>
          <div className={styles.days}>
            {trip.experiences.map((exp) => (
              <div key={exp.id} className={styles.dayCard}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayNumber}>
                    {exp.name ?? 'Experience'}
                  </span>
                  {exp.category && (
                    <span className={styles.dayTitle}>{exp.category}</span>
                  )}
                </div>
                <ul className={styles.dayItems}>
                  {exp.rating != null && <li>{`Rating: ${exp.rating}/5`}</li>}
                  {exp.estimated_cost != null && (
                    <li>{`~${formatCurrency(exp.estimated_cost)}`}</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {trip.flights.length === 0 &&
        trip.hotels.length === 0 &&
        trip.experiences.length === 0 && (
          <div className={styles.emptyState}>
            <p>No itinerary items yet. Use the chat to start planning!</p>
          </div>
        )}

      {(flightTotal > 0 ||
        hotelTotal > 0 ||
        carRentalTotal > 0 ||
        experienceTotal > 0) && (
        <div className={styles.breakdown}>
          <h2>Cost Breakdown</h2>
          <div className={styles.costs}>
            {flightTotal > 0 && (
              <div className={styles.costRow}>
                <span>Flights</span>
                <span>{formatCurrency(flightTotal, trip.budget_currency)}</span>
              </div>
            )}
            {hotelTotal > 0 && (
              <div className={styles.costRow}>
                <span>Hotels</span>
                <span>{formatCurrency(hotelTotal, trip.budget_currency)}</span>
              </div>
            )}
            {carRentalTotal > 0 && (
              <div className={styles.costRow}>
                <span>Car Rentals</span>
                <span>
                  {formatCurrency(carRentalTotal, trip.budget_currency)}
                </span>
              </div>
            )}
            {experienceTotal > 0 && (
              <div className={styles.costRow}>
                <span>Experiences</span>
                <span>
                  {formatCurrency(experienceTotal, trip.budget_currency)}
                </span>
              </div>
            )}
            {remaining != null && (
              <div className={`${styles.costRow} ${styles.remaining}`}>
                <span>Remaining</span>
                <span>{formatCurrency(remaining, trip.budget_currency)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showConfirmation && (
        <BookingConfirmation
          destination={trip.destination}
          departureDate={trip.departure_date}
          returnDate={trip.return_date}
          flights={trip.flights}
          hotels={trip.hotels}
          carRentals={trip.car_rentals.map((c) => ({
            ...c,
            total_price: Number.isFinite(c.total_price)
              ? (c.total_price ?? 0)
              : 0,
          }))}
          experiences={trip.experiences}
          budgetTotal={trip.budget_total}
          budgetCurrency={trip.budget_currency}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelBooking}
        />
      )}
    </div>
  );
}
