import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import jwt from 'jsonwebtoken';

import type { AuthUser, LoginMockDto, LoginResponseDto, LoginRealDto } from '@repo/validation';

import { MockKeyStore } from './mock-key-store';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly isMockEnabled: boolean;
  private mockStrategyRef?: { signToken: (p: Omit<AuthUser, 'iat' | 'exp'>) => string };

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mockKeyStore: MockKeyStore,
  ) {
    this.isMockEnabled = this.config.get<string>('MOCK_AUTH_ENABLED') === 'true';
  }

  onModuleInit(): void {
    if (this.isMockEnabled && this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error('MOCK_AUTH_ENABLED=true is not permitted in production environment');
    }
  }

  setMockStrategyRef(ref: { signToken: (p: Omit<AuthUser, 'iat' | 'exp'>) => string }): void {
    this.mockStrategyRef = ref;
  }

  mockLogin(dto: LoginMockDto): LoginResponseDto {
    const strategyRef = this.mockStrategyRef;
    const signFn = strategyRef
      ? (p: Omit<AuthUser, 'iat' | 'exp'>) => strategyRef.signToken(p)
      : (p: Omit<AuthUser, 'iat' | 'exp'>) => {
          const privateKey = this.mockKeyStore.privateKey;
          if (!privateKey) {
            throw new UnauthorizedException('Mock auth strategy not available');
          }
          return jwt.sign(p, privateKey, { algorithm: 'RS256', expiresIn: '8h' });
        };

    const payload: Omit<AuthUser, 'iat' | 'exp'> = {
      sub: `mock-${dto.lanId}`,
      lanId: dto.lanId,
      name: dto.lanId,
      email: `${dto.lanId}@mock.ppcc`,
      groups: dto.groups,
    };

    const accessToken = signFn(payload);
    const decoded: AuthUser = this.jwtService.decode(accessToken);

    this.logger.debug({ lanId: dto.lanId }, 'Mock login issued');

    return { accessToken, user: decoded };
  }

  realLogin(_dto: LoginRealDto): LoginResponseDto {
    // Placeholder: exchange PKCE auth code with PingID token endpoint
    // Full PKCE exchange implementation goes here when PingID credentials are available
    throw new UnauthorizedException({
      type: 'https://problems.app.internal/not-implemented',
      title: 'Not Implemented',
      status: 401,
      detail: 'Real PingID login requires PKCE configuration',
    });
  }

  validateToken(token: string): AuthUser {
    try {
      return this.jwtService.verify<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
