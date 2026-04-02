import styles from "./HotelCard.module.scss";

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
    selected = false,
    onClick,
}: HotelCardProps) {
    const fmtPrice = (n: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(n);

    const fmtDate = (d: string) => {
        const date = new Date(d + "T00:00:00");
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const stars =
        starRating != null ? "\u2605".repeat(Math.round(starRating)) : null;

    return (
        <button
            type="button"
            className={`${styles.card} ${selected ? styles.selected : ""}`}
            aria-pressed={selected}
            onClick={onClick}
        >
            <div className={styles.imageArea}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        className={styles.image}
                    />
                ) : (
                    <div className={styles.imageFallback} />
                )}
            </div>

            <div className={styles.body}>
                <span className={styles.name}>{name}</span>
                {stars && <span className={styles.stars}>{stars}</span>}
                <span className={styles.city}>{city}</span>
                <span className={styles.dates}>
                    {fmtDate(checkIn)} &ndash; {fmtDate(checkOut)}
                </span>
                <div className={styles.pricing}>
                    <span className={styles.perNight}>
                        {fmtPrice(pricePerNight)}
                        <small>/night</small>
                    </span>
                    <span className={styles.total}>
                        {fmtPrice(totalPrice)} total
                    </span>
                </div>
            </div>
        </button>
    );
}
