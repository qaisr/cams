'use client';

import accessDeniedStyles from './access-denied.module.css';
import styles from './role-permissions.module.css';
import rbacConfig from '../../../../../packages/shared-config/rbac/rbac-group-permissions.json';
import { useAuth } from '../../../src/lib/auth/AuthContext';

const ADMIN_GROUPS = ['mx-superadmin', 'mx-admin'];

function AccessDenied() {
  return (
    <div className={accessDeniedStyles.container} role="alert" aria-live="polite">
      <p className={accessDeniedStyles.code} aria-hidden="true">
        403
      </p>
      <h2 className={accessDeniedStyles.heading}>Access Denied</h2>
      <p className={accessDeniedStyles.message}>
        You do not have permission to view this page. Contact your administrator to request access.
      </p>
    </div>
  );
}

type GroupKey = keyof typeof rbacConfig.groups;
const groupEntries = Object.entries(rbacConfig.groups) as [
  GroupKey,
  (typeof rbacConfig.groups)[GroupKey],
][];

const STRATEGY_SECTIONS = [
  {
    heading: 'How Access Is Determined',
    text: 'Your access comes from one or more PingID groups assigned to your account. Each group maps to permissions in the RBAC policy. If you have multiple groups, your effective access is the combined set of all allowed permissions.',
  },
  {
    heading: 'Allow and Deny Rules',
    text: 'Allow permissions grant access to pages or actions. Deny permissions explicitly block access and override allows. Example: deny:legal-opinions blocks /legal-opinions routes/actions even when other read/create permissions exist.',
  },
  {
    heading: 'Superadmin Behavior',
    text: 'mx-superadmin is treated as full access across the platform. In the permissions table this may appear as an empty list in config, but the effective behavior is full privilege.',
  },
  {
    heading: 'Route and Action Checks',
    text: 'Route-level deny checks decide whether a page can be opened. Action-level checks decide whether buttons/actions (create, edit, delete, approve) are available. Some pages may be visible but specific actions remain restricted.',
  },
  {
    heading: 'Why This Matters for Users',
    text: 'This is why two users may see different menus, pages, or actions. Access changes are managed by authorized administrators through role/group assignments.',
  },
  {
    heading: 'How To Request Access Changes',
    text: 'To request changes to your access level, contact your application administrator or security team.',
  },
];

function getNote(groupKey: string): string {
  if (groupKey === 'mx-superadmin') {
    return 'Full access — bypasses all RBAC checks';
  }
  return '';
}

export default function RolePermissionsPage() {
  const { user } = useAuth();

  const isAuthorized = user !== null && user.groups.some((g) => ADMIN_GROUPS.includes(g));

  if (!isAuthorized) {
    return (
      <main className={styles.page} aria-label="Role permissions administration">
        <AccessDenied />
      </main>
    );
  }

  return (
    <main className={styles.page} aria-label="Role permissions administration">
      <h1 className={styles.pageTitle}>Role Permissions</h1>

      <section className={styles.section} aria-labelledby="matrix-heading">
        <h2 id="matrix-heading" className={styles.sectionHeading}>
          Role-Permission Matrix
        </h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption>
              Read-only view of all roles and their assigned permissions sourced from the RBAC
              policy.
            </caption>
            <thead>
              <tr>
                <th scope="col">Role Name</th>
                <th scope="col">Role ID</th>
                <th scope="col">Permissions</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {groupEntries.map(([key, config]) => (
                <tr key={key}>
                  <td>{config.displayName}</td>
                  <td>
                    <span className={styles.chip}>{key}</span>
                  </td>
                  <td>
                    {config.permissions.length === 0 ? (
                      <span className={styles.emptyPermissions}>—</span>
                    ) : (
                      <ul
                        className={styles.chipList}
                        aria-label={`Permissions for ${config.displayName}`}
                      >
                        {config.permissions.map((perm) => (
                          <li
                            key={perm}
                            className={`${styles.chip}${perm.startsWith('deny:') ? ` ${styles.chipDeny}` : ''}`}
                          >
                            {perm}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className={styles.noteCell}>{getNote(key)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="strategy-heading">
        <h2 id="strategy-heading" className={styles.sectionHeading}>
          Authorization Strategy
        </h2>
        {STRATEGY_SECTIONS.map(({ heading, text }) => (
          <div key={heading} className={styles.strategySection}>
            <h3 className={styles.strategyHeading}>{heading}</h3>
            <p className={styles.strategyText}>{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
