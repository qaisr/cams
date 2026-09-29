import { createPublicKey } from 'node:crypto';

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LoginMockSchema, LoginRealSchema } from '@repo/validation';
import type { LoginResponseDto, AuthUser } from '@repo/validation';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { PermissionsService } from './permissions.service';
import { mockPublicKey } from './strategies/mock-jwt.strategy';
import { Public } from '../common/decorators/public.decorator';

import type { EffectivePermissions } from './permissions.service';

@Controller()
export class AuthController {
  private readonly isMockEnabled: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
    private readonly config: ConfigService,
  ) {
    this.isMockEnabled = this.config.get<string>('MOCK_AUTH_ENABLED') === 'true';
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  login(@Body() body: unknown): LoginResponseDto {
    if (this.isMockEnabled) {
      const dto = LoginMockSchema.parse(body);
      return this.authService.mockLogin(dto);
    }
    const dto = LoginRealSchema.parse(body);
    return this.authService.realLogin(dto);
  }

  @Get('.well-known/jwks.json')
  @Public()
  getJwks(): object {
    if (!this.isMockEnabled || !mockPublicKey) {
      return { keys: [] };
    }

    const pubKey = createPublicKey(mockPublicKey);
    const jwk = pubKey.export({ format: 'jwk' }) as Record<string, string>;

    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid: 'mock-key-1',
        },
      ],
    };
  }

  @Get('auth/me/permissions')
  getMyPermissions(@CurrentUser() user: AuthUser): EffectivePermissions {
    return this.permissionsService.resolve(user);
  }
}
