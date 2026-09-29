'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EffectivePermissionsSchema =
  exports.LoginResponseSchema =
  exports.LoginMockSchema =
  exports.LoginRealSchema =
  exports.AuthUserSchema =
    void 0;
const zod_to_openapi_1 = require('@asteasolutions/zod-to-openapi');
const zod_1 = require('zod');
(0, zod_to_openapi_1.extendZodWithOpenApi)(zod_1.z);
exports.AuthUserSchema = zod_1.z.object({
  sub: zod_1.z.string(),
  lanId: zod_1.z.string(),
  name: zod_1.z.string(),
  email: zod_1.z.string().email(),
  groups: zod_1.z.array(zod_1.z.string()),
  iat: zod_1.z.number(),
  exp: zod_1.z.number(),
});
exports.LoginRealSchema = zod_1.z.object({
  code: zod_1.z.string().min(1),
  redirectUri: zod_1.z.string().url(),
});
exports.LoginMockSchema = zod_1.z.object({
  lanId: zod_1.z.string().min(1),
  groups: zod_1.z.array(zod_1.z.string()).min(1),
});
exports.LoginResponseSchema = zod_1.z.object({
  accessToken: zod_1.z.string(),
  user: exports.AuthUserSchema,
});
exports.EffectivePermissionsSchema = zod_1.z.object({
  lanId: zod_1.z.string(),
  groups: zod_1.z.array(zod_1.z.string()),
  effectivePermissions: zod_1.z.array(zod_1.z.string()),
  isSuperadmin: zod_1.z.boolean(),
});
//# sourceMappingURL=auth.schema.js.map
