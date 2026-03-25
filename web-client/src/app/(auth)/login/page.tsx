'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { Toast } from '@/components/Toast/Toast';
import { useAuth } from '@/context/AuthContext';
import { ApiError, get } from '@/lib/api';
import { APP_NAME } from '@/lib/constants';

import styles from '../auth.module.scss';

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }

        try {
            await login(email, password);
            const { trips } = await get<{
                trips: { id: string }[];
            }>('/trips');
            router.push(trips.length > 0 ? '/trips' : '/trips/new');
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.message
                    : 'Something went wrong. Please try again.';
            setToast(msg);
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1>{APP_NAME}</h1>
                    <p>Sign in to plan your next trip</p>
                </div>

                {/* TODO: Google OAuth
                <button
                    type="button"
                    className={styles.googleButton}
                    onClick={handleGoogle}
                    disabled={isLoading}
                >
                    <GoogleIcon />
                    Continue with Google
                </button>

                <div className={styles.divider}>
                    <span>or</span>
                </div>
                */}

                <form onSubmit={handleSubmit} className={styles.form}>
                    <label className={styles.field}>
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                        />
                    </label>

                    <label className={styles.field}>
                        <span>Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </label>

                    <div className={styles.forgotLink}>
                        <Link href="/login">Forgot password?</Link>
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    <button
                        type="submit"
                        className={styles.submit}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className={styles.switchLink}>
                    Don&apos;t have an account?{' '}
                    <Link href="/register">Sign up</Link>
                </p>

                <Link href="/faq" className={styles.faqLink}>
                    How does {APP_NAME} work? &rarr;
                </Link>
            </div>

            {toast && <Toast message={toast} onClose={() => setToast('')} />}
        </div>
    );
}
