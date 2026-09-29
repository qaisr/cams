/**
 * Feature Flag Template
 *
 * Usage: Add new flags to FeatureFlagSchema enum, then use in components/controllers
 * Standards: .claude/patterns/feature-flag-pattern.md
 *
 * Adding a new flag:
 * 1. Add to FeatureFlagSchema enum below
 * 2. Add SSM Parameter: /app/feature-flags/YOUR_FLAG_NAME (JSON config)
 * 3. Use useFeatureFlag('YOUR_FLAG_NAME') in components
 * 4. Use @SetMetadata('featureFlag', 'YOUR_FLAG_NAME') in controllers
 * 5. Create tech debt ticket to remove after full rollout
 */
// Import `z` from the shared validation package, never from 'zod' directly.
import { z } from '@repo/validation';

// ─── 1. Define all flags here ─────────────────────────────────────────────────
export const FeatureFlagSchema = z.enum([
  // Active flags
  'NEW_DOCUMENT_EDITOR',      // Owner: @team-docs  | Rollout: 25% | Remove by: Sprint 15
  'BULK_EXPORT',              // Owner: @team-ops   | Rollout: 100%| Remove by: Sprint 13
  // Add new flags above this line
]);

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

// ─── 2. SSM Parameter shape ───────────────────────────────────────────────────
export const FeatureFlagConfigSchema = z.object({
  enabled: z.boolean(),
  description: z.string(),
  owner: z.string(),
  enabledForRoles: z.array(z.string()).optional(),
  enabledForUserIds: z.array(z.string()).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  removeByVersion: z.string().optional(), // semantic version
});

export type FeatureFlagConfig = z.infer<typeof FeatureFlagConfigSchema>;

// ─── 3. Default/fallback configs (used if SSM fetch fails) ────────────────────
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, FeatureFlagConfig> = {
  NEW_DOCUMENT_EDITOR: {
    enabled: false, // safe default: OFF
    description: 'New rich-text document editor',
    owner: '@team-docs',
    rolloutPercentage: 0,
    removeByVersion: '2.5.0',
  },
  BULK_EXPORT: {
    enabled: true, // fully rolled out
    description: 'Bulk document export feature',
    owner: '@team-ops',
    removeByVersion: '2.3.0',
  },
};

// ─── 4. Frontend hook (import from @repo/feature-flags) ───────────────────────
// See: .claude/patterns/feature-flag-pattern.md for full implementation
