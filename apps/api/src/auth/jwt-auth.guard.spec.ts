import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from './guards/jwt-auth.guard';

const makeContext = (): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  it('returns true for @Public() routes without calling super', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const result = guard.canActivate(makeContext());
    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when token is missing', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when error is present', () => {
    expect(() => guard.handleRequest(new Error('jwt expired'), null)).toThrow(
      UnauthorizedException,
    );
  });

  it('returns the user when valid', () => {
    const user = { sub: 'sub1', lanId: 'user1' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });
});
