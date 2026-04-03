'use client';

import { type FormEvent, useState } from 'react';

import { PreferencesWizard } from '@/components/PreferencesWizard/PreferencesWizard';
import { Toast } from '@/components/Toast/Toast';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { APP_NAME } from '@/lib/constants';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from '../auth.module.scss';

export default function RegisterPage() {
  const { signup, isLoading } = useAuth();
  const router = useRouter();

  // Step 1: fill in account details
  // Step 2: wizard is open (account already created)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  async function handleStepOne(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    try {
      await signup(email, password, firstName, lastName);
      setStep(2);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      setToast(msg);
    }
  }

  function handleWizardClose() {
    router.push('/trips/new');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{APP_NAME}</h1>
          <p>Create an account to get started</p>
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
              <div className={styles.nameRow}>
                <label className={styles.field}>
                  <span>First name</span>
                  <input
                    type='text'
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder='First name'
                    autoComplete='given-name'
                  />
                </label>
                <label className={styles.field}>
                  <span>Last name</span>
                  <input
                    type='text'
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder='Last name'
                    autoComplete='family-name'
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='you@example.com'
                  autoComplete='email'
                />
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <input
                  type='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='At least 8 characters'
                  autoComplete='new-password'
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button
                type='submit'
                className={styles.submit}
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Continue'}
              </button>
            </form>

            <p className={styles.terms}>
              By signing up, you agree to our{' '}
              <Link href='/faq'>Terms of Service</Link> and{' '}
              <Link href='/faq'>Privacy Policy</Link>.
            </p>

            <p className={styles.switchLink}>
              Already have an account? <Link href='/login'>Sign in</Link>
            </p>

            <Link href='/faq' className={styles.faqLink}>
              How does {APP_NAME} work? &rarr;
            </Link>
          </>
        )}
      </div>

      {/* Step 2: preferences wizard opens as modal after account creation */}
      <PreferencesWizard
        isOpen={step === 2}
        onClose={handleWizardClose}
        initialPreferences={null}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
