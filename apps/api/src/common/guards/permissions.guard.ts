import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SUPERADMIN_GROUP } from '@repo/shared-config';
import type { AuthUser } from '@repo/validation';

import { PermissionsService } from '../../auth/permissions.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

import type { PermissionsOptions } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      (string | PermissionsOptions)[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    // No authenticated user — JWT guard handles this; skip here
    if (!user) {
      return true;
    }

    // Superadmin bypasses all permission checks
    if (user.groups.includes(SUPERADMIN_GROUP)) {
      return true;
    }

    const resolved = this.permissionsService.resolve(user);

    // No @RequirePermissions on route — default allow for authenticated users
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    for (const requirement of requiredPermissions) {
      if (typeof requirement === 'string') {
        if (!resolved.effectivePermissions.includes(requirement)) {
          throw new ForbiddenException({
            type: 'https://problems.app.internal/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: `Missing required permission: ${requirement}`,
          });
        }
      } else if ('any' in requirement) {
        const hasAny = requirement.any.some((p) => resolved.effectivePermissions.includes(p));
        if (!hasAny) {
          throw new ForbiddenException({
            type: 'https://problems.app.internal/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: `Requires one of: ${requirement.any.join(', ')}`,
          });
        }
      }
    }

    return true;
  }
}
