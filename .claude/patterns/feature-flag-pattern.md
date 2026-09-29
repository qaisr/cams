# Feature Flag Pattern

## Overview
Runtime feature toggles for gradual rollouts, A/B testing, and kill switches using environment variables and database flags.

## Implementation Tiers

### 1. Environment-Based (Build-Time)
```typescript
// apps/api/src/config/features.ts
export const FEATURES = {
  NEW_USER_DASHBOARD: process.env.FEATURE_NEW_DASHBOARD === 'true',
  ADVANCED_SEARCH: process.env.FEATURE_ADVANCED_SEARCH === 'true',
} as const;

// Usage
import { FEATURES } from './config/features';

if (FEATURES.NEW_USER_DASHBOARD) {
  // New implementation
} else {
  // Old implementation
}
```

### 2. Database-Based (Runtime)
```prisma
// prisma/schema.prisma
model FeatureFlag {
  id          String   @id @default(uuid())
  key         String   @unique
  enabled     Boolean  @default(false)
  rolloutPercentage Int @default(0) // 0-100
  enabledForUserIds String[] // Specific user allowlist
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

```typescript
// apps/api/src/features/feature-flag.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagService {
  constructor(private prisma: PrismaService) {}

  async isEnabled(key: string, userId?: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });

    if (!flag) return false; // Default disabled
    if (!flag.enabled) return false;

    // Check user allowlist
    if (userId && flag.enabledForUserIds.includes(userId)) {
      return true;
    }

    // Check rollout percentage
    if (userId) {
      const hash = this.hashUserId(userId);
      return hash < flag.rolloutPercentage;
    }

    return flag.rolloutPercentage === 100;
  }

  private hashUserId(userId: string): number {
    // Deterministic hash: same user always gets same result
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % 100);
  }
}
```

### 3. Guard/Decorator
```typescript
// apps/api/src/common/guards/feature-flag.guard.ts
import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService } from '../../features/feature-flag.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featureFlags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<string>('featureFlag', context.getHandler());
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    const enabled = await this.featureFlags.isEnabled(featureKey, userId);

    if (!enabled) {
      throw new NotFoundException('Feature not available');
    }

    return true;
  }
}

// Decorator
export const FeatureFlag = (key: string) => SetMetadata('featureFlag', key);

// Usage
@Controller('users')
export class UsersController {
  @Get('search/advanced')
  @FeatureFlag('ADVANCED_SEARCH')
  @UseGuards(FeatureFlagGuard)
  advancedSearch() {
    // New feature implementation
  }
}
```

### 4. Frontend Implementation
```typescript
// apps/web/src/hooks/useFeatureFlag.ts
import { useQuery } from '@tanstack/react-query';
import { api } from './generated/api-client';

export function useFeatureFlag(key: string) {
  const { data: enabled = false } = useQuery({
    queryKey: ['featureFlags', key],
    queryFn: () => api.featureFlags.isEnabled(key),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return enabled;
}

// Usage
function Dashboard() {
  const newDashboardEnabled = useFeatureFlag('NEW_USER_DASHBOARD');

  return newDashboardEnabled ? <NewDashboard /> : <OldDashboard />;
}
```

## Admin UI
```typescript
// apps/web/src/app/admin/feature-flags/page.tsx
export default function FeatureFlagsAdmin() {
  const { data: flags } = useQuery({
    queryKey: ['admin', 'featureFlags'],
    queryFn: () => api.admin.featureFlags.list(),
  });

  const updateFlag = useMutation({
    mutationFn: (data: { id: string; updates: Partial<FeatureFlag> }) =>
      api.admin.featureFlags.update(data.id, data.updates),
  });

  return (
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Enabled</th>
          <th>Rollout %</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {flags?.map(flag => (
          <tr key={flag.id}>
            <td>{flag.key}</td>
            <td>
              <Switch
                checked={flag.enabled}
                onChange={(enabled) => updateFlag.mutate({ id: flag.id, updates: { enabled } })}
              />
            </td>
            <td>
              <input
                type="range"
                min="0"
                max="100"
                value={flag.rolloutPercentage}
                onChange={(e) => updateFlag.mutate({
                  id: flag.id,
                  updates: { rolloutPercentage: parseInt(e.target.value) }
                })}
              />
              {flag.rolloutPercentage}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Gradual Rollout Strategy
```
Day 1: Enable for internal users (allowlist)
Day 3: Rollout 10% of users
Day 5: Rollout 25%
Day 7: Rollout 50%
Day 10: Rollout 100%
```

## Best Practices
1. **Default Disabled**: New features should default to disabled
2. **Cleanup**: Remove flags after full rollout (technical debt)
3. **Monitoring**: Track feature usage metrics
4. **Kill Switch**: Always have a way to instantly disable a feature
5. **Testing**: Test both enabled/disabled code paths

## Related
- `.claude/workflows/feature-development.md`
- `.claude/standards/quality-gate-standards.md`

## Token Optimization

**Load when** when adding/evaluating feature flags or gradual rollouts. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
