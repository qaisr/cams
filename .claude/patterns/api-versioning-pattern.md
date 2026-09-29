# API Versioning Pattern

## Overview
URL-based versioning strategy for NestJS APIs with backward compatibility and deprecation workflow.

## Versioning Strategy

```
/api/v1/users     → Version 1 (stable)
/api/v2/users     → Version 2 (current)
/api/v3/users     → Version 3 (beta)
```

## NestJS Implementation

```typescript
// apps/api/src/main.ts
import { VersioningType } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '2',
});

// apps/api/src/users/users.controller.ts
import { Controller, Get, Version } from '@nestjs/common';

@Controller('users')
export class UsersController {
  // V1 - Deprecated
  @Version('1')
  @Get()
  @Deprecated({ sunset: '2024-12-31', alternative: '/api/v2/users' })
  findAllV1(): UserV1[] {
    // Legacy response format
    return this.usersService.findAll().map(toUserV1);
  }

  // V2 - Current
  @Version('2')
  @Get()
  findAllV2(): UserV2[] {
    return this.usersService.findAll();
  }

  // V3 - Beta
  @Version('3')
  @Get()
  @BetaFeature()
  findAllV3(): UserV3[] {
    return this.usersService.findAllWithNewFeature();
  }
}
```

## Zod Schema Versioning

```typescript
// packages/validation/src/user/v1.ts
export const UserV1Schema = z.object({
  id: z.string(),
  name: z.string(),
});

// packages/validation/src/user/v2.ts
export const UserV2Schema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
});

// packages/validation/src/user/index.ts
export * from './v1';
export * from './v2';
export { UserV2Schema as UserSchema }; // Alias current version
```

## OpenAPI Versioning

```typescript
// apps/api/src/openapi/generate-spec.ts
const v1Document = generateOpenAPIDocument({
  version: '1.0.0',
  basePath: '/api/v1',
  schemas: [UserV1Schema],
});

const v2Document = generateOpenAPIDocument({
  version: '2.0.0',
  basePath: '/api/v2',
  schemas: [UserV2Schema],
});

// Generate separate specs
fs.writeFileSync('openapi-v1.json', JSON.stringify(v1Document));
fs.writeFileSync('openapi-v2.json', JSON.stringify(v2Document));
```

## Deprecation Decorator

```typescript
// apps/api/src/common/decorators/deprecated.decorator.ts
import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

export function Deprecated(options: { sunset: string; alternative: string }) {
  return applyDecorators(
    SetMetadata('deprecated', true),
    ApiHeader({
      name: 'Sunset',
      description: `This endpoint is deprecated. Sunset date: ${options.sunset}`,
    }),
    ApiResponse({
      status: 299,
      description: `Deprecated. Use ${options.alternative} instead.`,
    })
  );
}
```

## Migration Guide Template

```markdown
# Migration Guide: API v1 → v2

## Breaking Changes

### User Endpoint
**Old (v1):** `GET /api/v1/users`
```json
{ "id": "123", "name": "John Doe" }
```

**New (v2):** `GET /api/v2/users`
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

### Migration Steps
1. Update API client to use `/api/v2` base URL
2. Update `User` type definitions
3. Handle `firstName`/`lastName` instead of `name`
4. Validate UUIDs for `id` field

```
### Sunset Timeline
- **2024-10-01**: v2 released
- **2024-11-01**: v1 marked deprecated
- **2024-12-31**: v1 sunset (disabled)
```

## Best Practices
1. **Deprecation Period**: Minimum 3 months notice
2. **Sunset Headers**: Return `Sunset` and `Deprecation` headers
3. **Analytics**: Track v1 usage to identify clients needing migration
4. **Documentation**: Auto-generate separate OpenAPI specs per version
5. **Testing**: Maintain integration tests for all supported versions

## Related
- `.claude/standards/api-contract-standards.md`
- `.claude/workflows/api-contract-workflow.md`

## Token Optimization

**Load when** when introducing breaking changes / URL versioning / sunset headers. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
