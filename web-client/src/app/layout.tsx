import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { Footer } from "@/components/Footer/Footer";
import { Header } from "@/components/Header/Header";
import { AuthProvider } from "@/context/AuthContext";
import { APP_NAME } from "@/lib/constants";
import { QueryProvider } from "@/providers/QueryProvider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";

import "./globals.scss";
import styles from "./layout.module.scss";

export const metadata: Metadata = {
  title: `${APP_NAME} — AI Travel Concierge`,
  description:
    "Plan your next trip with an AI concierge that searches flights, hotels, and experiences within your budget.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <div className={styles.appShell}>
              <Header />
              <main className={styles.main}>
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
              <Footer />
            </div>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
