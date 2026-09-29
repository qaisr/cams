import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser } from '@repo/validation';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        cacheMaxAge: 600_000, // 10 min
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: config.get<string>('PINGID_JWKS_URI', 'http://localhost/.well-known/jwks.json'),
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      issuer: config.get<string>('PINGID_ISSUER', 'mock-issuer'),
      audience: config.get<string>('PINGID_AUDIENCE', 'mock-audience'),
    });
  }

  validate(payload: AuthUser): AuthUser {
    return payload;
  }
}
