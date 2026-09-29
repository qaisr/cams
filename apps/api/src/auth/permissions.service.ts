import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ADMIN_EXPAND_ACTIONS, SUPERADMIN_GROUP, loadRbacConfig } from '@repo/shared-config';
import type { RbacConfig } from '@repo/shared-config';
import type { AuthUser } from '@repo/validation';

export interface EffectivePermissions {
  lanId: string;
  groups: string[];
  effectivePermissions: string[];
  isSuperadmin: boolean;
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);
  private rbacConfig!: RbacConfig;

  onModuleInit(): void {
    this.rbacConfig = loadRbacConfig();
    this.logger.log(
      `RBAC config loaded: ${Object.keys(this.rbacConfig.groups).length} groups, version ${this.rbacConfig.version}`,
    );
  }

  resolve(user: AuthUser): EffectivePermissions {
    if (user.groups.includes(SUPERADMIN_GROUP)) {
      return {
        lanId: user.lanId,
        groups: user.groups,
        effectivePermissions: ['*'],
        isSuperadmin: true,
      };
    }

    const rawPermissions = new Set<string>();
    const denyResources = new Set<string>();

    for (const group of user.groups) {
      // eslint-disable-next-line security/detect-object-injection
      const groupConfig = this.rbacConfig.groups[group];
      if (!groupConfig) continue;

      for (const perm of groupConfig.permissions) {
        if (perm.startsWith('deny:')) {
          denyResources.add(perm.slice(5));
        } else {
          rawPermissions.add(perm);
        }
      }
    }

    const expanded = new Set<string>();
    for (const perm of rawPermissions) {
      const parts = perm.split(':');
      const resource = parts[0] ?? '';
      const action = parts[1];
      if (action === 'admin') {
        for (const a of ADMIN_EXPAND_ACTIONS) {
          expanded.add(`${resource}:${a}`);
        }
        expanded.add(perm);
      } else {
        expanded.add(perm);
      }
    }

    // Remove permissions for denied resources
    const effectivePermissions: string[] = [];
    for (const perm of expanded) {
      const parts = perm.split(':');
      const resource = parts[0];
      if (resource && !denyResources.has(resource)) {
        effectivePermissions.push(perm);
      }
    }

    return {
      lanId: user.lanId,
      groups: user.groups,
      effectivePermissions: effectivePermissions.sort(),
      isSuperadmin: false,
    };
  }

  hasPermission(user: AuthUser, permission: string): boolean {
    const resolved = this.resolve(user);
    if (resolved.isSuperadmin) return true;
    return resolved.effectivePermissions.includes(permission);
  }

  hasAnyPermission(user: AuthUser, permissions: string[]): boolean {
    const resolved = this.resolve(user);
    if (resolved.isSuperadmin) return true;
    return permissions.some((p) => resolved.effectivePermissions.includes(p));
  }

  hasAllPermissions(user: AuthUser, permissions: string[]): boolean {
    const resolved = this.resolve(user);
    if (resolved.isSuperadmin) return true;
    return permissions.every((p) => resolved.effectivePermissions.includes(p));
  }

  isDenied(user: AuthUser, resource: string): boolean {
    if (user.groups.includes(SUPERADMIN_GROUP)) return false;

    for (const group of user.groups) {
      // eslint-disable-next-line security/detect-object-injection
      const groupConfig = this.rbacConfig.groups[group];
      if (!groupConfig) continue;
      if (groupConfig.permissions.includes(`deny:${resource}`)) {
        return true;
      }
    }
    return false;
  }
}
