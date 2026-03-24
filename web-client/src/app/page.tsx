'use client';

import Link from 'next/link';

import { MockChatBox } from '@/components/MockChatBox/MockChatBox';
import { useAuth } from '@/context/AuthContext';

import styles from './page.module.scss';

export default function Home() {
    const { user } = useAuth();

    return (
        <div className={styles.landing}>
            <section className={styles.hero}>
                <h1 className={styles.title}>
                    Where do you want to go
                    <br />
                    <span className={styles.accent}>
                        {user ? user.email.split('@')[0] : 'explorer'}?
                    </span>
                </h1>
                <p className={styles.subtitle}>
                    Tell the agent where you want to go, your budget, and your
                    dates. It searches real flights, hotels, and experiences to
                    build a complete itinerary.
                </p>
                <div className={styles.ctas}>
                    <Link href="/login" className={styles.primaryCta}>
                        Start Planning
                    </Link>
                    <Link href="/login" className={styles.secondaryCta}>
                        Sign In
                    </Link>
                </div>
            </section>

            <section className={styles.demo}>
                <MockChatBox />
            </section>

            <section className={styles.features}>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>&#9992;</span>
                    <h3>Real Flights</h3>
                    <p>
                        Searches Amadeus for actual flight prices and
                        availability.
                    </p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>&#127976;</span>
                    <h3>Real Hotels</h3>
                    <p>Finds hotels near your destination with live pricing.</p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>&#127919;</span>
                    <h3>Experiences</h3>
                    <p>
                        Discovers tours, restaurants, and activities via Google
                        Places.
                    </p>
                </div>
                <div className={styles.feature}>
                    <span className={styles.featureIcon}>&#128176;</span>
                    <h3>Budget-Aware</h3>
                    <p>
                        Tracks spending across every category to stay within
                        your budget.
                    </p>
                </div>
            </section>
        </div>
    );
}
