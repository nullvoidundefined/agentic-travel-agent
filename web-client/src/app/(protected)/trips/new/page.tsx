'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ChatBox } from '@/components/ChatBox/ChatBox';
import { post } from '@/lib/api';

import styles from '../[id]/tripDetail.module.scss';

interface Trip {
    id: string;
}

export default function NewTripPage() {
    const router = useRouter();
    const [tripId, setTripId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const creating = useRef(false);

    useEffect(() => {
        if (creating.current) {
            return;
        }
        creating.current = true;

        post<{ trip: Trip }>('/trips', { destination: 'Planning...' })
            .then(({ trip }) => {
                setTripId(trip.id);
                router.replace(`/trips/${trip.id}`);
            })
            .catch(() => {
                setError('Failed to start a new trip. Please try again.');
                creating.current = false;
            });
    }, [router]);

    if (error) {
        return (
            <div className={styles.page}>
                <Link href="/trips" className={styles.back}>
                    &larr; Back to trips
                </Link>
                <p>{error}</p>
            </div>
        );
    }

    if (!tripId) {
        return (
            <div className={styles.page}>
                <p>Starting new trip...</p>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <Link href="/trips" className={styles.back}>
                &larr; Back to trips
            </Link>

            <div className={styles.header}>
                <div>
                    <h1>New Trip</h1>
                    <p className={styles.dates}>
                        Tell Atlas where you want to go
                    </p>
                </div>
            </div>

            <div className={styles.chatSection}>
                <h2>Chat with Atlas</h2>
                <ChatBox tripId={tripId} />
            </div>
        </div>
    );
}
