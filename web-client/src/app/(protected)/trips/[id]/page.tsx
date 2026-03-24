'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ChatBox } from '@/components/ChatBox/ChatBox';
import { get } from '@/lib/api';

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
    experiences: TripExperience[];
}

function formatDate(d: string | null): string {
    if (!d) {
        return 'TBD';
    }
    return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatCurrency(
    amount: number | null,
    currency: string = 'USD',
): string {
    if (amount == null) {
        return '-';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

export default function TripDetailPage() {
    const { id } = useParams<{ id: string }>();

    const {
        data: trip,
        isLoading,
        error,
    } = useQuery({
        queryKey: ['trips', id],
        queryFn: () => get<{ trip: Trip }>(`/trips/${id}`).then((r) => r.trip),
    });

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
                <Link href="/trips" className={styles.back}>
                    &larr; Back to trips
                </Link>
                <p>Trip not found.</p>
            </div>
        );
    }

    const flightTotal = trip.flights.reduce(
        (sum, f) => sum + (f.price ?? 0),
        0,
    );
    const hotelTotal = trip.hotels.reduce(
        (sum, h) => sum + (h.total_price ?? 0),
        0,
    );
    const experienceTotal = trip.experiences.reduce(
        (sum, e) => sum + (e.estimated_cost ?? 0),
        0,
    );
    const allocated = flightTotal + hotelTotal + experienceTotal;
    const remaining =
        trip.budget_total != null ? trip.budget_total - allocated : null;

    return (
        <div className={styles.page}>
            <Link href="/trips" className={styles.back}>
                &larr; Back to trips
            </Link>

            <div className={styles.header}>
                <div>
                    <h1>{trip.destination}</h1>
                    <p className={styles.dates}>
                        {formatDate(trip.departure_date)} &ndash;{' '}
                        {formatDate(trip.return_date)}
                    </p>
                </div>
                {trip.budget_total != null && (
                    <div className={styles.budgetCard}>
                        <span className={styles.budgetLabel}>Budget</span>
                        <span className={styles.budgetAmount}>
                            {formatCurrency(
                                trip.budget_total,
                                trip.budget_currency,
                            )}
                        </span>
                        <span className={styles.budgetSpent}>
                            {formatCurrency(allocated, trip.budget_currency)}{' '}
                            allocated
                        </span>
                    </div>
                )}
            </div>

            {(flightTotal > 0 || hotelTotal > 0 || experienceTotal > 0) && (
                <div className={styles.breakdown}>
                    <h2>Cost Breakdown</h2>
                    <div className={styles.costs}>
                        {flightTotal > 0 && (
                            <div className={styles.costRow}>
                                <span>Flights</span>
                                <span>
                                    {formatCurrency(
                                        flightTotal,
                                        trip.budget_currency,
                                    )}
                                </span>
                            </div>
                        )}
                        {hotelTotal > 0 && (
                            <div className={styles.costRow}>
                                <span>Hotels</span>
                                <span>
                                    {formatCurrency(
                                        hotelTotal,
                                        trip.budget_currency,
                                    )}
                                </span>
                            </div>
                        )}
                        {experienceTotal > 0 && (
                            <div className={styles.costRow}>
                                <span>Experiences</span>
                                <span>
                                    {formatCurrency(
                                        experienceTotal,
                                        trip.budget_currency,
                                    )}
                                </span>
                            </div>
                        )}
                        {remaining != null && (
                            <div
                                className={`${styles.costRow} ${styles.remaining}`}
                            >
                                <span>Remaining</span>
                                <span>
                                    {formatCurrency(
                                        remaining,
                                        trip.budget_currency,
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                            Departs:{' '}
                                            {new Date(
                                                f.departure_time,
                                            ).toLocaleString()}
                                        </li>
                                    )}
                                    {f.price != null && (
                                        <li>
                                            Price:{' '}
                                            {formatCurrency(
                                                f.price,
                                                f.currency,
                                            )}
                                        </li>
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
                                    <span className={styles.dayNumber}>
                                        {h.name ?? 'Hotel'}
                                    </span>
                                    <span className={styles.dayTitle}>
                                        {h.city}
                                    </span>
                                </div>
                                <ul className={styles.dayItems}>
                                    {h.check_in && (
                                        <li>
                                            Check-in: {formatDate(h.check_in)}
                                        </li>
                                    )}
                                    {h.check_out && (
                                        <li>
                                            Check-out: {formatDate(h.check_out)}
                                        </li>
                                    )}
                                    {h.price_per_night != null && (
                                        <li>
                                            {formatCurrency(
                                                h.price_per_night,
                                                h.currency,
                                            )}
                                            /night
                                        </li>
                                    )}
                                    {h.total_price != null && (
                                        <li>
                                            Total:{' '}
                                            {formatCurrency(
                                                h.total_price,
                                                h.currency,
                                            )}
                                        </li>
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
                                        <span className={styles.dayTitle}>
                                            {exp.category}
                                        </span>
                                    )}
                                </div>
                                <ul className={styles.dayItems}>
                                    {exp.rating != null && (
                                        <li>{`Rating: ${exp.rating}/5`}</li>
                                    )}
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
                        <p>
                            No itinerary items yet. Use the chat to start
                            planning!
                        </p>
                    </div>
                )}

            <div className={styles.chatSection}>
                <h2>Chat with Atlas</h2>
                <ChatBox tripId={trip.id} />
            </div>
        </div>
    );
}
