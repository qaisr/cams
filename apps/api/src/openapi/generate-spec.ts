#!/usr/bin/env tsx
// Generates OpenAPI spec from Zod schemas using @asteasolutions/zod-to-openapi.
// Run via: pnpm generate:spec or as step 2 in pnpm generate

import * as fs from 'node:fs';
import * as path from 'node:path';

import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

import {
  AuthUserSchema,
  EffectivePermissionsSchema,
  LoginMockSchema,
  LoginRealSchema,
  LoginResponseSchema,
} from '@repo/validation';

const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Health endpoint
const HealthResponseSchema = registry.register(
  'HealthResponse',
  z.object({
    status: z.enum(['ok', 'degraded']),
    timestamp: z.string().datetime(),
    db: z.enum(['connected', 'disconnected']),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Returns API and database connectivity status',
  tags: ['Health'],
  security: [],
  responses: {
    200: {
      description: 'Service health status',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

// Auth schemas
const AuthUserRef = registry.register('AuthUser', AuthUserSchema);
const LoginRealRef = registry.register('LoginReal', LoginRealSchema);
const LoginMockRef = registry.register('LoginMock', LoginMockSchema);
const LoginResponseRef = registry.register('LoginResponse', LoginResponseSchema);
const EffectivePermissionsRef = registry.register(
  'EffectivePermissions',
  EffectivePermissionsSchema,
);

registry.registerPath({
  method: 'post',
  path: '/login',
  summary: 'Login',
  description:
    'Authenticate and receive a JWT. Use LoginReal for production (PKCE), LoginMock when MOCK_AUTH_ENABLED=true.',
  tags: ['Auth'],
  security: [],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: z.union([LoginRealRef, LoginMockRef]),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: {
        'application/json': {
          schema: LoginResponseRef,
        },
      },
    },
    401: { description: 'Invalid credentials' },
    422: { description: 'Validation error' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/.well-known/jwks.json',
  summary: 'JWKS endpoint (local dev only)',
  description:
    'Returns the public key set for mock JWT validation. Only available when MOCK_AUTH_ENABLED=true.',
  tags: ['Auth'],
  security: [],
  responses: {
    200: {
      description: 'JSON Web Key Set',
      content: {
        'application/json': {
          schema: z.object({ keys: z.array(z.record(z.string(), z.string())) }),
        },
      },
    },
  },
});

void AuthUserRef;

registry.registerPath({
  method: 'get',
  path: '/auth/me/permissions',
  summary: 'Get effective permissions',
  description: 'Returns the effective permissions for the currently authenticated user.',
  tags: ['Auth'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Effective permissions for the authenticated user',
      content: {
        'application/json': {
          schema: EffectivePermissionsRef,
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

const spec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'App API',
    version: '1.0.0',
    description: 'Customer Account Management System API',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local dev' }],
});

const outDir = path.resolve(__dirname, '../../../../packages/api-spec/generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(spec, null, 2));

// eslint-disable-next-line no-console
console.log('✅ OpenAPI spec generated → packages/api-spec/generated/openapi.json');
