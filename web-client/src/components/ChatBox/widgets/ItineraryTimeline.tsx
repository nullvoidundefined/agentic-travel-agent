'use client';

import { useState } from 'react';

import styles from './ItineraryTimeline.module.scss';

interface DayPlan {
  dayNumber: number;
  title: string;
  items: string[];
}

interface ItineraryTimelineProps {
  days: DayPlan[];
}

export function ItineraryTimeline({ days }: ItineraryTimelineProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    new Set([days[0]?.dayNumber]),
  );

  const toggle = (dayNumber: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  return (
    <div className={styles.timeline}>
      {days.map((day) => {
        const expanded = expandedDays.has(day.dayNumber);
        return (
          <div key={day.dayNumber} className={styles.dayCard}>
            <button
              type='button'
              className={styles.dayHeader}
              onClick={() => toggle(day.dayNumber)}
              aria-expanded={expanded}
            >
              <span className={styles.dayBadge}>Day {day.dayNumber}</span>
              <span className={styles.dayTitle}>{day.title}</span>
              <span className={styles.chevron}>
                {expanded ? '\u2212' : '+'}
              </span>
            </button>
            <div
              className={`${styles.itemList} ${expanded ? styles.expanded : ''}`}
            >
              <ul>
                {day.items.map((item, i) => (
                  <li key={i} className={styles.item}>
                    <span className={styles.bullet} aria-hidden='true' />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
