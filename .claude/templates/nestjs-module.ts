// Template: NestJS Feature Module
// Usage: Replace {{Feature}}, {{feature}} with your feature name (e.g., Documents, documents)
// File: apps/api/src/{{feature}}/{{feature}}.module.ts

import { Module } from '@nestjs/common';
import { {{Feature}}Controller } from './{{feature}}.controller';
import { {{Feature}}Service } from './{{feature}}.service';
import { {{Feature}}Repository } from './{{feature}}.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
// import { DatabaseModule } from '../database/database.module';  // if needed
// import { EventEmitterModule } from '@nestjs/event-emitter';    // if events needed

@Module({
  imports: [
    PrismaModule,
    // DatabaseModule,
    AuditModule,  // Remove if feature doesn't need audit logging
  ],
  controllers: [{{Feature}}Controller],
  providers: [
    {{Feature}}Service,
    {{Feature}}Repository,
  ],
  exports: [{{Feature}}Service], // Export service if other modules depend on it
})
export class {{Feature}}Module {}
