import styles from "./ExperienceCard.module.scss";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ExperienceCardProps {
    name: string;
    category: string | null;
    photoRef: string | null;
    rating: number | null;
    estimatedCost: number | null;
    selected?: boolean;
    onClick?: () => void;
}

export function ExperienceCard({
    name,
    category,
    photoRef,
    rating,
    estimatedCost,
    selected = false,
    onClick,
}: ExperienceCardProps) {
    const photoUrl = photoRef
        ? `${API_BASE}/places/photo?ref=${encodeURIComponent(photoRef)}&maxwidth=400`
        : null;

    return (
        <button
            type="button"
            className={`${styles.card} ${selected ? styles.selected : ""}`}
            aria-pressed={selected}
            onClick={onClick}
        >
            <div className={styles.imageArea}>
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={name}
                        className={styles.image}
                    />
                ) : (
                    <div className={styles.imageFallback} />
                )}
            </div>

            <div className={styles.body}>
                <span className={styles.name}>{name}</span>
                {category && (
                    <span className={styles.category}>{category}</span>
                )}
                {rating != null && (
                    <span className={styles.rating}>
                        {"\u2605"} {rating.toFixed(1)}
                    </span>
                )}
                {estimatedCost != null && (
                    <span className={styles.cost}>~${estimatedCost}</span>
                )}
            </div>
        </button>
    );
}
