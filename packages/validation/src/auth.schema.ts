// `z` comes from the shared singleton where extendZodWithOpenApi(z) is called
// once — never import from 'zod' directly.
import { z } from './zod';

export const AuthUserSchema = z.object({
  sub: z.string(),
  lanId: z.string(),
  name: z.string(),
  email: z.string().email(),
  groups: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginRealSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

export type LoginRealDto = z.infer<typeof LoginRealSchema>;

export const LoginMockSchema = z.object({
  lanId: z.string().min(1),
  groups: z.array(z.string()).min(1),
});

export type LoginMockDto = z.infer<typeof LoginMockSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserSchema,
});

export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;

export const EffectivePermissionsSchema = z.object({
  lanId: z.string(),
  groups: z.array(z.string()),
  effectivePermissions: z.array(z.string()),
  isSuperadmin: z.boolean(),
});

export type EffectivePermissionsDto = z.infer<typeof EffectivePermissionsSchema>;
