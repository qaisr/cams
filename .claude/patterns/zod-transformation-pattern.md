# Zod Transformation Pattern

## Overview
Pattern for complex data transformations, type coercion, and validation using Zod's `transform`, `preprocess`, and `refine`.

## Use Cases
- Type coercion (string → Date, string → number)
- Data normalization (trim, lowercase)
- Complex validation (password strength, conditional fields)
- API response transformations

## Pattern

```typescript
import { z } from '@repo/validation';

// === Input Transformation ===
const CreateUserInputSchema = z.object({
  email: z.string().email().transform((val) => val.toLowerCase().trim()),
  birthDate: z.string().transform((val) => new Date(val)),
  phoneNumber: z.preprocess(
    (val) => String(val).replace(/\D/g, ''), // Remove non-digits
    z.string().length(10, 'Phone must be 10 digits')
  ),
}).refine(
  (data) => {
    const age = new Date().getFullYear() - data.birthDate.getFullYear();
    return age >= 18;
  },
  { message: 'User must be 18+', path: ['birthDate'] }
);

type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

// === Output Transformation ===
const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date().transform((date) => date.toISOString()),
  metadata: z.record(z.unknown()).nullable().transform((val) => val ?? {}),
});

type UserResponse = z.infer<typeof UserResponseSchema>;

// === Conditional Schemas ===
const DocumentUploadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    mimeType: z.enum(['image/jpeg', 'image/png']),
    maxSizeMB: z.number().default(5),
  }),
  z.object({
    type: z.literal('pdf'),
    mimeType: z.literal('application/pdf'),
    maxSizeMB: z.number().default(10),
  }),
]);

// === OpenAPI Integration ===
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
extendZodWithOpenApi(z);

const CreateUserOpenAPISchema = CreateUserInputSchema.openapi({
  description: 'Create new user',
  example: {
    email: 'user@example.com',
    birthDate: '1990-01-01',
    phoneNumber: '5551234567',
  },
});
```

## Testing Transformations

```typescript
describe('CreateUserInputSchema', () => {
  it('transforms email to lowercase', () => {
    const result = CreateUserInputSchema.parse({
      email: 'USER@EXAMPLE.COM',
      birthDate: '1990-01-01',
      phoneNumber: '555-123-4567',
    });
    expect(result.email).toBe('user@example.com');
    expect(result.phoneNumber).toBe('5551234567');
  });

  it('rejects underage users', () => {
    expect(() =>
      CreateUserInputSchema.parse({
        email: 'user@example.com',
        birthDate: new Date().toISOString().split('T')[0], // Today
        phoneNumber: '5551234567',
      })
    ).toThrow('User must be 18+');
  });
});
```

## Best Practices
1. **Keep transformations pure**: No side effects, deterministic
2. **Prefer `transform` over `preprocess`**: More type-safe
3. **Test edge cases**: Empty strings, null, undefined, invalid types
4. **Document transformations**: Add `.describe()` or comments
5. **Use discriminated unions**: For complex conditional validation

## Anti-Patterns
- ❌ Async transformations (use `.refine()` with async validator)
- ❌ Database lookups in schemas (do in service layer)
- ❌ Mutating input data (transformations return new objects)

## Related
- `.claude/patterns/zod-openapi-pattern.md`
- `.claude/standards/api-standards.md`
- `.claude/templates/zod-transform-validator.ts`

## Token Optimization

**Load when** when designing Zod transforms / preprocessing / coerce DTOs. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
