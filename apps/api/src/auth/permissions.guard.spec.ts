import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { SUPERADMIN_GROUP } from '@repo/shared-config';
import type { AuthUser } from '@repo/validation';

import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

import type { ExecutionContext } from '@nestjs/common';

const makeUser = (groups: string[]): AuthUser => ({
  sub: 'u1',
  lanId: 'u1',
  name: 'User One',
  email: 'u1@mock.ppcc',
  groups,
  iat: 0,
  exp: 99999,
});

const makeContext = (user: AuthUser | undefined, permissions?: unknown) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(permissions),
  };
  return {
    reflector,
    context: {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext,
  };
};

describe('PermissionsGuard', () => {
  let permissionsService: PermissionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        PermissionsService,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    permissionsService = module.get(PermissionsService);
    permissionsService.onModuleInit();
  });

  it('passes when no @RequirePermissions on route (default-allow)', () => {
    const user = makeUser(['mx-requestor']);
    const { context } = makeContext(user, undefined);

    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue(undefined);
    const g = new PermissionsGuard(r, permissionsService);

    expect(g.canActivate(context)).toBe(true);
  });

  it('passes when user has required permission', () => {
    const user = makeUser(['mx-requestor']);
    const { context } = makeContext(user, ['doc:create']);

    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue(['doc:create']);
    const g = new PermissionsGuard(r, permissionsService);

    expect(g.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user lacks required permission', () => {
    const user = makeUser(['mx-user']);
    const { context } = makeContext(user, ['doc:create']);

    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue(['doc:create']);
    const g = new PermissionsGuard(r, permissionsService);

    expect(() => g.canActivate(context)).toThrow(ForbiddenException);
  });

  it('superadmin bypasses all guards', () => {
    const user = makeUser([SUPERADMIN_GROUP]);
    const { context } = makeContext(user, ['doc:create', 'app:admin']);

    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue(['doc:create', 'app:admin']);
    const g = new PermissionsGuard(r, permissionsService);

    expect(g.canActivate(context)).toBe(true);
  });

  it('passes when { any: [...] } and user has one matching permission', () => {
    const user = makeUser(['mx-admin']);
    const anyReq = { any: ['doc:admin', 'app:admin'] };

    const { context } = makeContext(user, [anyReq]);
    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue([anyReq]);
    const g = new PermissionsGuard(r, permissionsService);

    expect(g.canActivate(context)).toBe(true);
  });

  it('throws when { any: [...] } and user has none', () => {
    const user = makeUser(['mx-user']);
    const anyReq = { any: ['doc:admin', 'app:admin'] };

    const { context } = makeContext(user, [anyReq]);
    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue([anyReq]);
    const g = new PermissionsGuard(r, permissionsService);

    expect(() => g.canActivate(context)).toThrow(ForbiddenException);
  });

  it('passes when no user is present (JWT guard handles auth)', () => {
    const { context } = makeContext(undefined, ['doc:create']);

    const r = new Reflector();
    jest.spyOn(r, 'getAllAndOverride').mockReturnValue(['doc:create']);
    const g = new PermissionsGuard(r, permissionsService);

    expect(g.canActivate(context)).toBe(true);
  });
});
