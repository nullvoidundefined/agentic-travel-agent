import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Footer } from '@/components/Footer/Footer';
import { Header } from '@/components/Header/Header';
import { AuthProvider } from '@/context/AuthContext';
import { APP_NAME } from '@/lib/constants';
import { QueryProvider } from '@/providers/QueryProvider';

import './globals.scss';
import styles from './layout.module.scss';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: `${APP_NAME} — AI Trip Planner`,
    description:
        'Plan your next trip with an AI agent that searches flights, hotels, and experiences within your budget.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <QueryProvider>
                    <AuthProvider>
                        <div className={styles.appShell}>
                            <Header />
                            <main className={styles.main}>{children}</main>
                            <Footer />
                        </div>
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
