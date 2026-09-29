import { generateKeyPairSync } from 'node:crypto';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import jwt from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser } from '@repo/validation';

import { AuthService } from '../auth.service';
import { MockKeyStore } from '../mock-key-store';

export let mockPublicKey: string;
export let mockPrivateKey: string;

@Injectable()
export class MockJwtStrategy
  extends PassportStrategy(Strategy, 'mock-jwt')
  implements OnModuleInit
{
  private readonly logger = new Logger(MockJwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mockKeyStore: MockKeyStore,
    private readonly authService: AuthService,
  ) {
    // Temporary placeholder — secretOrKey is replaced onModuleInit after key generation
    super({
      secretOrKey: 'placeholder',
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
    });
  }

  onModuleInit(): void {
    const envKey = this.config.get<string>('MOCK_JWT_PRIVATE_KEY');
    let privateKey: string;
    let publicKey: string;

    if (envKey) {
      privateKey = envKey;
      publicKey = '';
      mockPrivateKey = envKey;
    } else {
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
      publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' });
      mockPrivateKey = privateKey;
      mockPublicKey = publicKey;
    }

    this.mockKeyStore.setKeys(privateKey, publicKey);

    // Patch the underlying passport-jwt secretOrKeyProvider after key is ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)._secretOrKeyProvider = (
      _: unknown,
      __: unknown,
      done: (err: unknown, key: string) => void,
    ) => done(null, this.mockKeyStore.publicKey ?? publicKey);

    this.authService.setMockStrategyRef(this);
    this.logger.log('Mock JWT strategy initialised with local RSA key');
  }

  signToken(payload: Omit<AuthUser, 'iat' | 'exp'>): string {
    const privateKey = this.mockKeyStore.privateKey;
    if (!privateKey) {
      throw new Error('MockJwtStrategy: keys not initialised — onModuleInit has not run');
    }
    return jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '8h' });
  }

  validate(payload: AuthUser): AuthUser {
    return payload;
  }
}
