'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import styles from './login-mock.module.css';
import rbacConfig from '../../../../../packages/shared-config/rbac/rbac-group-permissions.json';
import { usePostLogin } from '../../../src/hooks/generated';
import { useAuth } from '../../../src/lib/auth/AuthContext';

type GroupKey = keyof typeof rbacConfig.groups;
const groups = Object.entries(rbacConfig.groups) as [
  GroupKey,
  (typeof rbacConfig.groups)[GroupKey],
][];

export default function LoginMockPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [signingInAs, setSigningInAs] = useState<GroupKey | null>(null);
  const [lanId, setLanId] = useState('test.user');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect to /login when not in local dev — client-side only to avoid SSR calling notFound()
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_ENV !== 'local') {
      router.replace('/login');
    }
  }, [router]);

  const { mutate, isPending } = usePostLogin({
    mutation: {
      onSuccess(data) {
        if (data.status === 200 && data.data) {
          const { accessToken, user } = data.data;
          login(accessToken, {
            sub: user.sub,
            lanId: user.lanId,
            name: user.name,
            email: user.email,
            groups: user.groups,
          });
          router.replace('/secure');
        } else {
          setErrorMsg('Login failed. Unexpected response.');
        }
      },
      onError() {
        setErrorMsg('Login failed. Check your credentials or try again.');
      },
    },
  });

  useEffect(() => {
    setErrorMsg(null);
  }, [lanId]);

  function handleSubmit(groupKey: GroupKey) {
    setErrorMsg(null);
    setSigningInAs(groupKey);
    mutate({
      data: { lanId: lanId.trim(), groups: [groupKey] },
    });
  }

  return (
    <main className={styles.container}>
      <div className={styles.page}>
        <h1 className={styles.title}>Mock Login — Development Only</h1>
        <div className={styles.banner} role="status">
          This page is only available in development. Remove or disable it in production.
        </div>

        <div className={styles.lanIdRow}>
          <label htmlFor="lanId" className={styles.lanIdLabel}>
            LAN ID
          </label>
          <input
            id="lanId"
            type="text"
            className={styles.lanIdInput}
            value={lanId}
            onChange={(e) => setLanId(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        {errorMsg && (
          <div className={styles.error} role="alert">
            {errorMsg}
          </div>
        )}

        <ul className={styles.groupList} aria-label="Select a role to sign in as">
          {groups.map(([key, config]) => {
            const isSuperadmin = key === 'mx-superadmin';
            const permissionCount = config.permissions.length;
            return (
              <li key={key} className={styles.groupCard}>
                <div className={styles.groupInfo}>
                  <span className={styles.groupName}>{config.displayName}</span>
                  <span className={styles.groupDescription}>{config.description}</span>
                  <span className={styles.permissionCount}>
                    {isSuperadmin
                      ? 'Full access (all permissions)'
                      : `${permissionCount} permission${permissionCount !== 1 ? 's' : ''}`}
                  </span>
                  {!isSuperadmin && permissionCount > 0 && (
                    <ul
                      className={styles.permissionList}
                      aria-label={`Permissions for ${config.displayName}`}
                    >
                      {config.permissions.map((perm) => (
                        <li key={perm} className={styles.permissionTag}>
                          {perm}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.signInButton}
                  disabled={isPending || !lanId.trim()}
                  onClick={() => handleSubmit(key)}
                  aria-label={`Sign in as ${config.displayName}`}
                >
                  {isPending && signingInAs === key
                    ? 'Signing in…'
                    : `Sign in as ${config.displayName}`}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
