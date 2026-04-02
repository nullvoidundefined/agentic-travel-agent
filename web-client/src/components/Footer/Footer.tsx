import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

import styles from "./Footer.module.scss";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <p className={styles.logo}>{APP_NAME}.</p>
          <p className={styles.tagline}>AI-powered travel concierge</p>
        </div>
        <nav className={styles.links} aria-label="Footer navigation">
          <Link href="/faq">FAQ</Link>
          <span className={styles.dot} aria-hidden="true" />
          <Link href="/login">Sign In</Link>
          <span className={styles.dot} aria-hidden="true" />
          <Link href="/register">Get Started</Link>
        </nav>
      </div>
    </footer>
  );
}
