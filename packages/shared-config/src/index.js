'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ADMIN_EXPAND_ACTIONS =
  exports.SUPERADMIN_GROUP =
  exports.resetRbacConfigCache =
  exports.loadRbacConfig =
    void 0;
var rbac_config_1 = require('./rbac/rbac-config');
Object.defineProperty(exports, 'loadRbacConfig', {
  enumerable: true,
  get: function () {
    return rbac_config_1.loadRbacConfig;
  },
});
Object.defineProperty(exports, 'resetRbacConfigCache', {
  enumerable: true,
  get: function () {
    return rbac_config_1.resetRbacConfigCache;
  },
});
var constants_1 = require('./rbac/constants');
Object.defineProperty(exports, 'SUPERADMIN_GROUP', {
  enumerable: true,
  get: function () {
    return constants_1.SUPERADMIN_GROUP;
  },
});
Object.defineProperty(exports, 'ADMIN_EXPAND_ACTIONS', {
  enumerable: true,
  get: function () {
    return constants_1.ADMIN_EXPAND_ACTIONS;
  },
});
//# sourceMappingURL=index.js.map
