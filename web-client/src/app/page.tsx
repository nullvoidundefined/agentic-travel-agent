"use client";

import { useEffect } from "react";

import { MockChatBox } from "@/components/MockChatBox/MockChatBox";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "./page.module.scss";

const FEATURES = [
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
    title: "Real Flights",
    desc: "Live prices from Google Flights. Compares options and picks the best value for your budget.",
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
        <path d="M9 9v.01" />
        <path d="M9 12v.01" />
        <path d="M9 15v.01" />
        <path d="M9 18v.01" />
      </svg>
    ),
    title: "Curated Hotels",
    desc: "Searches Google Hotels by location, dates, and star rating within your price range.",
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
    title: "Local Experiences",
    desc: "Discovers restaurants, tours, and hidden gems via Google Places.",
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: "Budget-Aware",
    desc: "Tracks spending across every category. Never goes over your limit.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Describe your trip",
    desc: "Tell the concierge where, when, and your budget.",
  },
  {
    num: "02",
    title: "Agent searches",
    desc: "It calls 3-8 real APIs per turn, reasoning between each.",
  },
  {
    num: "03",
    title: "Review & iterate",
    desc: "Refine conversationally until the itinerary is perfect.",
  },
];

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/trips");
    }
  }, [user, router]);

  return (
    <div className={styles.landing}>
      {/* — Hero — */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>AI Travel Concierge</p>
          <h1 className={styles.title}>
            Your next journey,
            <br />
            <span className={styles.titleAccent}>planned by AI.</span>
          </h1>
          <p className={styles.subtitle}>
            Describe your dream trip. Our agent searches real flights, hotels,
            and experiences — then assembles a complete, budget-aware itinerary
            in seconds.
          </p>
          <div className={styles.ctas}>
            <Link href="/register" className={styles.primaryCta}>
              Start Planning
            </Link>
            <Link href="/faq" className={styles.secondaryCta}>
              How it Works
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroGlow} aria-hidden="true" />
        </div>
      </section>

      {/* — Demo — */}
      <section className={styles.demo}>
        <div className={styles.demoHeader}>
          <h2 className={styles.sectionTitle}>See it in action</h2>
          <p className={styles.sectionSubtitle}>
            Watch the agent plan a 5-day Barcelona trip in real time
          </p>
        </div>
        <div className={styles.demoBox}>
          <MockChatBox />
        </div>
      </section>

      {/* — How it works — */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>
          Three steps to your perfect trip
        </h2>
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <div key={step.num} className={styles.step}>
              <span className={styles.stepNum}>{step.num}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* — Features — */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Real data. Real decisions.</h2>
        <p className={styles.sectionSubtitle}>
          No hallucinated prices. Every recommendation comes from live API data.
        </p>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* — Final CTA — */}
      <section className={styles.finalCta}>
        <h2>Ready to go?</h2>
        <p>Create a free account and plan your first trip in under a minute.</p>
        <Link href="/register" className={styles.primaryCta}>
          Get Started Free
        </Link>
      </section>
    </div>
  );
}
