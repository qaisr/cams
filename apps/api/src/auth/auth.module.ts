import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MockAuthGuard } from './guards/mock-auth.guard';
import { MockKeyStore } from './mock-key-store';
import { PermissionsService } from './permissions.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MockJwtStrategy } from './strategies/mock-jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Default options — mock signing uses explicit options in MockJwtStrategy.signToken
        secret: config.get<string>('JWT_SECRET', 'dev-secret-not-used'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    MockKeyStore,
    AuthService,
    PermissionsService,
    JwtStrategy,
    MockJwtStrategy,
    JwtAuthGuard,
    MockAuthGuard,
  ],
  exports: [AuthService, PermissionsService, JwtAuthGuard, MockAuthGuard],
})
export class AuthModule {}
