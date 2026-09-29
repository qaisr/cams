'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PrismaClient = exports.resetPrismaClient = exports.getPrismaClient = void 0;
var client_1 = require('./client');
Object.defineProperty(exports, 'getPrismaClient', {
  enumerable: true,
  get: function () {
    return client_1.getPrismaClient;
  },
});
Object.defineProperty(exports, 'resetPrismaClient', {
  enumerable: true,
  get: function () {
    return client_1.resetPrismaClient;
  },
});
var client_2 = require('@prisma/client');
Object.defineProperty(exports, 'PrismaClient', {
  enumerable: true,
  get: function () {
    return client_2.PrismaClient;
  },
});
//# sourceMappingURL=index.js.map
