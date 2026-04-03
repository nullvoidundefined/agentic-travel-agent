'use client';

import { useEffect, useState } from 'react';

import {
  CATEGORY_FILTERS,
  DESTINATIONS,
  type Destination,
} from '@/data/destinations';
import {
  HERO_IMAGES,
  getDestinationImage,
  getDestinationImageUrl,
} from '@/lib/destinationImage';
import Image from 'next/image';
import Link from 'next/link';

import styles from './page.module.scss';

function formatCategory(value: string): string {
  const found = CATEGORY_FILTERS.find((f) => f.value === value);
  if (found && found.value !== 'all') return found.label;
  // Fallback for any value not in the filter list
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ExplorePage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered: Destination[] =
    activeCategory === 'all'
      ? DESTINATIONS
      : DESTINATIONS.filter((d) => d.categories.includes(activeCategory));

  return (
    <div className={styles.page}>
      {/* — Hero — */}
      <section className={styles.hero} aria-label='Explore destinations hero'>
        {HERO_IMAGES.map((img, i) => (
          <Image
            key={img.city}
            src={getDestinationImageUrl(img.id, 1600, 800)}
            alt={`${img.city} destination`}
            fill
            className={`${styles.heroImage} ${i === heroIndex ? styles.heroImageActive : ''}`}
            priority={i === 0}
            sizes='100vw'
          />
        ))}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>30 Curated Destinations</p>
          <h1 className={styles.heroTitle}>Discover your next adventure</h1>
          <p className={styles.heroSubtitle}>
            Explore handpicked destinations with local tips, dining
            recommendations, and insider knowledge — then plan your perfect trip
            with AI.
          </p>
        </div>
      </section>

      {/* — Filters — */}
      <section
        className={styles.filtersSection}
        aria-label='Filter destinations by category'
      >
        <div className={styles.filters}>
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterPill} ${activeCategory === filter.value ? styles.filterPillActive : ''}`}
              onClick={() => setActiveCategory(filter.value)}
              aria-pressed={activeCategory === filter.value}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {/* — Grid — */}
      <section className={styles.gridSection} aria-label='Destination cards'>
        <p className={styles.resultCount}>
          {filtered.length}{' '}
          {filtered.length === 1 ? 'destination' : 'destinations'}
        </p>
        <div className={styles.grid}>
          {filtered.map((dest) => {
            const { url: imageUrl } = getDestinationImage(dest.name);
            return (
              <Link
                key={dest.slug}
                href={`/explore/${dest.slug}`}
                className={styles.card}
                aria-label={`${dest.name}, ${dest.country}`}
              >
                <div className={styles.cardImage}>
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={dest.name}
                      fill
                      sizes='(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw'
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className={styles.cardImageFallback}
                      aria-hidden='true'
                    >
                      {dest.name}
                    </div>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardCity}>{dest.name}</h3>
                  <p className={styles.country}>{dest.country}</p>
                  <div className={styles.cardMeta}>
                    <span
                      className={styles.price}
                      aria-label={`Price level: ${'$'.repeat(dest.price_level)}`}
                    >
                      {'$'.repeat(dest.price_level)}
                    </span>
                    <span className={styles.season}>
                      Best: {dest.best_season}
                    </span>
                  </div>
                  <div className={styles.tags} aria-label='Categories'>
                    {dest.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className={styles.tag}>
                        {formatCategory(cat)}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
