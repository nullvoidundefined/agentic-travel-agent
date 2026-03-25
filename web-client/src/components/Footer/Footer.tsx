import { APP_NAME } from '@/lib/constants';

import styles from './Footer.module.scss';

export function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <p className={styles.brand}>{APP_NAME}</p>
                <p className={styles.copy}>
                    AI-powered trip planning. Built with Claude.
                </p>
            </div>
        </footer>
    );
}
