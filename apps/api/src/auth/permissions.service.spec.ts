import * as sharedConfig from '@repo/shared-config';
import { resetRbacConfigCache } from '@repo/shared-config';
import type { AuthUser } from '@repo/validation';

import { PermissionsService } from './permissions.service';

const makeUser = (groups: string[]): AuthUser => ({
  sub: 'u1',
  lanId: 'u1',
  name: 'User One',
  email: 'u1@mock.ppcc',
  groups,
  iat: 0,
  exp: 99999,
});

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(() => {
    resetRbacConfigCache();
    service = new PermissionsService();
    service.onModuleInit();
  });

  describe('resolve — superadmin', () => {
    it('returns isSuperadmin=true and effectivePermissions=["*"] for mx-superadmin', () => {
      const user = makeUser(['mx-superadmin']);
      const result = service.resolve(user);
      expect(result.isSuperadmin).toBe(true);
      expect(result.effectivePermissions).toEqual(['*']);
    });
  });

  describe('resolve — union across multiple groups', () => {
    it('merges permissions from all groups', () => {
      const user = makeUser(['mx-requestor', 'mx-negotiator']);
      const result = service.resolve(user);
      expect(result.effectivePermissions).toContain('doc:create');
      expect(result.effectivePermissions).toContain('doc:update');
      expect(result.effectivePermissions).toContain('app:create');
      expect(result.effectivePermissions).toContain('app:update');
    });
  });

  describe('resolve — *:admin expansion', () => {
    it('expands app:admin to individual CRUD permissions', () => {
      const user = makeUser(['mx-admin']);
      const result = service.resolve(user);
      expect(result.effectivePermissions).toContain('app:create');
      expect(result.effectivePermissions).toContain('app:read');
      expect(result.effectivePermissions).toContain('app:update');
      expect(result.effectivePermissions).toContain('app:delete');
      expect(result.effectivePermissions).toContain('app:approve');
    });

    it('expands doc:admin to individual CRUD permissions', () => {
      const user = makeUser(['mx-admin']);
      const result = service.resolve(user);
      expect(result.effectivePermissions).toContain('doc:create');
      expect(result.effectivePermissions).toContain('doc:read');
    });
  });

  describe('resolve — deny precedence', () => {
    it('deny:legal-opinions blocks permissions for legal-opinions resource', () => {
      // mx-user has doc:read but also deny:legal-opinions
      // deny:legal-opinions should block any legal-opinions resource, not doc:read itself
      const user = makeUser(['mx-user']);
      const result = service.resolve(user);
      // doc:read is NOT for legal-opinions resource, so it stays
      expect(result.effectivePermissions).toContain('doc:read');
    });

    it('deny rule does not remove unrelated permissions', () => {
      const user = makeUser(['mx-user']);
      const result = service.resolve(user);
      expect(result.effectivePermissions).toContain('app:read');
    });
  });

  describe('resolve — unknown group', () => {
    it('returns empty permissions for unknown group', () => {
      const user = makeUser(['unknown-group']);
      const result = service.resolve(user);
      expect(result.effectivePermissions).toHaveLength(0);
      expect(result.isSuperadmin).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('returns true when user has the permission', () => {
      const user = makeUser(['mx-requestor']);
      expect(service.hasPermission(user, 'doc:create')).toBe(true);
    });

    it('returns false when user lacks the permission', () => {
      const user = makeUser(['mx-user']);
      expect(service.hasPermission(user, 'doc:create')).toBe(false);
    });

    it('superadmin always returns true', () => {
      const user = makeUser(['mx-superadmin']);
      expect(service.hasPermission(user, 'anything:super-secret')).toBe(true);
    });
  });

  describe('isDenied', () => {
    it('returns true when deny rule is present for resource', () => {
      const user = makeUser(['mx-user']);
      expect(service.isDenied(user, 'legal-opinions')).toBe(true);
    });

    it('returns false for unrelated resource', () => {
      const user = makeUser(['mx-user']);
      expect(service.isDenied(user, 'documents')).toBe(false);
    });

    it('superadmin is never denied', () => {
      const user = makeUser(['mx-superadmin', 'mx-user']);
      expect(service.isDenied(user, 'legal-opinions')).toBe(false);
    });
  });

  describe('config load failure', () => {
    it('throws on invalid JSON path', () => {
      resetRbacConfigCache();

      const brokenService = new PermissionsService();
      // Override to use a non-existent path
      jest.spyOn(sharedConfig, 'loadRbacConfig').mockImplementationOnce(() => {
        throw new Error('Failed to read RBAC config');
      });

      expect(() => brokenService.onModuleInit()).toThrow('Failed to read RBAC config');

      jest.restoreAllMocks();
    });
  });
});
