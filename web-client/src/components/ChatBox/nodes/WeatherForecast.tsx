import type {
  ChatNodeOfType,
  WeatherDay,
} from '@agentic-travel-agent/shared-types';

import styles from './WeatherForecast.module.scss';

interface WeatherForecastProps {
  node: ChatNodeOfType<'weather_forecast'>;
}

function formatDay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function DayCard({ day }: { day: WeatherDay }) {
  return (
    <div className={styles.dayCard}>
      <span className={styles.date}>{formatDay(day.date)}</span>
      <span className={styles.icon} aria-label={day.condition}>
        {day.icon}
      </span>
      <span className={styles.condition}>{day.condition}</span>
      <div className={styles.temps}>
        <span className={styles.high}>{Math.round(day.high_f)}&deg;</span>
        <span className={styles.low}>{Math.round(day.low_f)}&deg;</span>
      </div>
      {day.precipitation_chance > 0 && (
        <span className={styles.precip}>
          <span aria-hidden='true'>&#x1F4A7;</span> {day.precipitation_chance}%
        </span>
      )}
    </div>
  );
}

export function WeatherForecast({ node }: WeatherForecastProps) {
  return (
    <section className={styles.wrapper} aria-label='Weather forecast'>
      <h3 className={styles.heading}>Weather Forecast</h3>
      <div className={styles.scrollContainer} role='list'>
        {node.forecast.map((day) => (
          <div key={day.date} role='listitem'>
            <DayCard day={day} />
          </div>
        ))}
      </div>
    </section>
  );
}
