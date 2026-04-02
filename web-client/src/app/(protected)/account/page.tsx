"use client";

import { useAuth } from "@/context/AuthContext";
import { get } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

import styles from "./account.module.scss";

interface UserPreferences {
  dietary: string[];
  intensity: string;
  social: string;
}

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

export default function AccountPage() {
  const { user } = useAuth();

  const { data: preferences } = useQuery({
    queryKey: ["preferences"],
    queryFn: () =>
      get<{ preferences: UserPreferences | null }>("/user-preferences").then(
        (r) => r.preferences,
      ),
  });

  const { data: trips } = useQuery({
    queryKey: ["trips"],
    queryFn: () => get<{ trips: Trip[] }>("/trips").then((r) => r.trips),
  });

  return (
    <div className={styles.page}>
      <h1>Account</h1>

      <section className={styles.section}>
        <h2>Profile</h2>
        <div className={styles.card}>
          <div className={styles.avatar}>
            {user
              ? initials(user.first_name, user.last_name, user.email)
              : "??"}
          </div>
          <div className={styles.info}>
            <p className={styles.name}>
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : (user?.email ?? "Loading...")}
            </p>
            <p className={styles.email}>{user?.email}</p>
            <p className={styles.email}>
              Member since{" "}
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "..."}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Preferences</h2>
        <div className={styles.card}>
          <div className={styles.prefRow}>
            <span>Dietary</span>
            <span className={styles.prefValue}>
              {preferences?.dietary?.length
                ? preferences.dietary.map(capitalize).join(", ")
                : "Not set"}
            </span>
          </div>
          <div className={styles.prefRow}>
            <span>Travel Intensity</span>
            <span className={styles.prefValue}>
              {preferences?.intensity
                ? capitalize(preferences.intensity)
                : "Not set"}
            </span>
          </div>
          <div className={styles.prefRow}>
            <span>Usually Traveling</span>
            <span className={styles.prefValue}>
              {preferences?.social ? capitalize(preferences.social) : "Not set"}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Usage</h2>
        <div className={styles.card}>
          <div className={styles.prefRow}>
            <span>Trips planned</span>
            <span className={styles.prefValue}>{trips?.length ?? "..."}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
