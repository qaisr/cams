'use client';

import styles from './secure.module.css';
import { useGetAuthMePermissions } from '../../../src/hooks/generated';
import { useAuth } from '../../../src/lib/auth/AuthContext';

export default function SecurePage() {
  const { user, logout } = useAuth();
  const { data: response, isLoading, isError } = useGetAuthMePermissions();
  const permissions = response?.status === 200 ? response.data : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <button type="button" className={styles.signOutButton} onClick={logout}>
          Sign Out
        </button>
      </header>

      <section className={styles.card} aria-labelledby="identity-heading">
        <h2 id="identity-heading" className={styles.sectionTitle}>
          Identity
        </h2>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>LAN ID</span>
          <span className={styles.fieldValue}>{user?.lanId ?? '—'}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Name</span>
          <span className={styles.fieldValue}>{user?.name ?? '—'}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Email</span>
          <span className={styles.fieldValue}>{user?.email ?? '—'}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Groups</span>
          {user?.groups.length ? (
            <ul className={styles.tagList} aria-label="User groups">
              {user.groups.map((g) => (
                <li key={g} className={styles.tag}>
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <span className={styles.emptyText}>No groups</span>
          )}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="permissions-heading" aria-busy={isLoading}>
        <h2 id="permissions-heading" className={styles.sectionTitle}>
          Effective Permissions
        </h2>

        {isLoading && (
          <div className={styles.loading} role="status" aria-live="polite">
            Loading permissions…
          </div>
        )}

        {isError && (
          <div className={styles.errorBox} role="alert">
            Failed to load permissions. Please refresh the page.
          </div>
        )}

        {permissions && (
          <>
            {permissions.isSuperadmin && (
              <div className={styles.fieldRow}>
                <span className={styles.superadminBadge}>Superadmin</span>
              </div>
            )}
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Permissions</span>
              {permissions.effectivePermissions.length ? (
                <ul className={styles.tagList} aria-label="Effective permissions">
                  {permissions.effectivePermissions.map((p) => (
                    <li key={p} className={styles.tag}>
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className={styles.emptyText}>
                  {permissions.isSuperadmin
                    ? 'All permissions (superadmin)'
                    : 'No explicit permissions'}
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
