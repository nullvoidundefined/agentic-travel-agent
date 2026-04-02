import styles from "./FlightCard.module.scss";

interface FlightCardProps {
    airline: string;
    airlineLogo: string | null;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    price: number;
    currency: string;
    selected?: boolean;
    onClick?: () => void;
}

export function FlightCard({
    airline,
    airlineLogo,
    flightNumber,
    origin,
    destination,
    departureTime,
    price,
    currency,
    selected = false,
    onClick,
}: FlightCardProps) {
    const fallbackCode = airline.slice(0, 2).toUpperCase();

    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);

    return (
        <button
            type="button"
            className={`${styles.card} ${selected ? styles.selected : ""}`}
            aria-pressed={selected}
            onClick={onClick}
        >
            <div className={styles.logo}>
                {airlineLogo ? (
                    <img
                        src={airlineLogo}
                        alt={`${airline} logo`}
                        className={styles.logoImg}
                    />
                ) : (
                    <span className={styles.logoFallback}>{fallbackCode}</span>
                )}
            </div>

            <div className={styles.details}>
                <span className={styles.airlineLine}>
                    {airline} &middot; {flightNumber}
                </span>
                <span className={styles.route}>
                    {origin} &rarr; {destination}
                </span>
                <span className={styles.time}>{departureTime}</span>
            </div>

            <div className={styles.price}>{formattedPrice}</div>
        </button>
    );
}
