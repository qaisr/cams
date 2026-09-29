import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GroupConfig {
  displayName: string;
  description: string;
  permissions: string[];
}

export interface RbacConfig {
  $schema: string;
  title: string;
  description?: string;
  version: string;
  lastUpdated?: string;
  groups: Record<string, GroupConfig>;
}

let cachedConfig: RbacConfig | null = null;

export function loadRbacConfig(): RbacConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = join(__dirname, '../../rbac/rbac-group-permissions.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read RBAC config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse RBAC config JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const config = parsed as RbacConfig;

  if (!config.groups || typeof config.groups !== 'object') {
    throw new Error('RBAC config is invalid: missing or malformed "groups" field');
  }

  cachedConfig = config;
  return cachedConfig;
}

export function resetRbacConfigCache(): void {
  cachedConfig = null;
}
