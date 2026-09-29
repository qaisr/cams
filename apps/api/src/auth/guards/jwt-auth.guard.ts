import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

import type { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        type: 'https://problems.app.internal/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid bearer token required',
      });
    }
    return user;
  }
}
