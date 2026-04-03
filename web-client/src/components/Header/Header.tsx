'use client';

import { useAuth } from '@/context/AuthContext';
import { get } from '@/lib/api';
import { APP_NAME } from '@/lib/constants';
import { type UserPreferences } from '@/lib/preferenceOptions';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './Header.module.scss';

const publicLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/faq', label: 'FAQ' },
];

const authedLinks = [
  { href: '/explore', label: 'Explore' },
  { href: '/trips', label: 'My Trips' },
  { href: '/account', label: 'Account' },
  { href: '/faq', label: 'FAQ' },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navLinks = user ? authedLinks : publicLinks;

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () =>
      get<{ preferences: UserPreferences | null }>('/user-preferences').then(
        (r) => r.preferences,
      ),
    enabled: !!user,
  });

  const prefsIncomplete =
    !!user && (preferences?.completed_steps?.length ?? 0) < 6;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href='/' className={styles.logo}>
          {APP_NAME}
          <svg
            className={styles.logoIcon}
            width='20'
            height='20'
            viewBox='0 0 32 32'
            aria-hidden='true'
          >
            <path
              d='M24 7 L10 15 L5 13 L24 7 Z'
              fill='currentColor'
              opacity='0.9'
            />
            <path
              d='M24 7 L12 19 L8 25 L24 7 Z'
              fill='currentColor'
              opacity='0.6'
            />
          </svg>
        </Link>
        <nav className={styles.nav} aria-label='Main navigation'>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
            >
              {link.label}
              {link.href === '/account' && prefsIncomplete && (
                <span
                  className={styles.incompleteBadge}
                  aria-label='Preferences incomplete'
                />
              )}
            </Link>
          ))}
        </nav>
        {user ? (
          <button className={styles.signIn} onClick={logout}>
            Sign Out
          </button>
        ) : (
          <Link href='/login' className={styles.signIn}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
