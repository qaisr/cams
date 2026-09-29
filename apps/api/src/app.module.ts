import * as fs from 'node:fs';
import * as path from 'node:path';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MockAuthGuard } from './auth/guards/mock-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

function findMonorepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return start;
}

const monorepoRoot = findMonorepoRoot(__dirname);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.join(monorepoRoot, '.env.local'), path.join(monorepoRoot, '.env')],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (config: ConfigService, jwtGuard: JwtAuthGuard, mockGuard: MockAuthGuard) => {
        return config.get<string>('MOCK_AUTH_ENABLED') === 'true' ? mockGuard : jwtGuard;
      },
      inject: [ConfigService, JwtAuthGuard, MockAuthGuard],
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
