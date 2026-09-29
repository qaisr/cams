import { loadRbacConfig, resetRbacConfigCache } from './rbac-config';

describe('rbac-config', () => {
  beforeEach(() => {
    resetRbacConfigCache();
  });

  it('loads and parses the RBAC config file', () => {
    const config = loadRbacConfig();
    expect(config).toBeDefined();
    expect(config.version).toBeDefined();
    expect(typeof config.groups).toBe('object');
  });

  it('all 5 groups are present', () => {
    const config = loadRbacConfig();
    const groupKeys = Object.keys(config.groups);
    expect(groupKeys).toContain('mx-superadmin');
    expect(groupKeys).toContain('mx-admin');
    expect(groupKeys).toContain('mx-requestor');
    expect(groupKeys).toContain('mx-user');
    expect(groupKeys).toContain('mx-negotiator');
    expect(groupKeys).toHaveLength(5);
  });

  it('mx-superadmin has empty permissions array', () => {
    const config = loadRbacConfig();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(config.groups['mx-superadmin']!.permissions).toEqual([]);
  });

  it('mx-admin has correct permissions', () => {
    const config = loadRbacConfig();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const adminPerms = config.groups['mx-admin']!.permissions;
    expect(adminPerms).toContain('app:admin');
    expect(adminPerms).toContain('doc:admin');
    expect(adminPerms).toContain('workflow:admin');
  });

  it('mx-user has deny:legal-opinions', () => {
    const config = loadRbacConfig();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(config.groups['mx-user']!.permissions).toContain('deny:legal-opinions');
  });

  it('caches the config on subsequent calls', () => {
    const first = loadRbacConfig();
    const second = loadRbacConfig();
    expect(first).toBe(second);
  });

  it('reloads after cache reset', () => {
    const first = loadRbacConfig();
    resetRbacConfigCache();
    const second = loadRbacConfig();
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
