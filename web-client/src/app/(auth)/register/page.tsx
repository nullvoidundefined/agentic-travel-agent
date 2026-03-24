'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { Toast } from '@/components/Toast/Toast';
import { useAuth } from '@/context/AuthContext';
import { ApiError, put } from '@/lib/api';

import styles from '../auth.module.scss';

const DIETARY_OPTIONS = [
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' },
    { value: 'halal', label: 'Halal' },
    { value: 'kosher', label: 'Kosher' },
    { value: 'gluten-free', label: 'Gluten-free' },
    { value: 'dairy-free', label: 'Dairy-free' },
    { value: 'nut-free', label: 'Nut-free' },
    { value: 'none', label: 'No restrictions' },
] as const;

const INTENSITY_OPTIONS = [
    {
        value: 'relaxed',
        label: 'Relaxed',
        description: 'Slow pace, lots of downtime',
    },
    {
        value: 'moderate',
        label: 'Moderate',
        description: 'Balanced mix of activity and rest',
    },
    {
        value: 'active',
        label: 'Active',
        description: 'Packed schedule, see everything',
    },
] as const;

const SOCIAL_OPTIONS = [
    { value: 'solo', label: 'Solo' },
    { value: 'couple', label: 'Couple' },
    { value: 'group', label: 'Group' },
    { value: 'family', label: 'Family' },
] as const;

export default function RegisterPage() {
    const { signup, isLoading } = useAuth();
    const router = useRouter();

    // Step management
    const [step, setStep] = useState<1 | 2>(1);

    // Step 1 fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Step 2 fields
    const [dietary, setDietary] = useState<string[]>([]);
    const [intensity, setIntensity] = useState('moderate');
    const [social, setSocial] = useState('couple');

    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    function handleStepOne(e: FormEvent) {
        e.preventDefault();
        setError('');

        if (!name || !email || !password) {
            setError('Please fill in all fields.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setStep(2);
    }

    function toggleDietary(value: string) {
        setDietary((prev) => {
            if (value === 'none') {
                return prev.includes('none') ? [] : ['none'];
            }
            const without = prev.filter((d) => d !== 'none');
            return without.includes(value)
                ? without.filter((d) => d !== value)
                : [...without, value];
        });
    }

    async function handleStepTwo(e: FormEvent) {
        e.preventDefault();
        setToast('');

        try {
            await signup(email, password);
            await put('/user-preferences', { dietary, intensity, social });
            router.push('/trips/new');
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
                    <h1>Atlas</h1>
                    <p>
                        {step === 1
                            ? 'Create an account to get started'
                            : 'Tell us about your travel style'}
                    </p>
                </div>

                {/* Step indicator */}
                <div className={styles.steps}>
                    <div
                        className={`${styles.stepDot} ${step >= 1 ? styles.stepActive : ''}`}
                    />
                    <div className={styles.stepLine} />
                    <div
                        className={`${styles.stepDot} ${step >= 2 ? styles.stepActive : ''}`}
                    />
                </div>

                {step === 1 && (
                    <>
                        {/* TODO: Google OAuth
                        <button
                            type="button"
                            className={styles.googleButton}
                            onClick={handleGoogle}
                            disabled={isLoading}
                        >
                            <GoogleIcon />
                            Sign up with Google
                        </button>

                        <div className={styles.divider}>
                            <span>or</span>
                        </div>
                        */}

                        <form onSubmit={handleStepOne} className={styles.form}>
                            <label className={styles.field}>
                                <span>Name</span>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                    autoComplete="name"
                                />
                            </label>

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
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                />
                            </label>

                            {error && <p className={styles.error}>{error}</p>}

                            <button
                                type="submit"
                                className={styles.submit}
                                disabled={isLoading}
                            >
                                Continue
                            </button>
                        </form>
                    </>
                )}

                {step === 2 && (
                    <form onSubmit={handleStepTwo} className={styles.form}>
                        <fieldset className={styles.fieldset}>
                            <legend>Dietary preferences</legend>
                            <div className={styles.chipGroup}>
                                {DIETARY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`${styles.chip} ${dietary.includes(opt.value) ? styles.chipSelected : ''}`}
                                        onClick={() => toggleDietary(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className={styles.fieldset}>
                            <legend>Travel intensity</legend>
                            <div className={styles.optionGroup}>
                                {INTENSITY_OPTIONS.map((opt) => (
                                    <label
                                        key={opt.value}
                                        className={`${styles.optionCard} ${intensity === opt.value ? styles.optionSelected : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="intensity"
                                            value={opt.value}
                                            checked={intensity === opt.value}
                                            onChange={() =>
                                                setIntensity(opt.value)
                                            }
                                            className={styles.srOnly}
                                        />
                                        <span className={styles.optionLabel}>
                                            {opt.label}
                                        </span>
                                        <span className={styles.optionDesc}>
                                            {opt.description}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className={styles.fieldset}>
                            <legend>Usually traveling</legend>
                            <div className={styles.chipGroup}>
                                {SOCIAL_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        className={`${styles.chip} ${social === opt.value ? styles.chipSelected : ''}`}
                                        onClick={() => setSocial(opt.value)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className={styles.stepButtons}>
                            <button
                                type="button"
                                className={styles.backButton}
                                onClick={() => {
                                    setError('');
                                    setStep(1);
                                }}
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                className={styles.submit}
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? 'Creating account...'
                                    : 'Create Account'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 1 && (
                    <>
                        <p className={styles.terms}>
                            By signing up, you agree to our{' '}
                            <Link href="/faq">Terms of Service</Link> and{' '}
                            <Link href="/faq">Privacy Policy</Link>.
                        </p>

                        <p className={styles.switchLink}>
                            Already have an account?{' '}
                            <Link href="/login">Sign in</Link>
                        </p>

                        <Link href="/faq" className={styles.faqLink}>
                            How does Atlas work? &rarr;
                        </Link>
                    </>
                )}
            </div>

            {toast && <Toast message={toast} onClose={() => setToast('')} />}
        </div>
    );
}
