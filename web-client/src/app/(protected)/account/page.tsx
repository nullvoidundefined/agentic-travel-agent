'use client';

import { useState } from 'react';

import { PreferencesWizard } from '@/components/PreferencesWizard/PreferencesWizard';
import { useAuth } from '@/context/AuthContext';
import { get } from '@/lib/api';
import { type UserPreferences } from '@/lib/preferenceOptions';
import { useQuery } from '@tanstack/react-query';

import styles from './account.module.scss';

interface Trip {
  id: string;
}

function initials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  if (firstName && lastName) {
    return (firstName[0] + lastName[0]).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPrefValue(value: string | string[] | null | undefined): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return 'Not set';
  if (Array.isArray(value)) return value.map(capitalize).join(', ');
  return capitalize(value.replace(/-/g, ' '));
}

const PREFERENCE_CATEGORIES: {
  label: string;
  key: keyof UserPreferences;
}[] = [
  { label: 'Accommodation', key: 'accommodation' },
  { label: 'Travel Pace', key: 'travel_pace' },
  { label: 'Dietary', key: 'dietary' },
  { label: 'Dining Style', key: 'dining_style' },
  { label: 'Activities', key: 'activities' },
  { label: 'Travel Party', key: 'travel_party' },
  { label: 'Budget Comfort', key: 'budget_comfort' },
];

export default function AccountPage() {
  const { user } = useAuth();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () =>
      get<{ preferences: UserPreferences | null }>('/user-preferences').then(
        (r) => r.preferences,
      ),
  });

  const { data: trips } = useQuery({
    queryKey: ['trips'],
    queryFn: () => get<{ trips: Trip[] }>('/trips').then((r) => r.trips),
  });

  const completedCount = preferences?.completed_steps?.length ?? 0;

  return (
    <div className={styles.page}>
      <h1>Account</h1>

      <section className={styles.section}>
        <h2>Profile</h2>
        <div className={styles.card}>
          <div className={styles.avatar}>
            {user
              ? initials(user.first_name, user.last_name, user.email)
              : '??'}
          </div>
          <div className={styles.info}>
            <p className={styles.name}>
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : (user?.email ?? 'Loading...')}
            </p>
            <p className={styles.email}>{user?.email}</p>
            <p className={styles.email}>
              Member since{' '}
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : '...'}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Preferences</h2>
        <div className={styles.card}>
          <div className={styles.prefHeader}>
            <span className={styles.prefCompletion}>
              {completedCount} of 6 categories completed
            </span>
            <button
              type='button'
              className={styles.editButton}
              onClick={() => setWizardOpen(true)}
            >
              Edit Preferences
            </button>
          </div>
          {PREFERENCE_CATEGORIES.map((cat) => (
            <div key={cat.key} className={styles.prefRow}>
              <span>{cat.label}</span>
              <span className={styles.prefValue}>
                {formatPrefValue(
                  preferences?.[cat.key] as string | string[] | null,
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Usage</h2>
        <div className={styles.card}>
          <div className={styles.prefRow}>
            <span>Trips planned</span>
            <span className={styles.prefValue}>{trips?.length ?? '...'}</span>
          </div>
        </div>
      </section>

      <PreferencesWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialPreferences={preferences ?? null}
      />
    </div>
  );
}
