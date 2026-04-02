"use client";

import { useAuth } from "@/context/AuthContext";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./Header.module.scss";

const publicLinks = [{ href: "/faq", label: "FAQ" }];

const authedLinks = [
  { href: "/trips", label: "My Trips" },
  { href: "/account", label: "Account" },
  { href: "/faq", label: "FAQ" },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navLinks = user ? authedLinks : publicLinks;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          {APP_NAME}
          <span className={styles.logoAccent}>.</span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.active : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <button className={styles.signIn} onClick={logout}>
            Sign Out
          </button>
        ) : (
          <Link href="/login" className={styles.signIn}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
