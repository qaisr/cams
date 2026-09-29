import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionsOptions {
  any: string[];
}

export type PermissionRequirement = string[] | { any: string[] };

export const RequirePermissions = (...permissions: (string | PermissionsOptions)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
