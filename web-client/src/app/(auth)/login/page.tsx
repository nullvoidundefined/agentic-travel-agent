'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { GoogleIcon } from '@/components/GoogleIcon/GoogleIcon';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

import styles from '../auth.module.scss';

export default function LoginPage() {
    const { login, loginWithGoogle, isLoading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields.');
            return;
        }

        try {
            await login(email, password);
            router.push('/trips');
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('Something went wrong. Please try again.');
            }
        }
    }

    async function handleGoogle() {
        setError('');
        try {
            await loginWithGoogle();
            router.push('/trips');
        } catch {
            setError('Google sign-in failed. Please try again.');
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <h1>Atlas</h1>
                    <p>Sign in to plan your next trip</p>
                </div>

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
                    How does Atlas work? &rarr;
                </Link>
            </div>
        </div>
    );
}
