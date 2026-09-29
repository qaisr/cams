'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.loadRbacConfig = loadRbacConfig;
exports.resetRbacConfigCache = resetRbacConfigCache;
const node_fs_1 = require('node:fs');
const node_path_1 = require('node:path');
let cachedConfig = null;
function loadRbacConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = (0, node_path_1.join)(__dirname, '../../rbac/rbac-group-permissions.json');
  let raw;
  try {
    raw = (0, node_fs_1.readFileSync)(configPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read RBAC config at ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse RBAC config JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  const config = parsed;
  if (!config.groups || typeof config.groups !== 'object') {
    throw new Error('RBAC config is invalid: missing or malformed "groups" field');
  }
  cachedConfig = config;
  return cachedConfig;
}
function resetRbacConfigCache() {
  cachedConfig = null;
}
//# sourceMappingURL=rbac-config.js.map
