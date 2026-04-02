import styles from "./QuickReplyChips.module.scss";

interface QuickReplyChipsProps {
    chips: string[];
    onSelect: (text: string) => void;
    disabled?: boolean;
}

export function QuickReplyChips({
    chips,
    onSelect,
    disabled = false,
}: QuickReplyChipsProps) {
    return (
        <div className={styles.row} role="group" aria-label="Quick replies">
            {chips.map((chip) => (
                <button
                    key={chip}
                    type="button"
                    className={styles.chip}
                    onClick={() => onSelect(chip)}
                    disabled={disabled}
                >
                    {chip}
                </button>
            ))}
        </div>
    );
}

/**
 * Parse assistant text to extract quick-reply chip suggestions.
 * Returns null if the text doesn't warrant quick replies.
 */
export function parseQuickReplies(text: string): string[] | null {
    const trimmed = text.trim();

    if (!trimmed.endsWith("?")) {
        return null;
    }

    const lower = trimmed.toLowerCase();

    if (
        /would you like/i.test(lower) ||
        /shall i/i.test(lower) ||
        /should i/i.test(lower) ||
        /do you want/i.test(lower) ||
        /want me to/i.test(lower) ||
        /ready to/i.test(lower)
    ) {
        return ["Yes, please", "No thanks"];
    }

    const orMatch = trimmed.match(/(.{3,30}) or (.{3,30})\?$/);
    if (orMatch) {
        return [orMatch[1].trim(), orMatch[2].replace(/\?$/, "").trim()];
    }

    return null;
}
