// Template: NestJS RBAC Authorization (canonical @RequirePermissions pattern)
//
// IMPORTANT: The PermissionsGuard is ALREADY built and registered globally via
// APP_GUARD in apps/api/src/app.module.ts. You almost never write a new guard.
// To protect a route you ONLY add the `@RequirePermissions(...)` decorator and
// (optionally) read the user with `@CurrentUser()`. This file documents that
// canonical pattern and the supporting source so generated code matches the
// deny-precedence RBAC engine — NEVER reintroduce a `@Roles`/`RolesGuard` path.
//
// Standards: @.claude/standards/security-standards.md
// Architecture: @.claude/xxxx/authorization-patterns-and-architecture.md

// ────────────────────────────────────────────────────────────────────────────
// 1. USAGE — the only thing you normally write (in a controller)
//
// import { Controller, Get, Param } from '@nestjs/common';
// import { CurrentUser } from '../auth/decorators/current-user.decorator';
// import { RequirePermissions } from '../common/decorators/permissions.decorator';
// import type { AuthUser } from '@repo/validation';
//
// @Controller('documents')
// export class DocumentController {
//   // Require a single permission (format: '{entity}:{action}')
//   @Get(':id')
//   @RequirePermissions('document:read')
//   async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
//     // user.sub, user.email, user.groups — authenticated & authorized
//   }
//
//   // Require ANY of several permissions
//   @Get()
//   @RequirePermissions({ any: ['document:read', 'document:list'] })
//   async findAll(@CurrentUser() user: AuthUser) {}
//
//   // Require MULTIPLE permissions (all must be present) — pass them separately
//   @Post(':id/publish')
//   @RequirePermissions('document:update', 'document:publish')
//   async publish(@Param('id') id: string) {}
// }
//
// Notes:
//  - The global JWT/Mock auth guard runs FIRST and populates `request.user`.
//  - No `@UseGuards(...)` needed — both guards are global (APP_GUARD).
//  - Super admins bypass all checks; deny rules win over allow (see the engine).
//  - A route with NO @RequirePermissions is allowed for any authenticated user.
//    Use `@Public()` (apps/api/src/auth) to fully open a route.

// ────────────────────────────────────────────────────────────────────────────
// 2. REFERENCE — the decorator source (apps/api/src/common/decorators/permissions.decorator.ts)
//    Already exists. Shown here so generated call-sites use the exact signature.
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionsOptions {
  any: string[];
}

export const RequirePermissions = (...permissions: (string | PermissionsOptions)[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// ────────────────────────────────────────────────────────────────────────────
// 3. REFERENCE — the @CurrentUser param decorator (apps/api/src/auth/decorators/current-user.decorator.ts)
//    Already exists. `AuthUser` is defined in @repo/validation — NEVER redeclare it.
//
// import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
// import type { AuthUser } from '@repo/validation';
// import type { FastifyRequest } from 'fastify';
//
// export const CurrentUser = createParamDecorator(
//   (_data: unknown, ctx: ExecutionContext): AuthUser => {
//     const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthUser }>();
//     return request.user;
//   },
// );

// ────────────────────────────────────────────────────────────────────────────
// 4. REFERENCE — the global guard (apps/api/src/common/guards/permissions.guard.ts)
//    Already exists and registered via APP_GUARD. DO NOT recreate. Reproduced so
//    you understand the enforcement contract (RFC 7807 403, superadmin bypass,
//    any-of vs all-of, PermissionsService.resolve deny-precedence).
//
// @Injectable()
// export class PermissionsGuard implements CanActivate {
//   constructor(
//     private readonly reflector: Reflector,
//     private readonly permissionsService: PermissionsService,
//   ) {}
//
//   canActivate(context: ExecutionContext): boolean {
//     const required = this.reflector.getAllAndOverride<(string | PermissionsOptions)[] | undefined>(
//       PERMISSIONS_KEY, [context.getHandler(), context.getClass()],
//     );
//     const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
//     if (!user) return true;                                 // JWT guard already rejected
//     if (user.groups.includes(SUPERADMIN_GROUP)) return true; // superadmin bypass
//     if (!required || required.length === 0) return true;     // authenticated-only route
//
//     const resolved = this.permissionsService.resolve(user); // deny-precedence engine
//     for (const requirement of required) {
//       if (typeof requirement === 'string') {
//         if (!resolved.effectivePermissions.includes(requirement)) {
//           throw new ForbiddenException({
//             type: 'https://problems.app.internal/forbidden',
//             title: 'Forbidden', status: 403,
//             detail: `Missing required permission: ${requirement}`,
//           });
//         }
//       } else if ('any' in requirement) {
//         if (!requirement.any.some((p) => resolved.effectivePermissions.includes(p))) {
//           throw new ForbiddenException({
//             type: 'https://problems.app.internal/forbidden',
//             title: 'Forbidden', status: 403,
//             detail: `Requires one of: ${requirement.any.join(', ')}`,
//           });
//         }
//       }
//     }
//     return true;
//   }
// }
