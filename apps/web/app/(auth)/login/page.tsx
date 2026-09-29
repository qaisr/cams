'use client';

import Link from 'next/link';

import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in with PingID</h1>
        <div className={styles.banner} role="status">
          PingID SSO is not configured. Set <code>PINGID_*</code> environment variables to activate.
        </div>
        <button type="button" className={styles.button} disabled aria-disabled="true">
          Sign In
        </button>
        <Link href="/login-mock" className={styles.link}>
          Use mock login for development →
        </Link>
      </div>
    </main>
  );
}
