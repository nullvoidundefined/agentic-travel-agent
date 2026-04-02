"use client";

import { useEffect, useState } from "react";

import styles from "./BookingConfirmation.module.scss";

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
    experiences: ExperienceSummary[];
    budgetTotal: number | null;
    budgetCurrency: string;
    onConfirm: () => void;
    onCancel: () => void;
}

function formatCurrency(amount: number | null, currency: string = "USD") {
    if (amount == null) return "-";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(d: string | null) {
    if (!d) return "TBD";
    return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function BookingConfirmation({
    destination,
    departureDate,
    returnDate,
    flights,
    hotels,
    experiences,
    budgetTotal,
    budgetCurrency,
    onConfirm,
    onCancel,
}: BookingConfirmationProps) {
    const [stage, setStage] = useState<"review" | "booking" | "confirmed">(
        "review",
    );

    const flightTotal = flights.reduce((s, f) => s + (f.price ?? 0), 0);
    const hotelTotal = hotels.reduce((s, h) => s + (h.total_price ?? 0), 0);
    const expTotal = experiences.reduce(
        (s, e) => s + (e.estimated_cost ?? 0),
        0,
    );
    const grandTotal = flightTotal + hotelTotal + expTotal;

    useEffect(() => {
        if (stage === "booking") {
            const timer = setTimeout(() => setStage("confirmed"), 2200);
            return () => clearTimeout(timer);
        }
    }, [stage]);

    useEffect(() => {
        if (stage === "confirmed") {
            const timer = setTimeout(onConfirm, 1500);
            return () => clearTimeout(timer);
        }
    }, [stage, onConfirm]);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                {stage === "review" && (
                    <>
                        <h2 className={styles.title}>
                            Confirm Your Trip to {destination}
                        </h2>
                        <p className={styles.dates}>
                            {formatDate(departureDate)} &ndash;{" "}
                            {formatDate(returnDate)}
                        </p>

                        <div className={styles.sections}>
                            {flights.length > 0 && (
                                <div className={styles.section}>
                                    <h3>Flights</h3>
                                    {flights.map((f, i) => (
                                        <div key={i} className={styles.item}>
                                            <span>
                                                {f.airline} {f.flight_number}{" "}
                                                &middot; {f.origin} &rarr;{" "}
                                                {f.destination}
                                            </span>
                                            <span className={styles.price}>
                                                {formatCurrency(
                                                    f.price,
                                                    f.currency,
                                                )}
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
                                            <span>
                                                {h.name ?? "Hotel"}
                                            </span>
                                            <span className={styles.price}>
                                                {formatCurrency(
                                                    h.total_price,
                                                    h.currency,
                                                )}
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
                                            <span>
                                                {e.name ?? "Experience"}
                                            </span>
                                            <span className={styles.price}>
                                                ~
                                                {formatCurrency(
                                                    e.estimated_cost,
                                                )}
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

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.confirmButton}
                                onClick={() => setStage("booking")}
                            >
                                Confirm Booking
                            </button>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={onCancel}
                            >
                                Make Changes
                            </button>
                        </div>
                    </>
                )}

                {stage === "booking" && (
                    <div className={styles.bookingState}>
                        <div className={styles.spinner} />
                        <h2>Booking your trip...</h2>
                        <p>Confirming flights, hotels, and experiences</p>
                    </div>
                )}

                {stage === "confirmed" && (
                    <div className={styles.bookingState}>
                        <div className={styles.checkmark}>&#10003;</div>
                        <h2>Trip Booked!</h2>
                        <p>
                            Your trip to {destination} has been confirmed.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
