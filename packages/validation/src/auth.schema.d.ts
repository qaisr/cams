import { z } from 'zod';
export declare const AuthUserSchema: z.ZodObject<{
    sub: z.ZodString;
    lanId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    groups: z.ZodArray<z.ZodString>;
    iat: z.ZodNumber;
    exp: z.ZodNumber;
}, z.core.$strip>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export declare const LoginRealSchema: z.ZodObject<{
    code: z.ZodString;
    redirectUri: z.ZodString;
}, z.core.$strip>;
export type LoginRealDto = z.infer<typeof LoginRealSchema>;
export declare const LoginMockSchema: z.ZodObject<{
    lanId: z.ZodString;
    groups: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type LoginMockDto = z.infer<typeof LoginMockSchema>;
export declare const LoginResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    user: z.ZodObject<{
        sub: z.ZodString;
        lanId: z.ZodString;
        name: z.ZodString;
        email: z.ZodString;
        groups: z.ZodArray<z.ZodString>;
        iat: z.ZodNumber;
        exp: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;
export declare const EffectivePermissionsSchema: z.ZodObject<{
    lanId: z.ZodString;
    groups: z.ZodArray<z.ZodString>;
    effectivePermissions: z.ZodArray<z.ZodString>;
    isSuperadmin: z.ZodBoolean;
}, z.core.$strip>;
export type EffectivePermissionsDto = z.infer<typeof EffectivePermissionsSchema>;
//# sourceMappingURL=auth.schema.d.ts.map