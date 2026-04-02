"use client";

import { type ReactNode, useState } from "react";

import styles from "./SelectableCardGroup.module.scss";

interface SelectableCardGroupProps {
    items: Array<{
        id: string;
        label: string;
        node: (selected: boolean, onClick: () => void) => ReactNode;
    }>;
    onConfirm: (selectedLabel: string) => void;
    disabled?: boolean;
    confirmedId?: string | null;
}

export function SelectableCardGroup({
    items,
    onConfirm,
    disabled = false,
    confirmedId,
}: SelectableCardGroupProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const isConfirmed = confirmedId != null;
    const activeId = isConfirmed ? confirmedId : selectedId;

    const handleSelect = (id: string) => {
        if (isConfirmed || disabled) return;
        setSelectedId((prev) => (prev === id ? null : id));
    };

    const handleConfirm = () => {
        if (!selectedId || isConfirmed || disabled) return;
        const item = items.find((i) => i.id === selectedId);
        if (item) {
            onConfirm(item.label);
        }
    };

    const confirmedLabel = isConfirmed
        ? items.find((i) => i.id === confirmedId)?.label
        : null;

    return (
        <div className={styles.group}>
            <div className={styles.scrollContainer}>
                {items.map((item) =>
                    item.node(item.id === activeId, () =>
                        handleSelect(item.id),
                    ),
                )}
            </div>

            {isConfirmed && confirmedLabel ? (
                <span className={styles.confirmed}>
                    {"\u2713"} {confirmedLabel}
                </span>
            ) : (
                selectedId && (
                    <button
                        type="button"
                        className={styles.confirmButton}
                        onClick={handleConfirm}
                        disabled={disabled}
                    >
                        Confirm Selection
                    </button>
                )
            )}
        </div>
    );
}
