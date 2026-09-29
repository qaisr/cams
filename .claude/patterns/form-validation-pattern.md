# Pattern: Form Validation (React Hook Form + Zod)

## Overview
All forms use React Hook Form with Zod resolver. Validation schema is the
single source of truth — shared between frontend form and backend DTO.

## Shared Schema (packages/validation)
```typescript
// packages/validation/src/document.schema.ts
import { z } from '@repo/validation';

export const CreateDocumentSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less')
    .trim(),
  description: z.string().max(2000).optional(),
  status: z.enum(['draft', 'review', 'published']).default('draft'),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

export type CreateDocumentDto = z.infer<typeof CreateDocumentSchema>;
```

## Form Component
```typescript
// apps/web/src/components/forms/CreateDocumentForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateDocumentSchema, CreateDocumentDto } from '@repo/validation';
import { useCreateDocument } from '@/hooks/generated/documents';

interface CreateDocumentFormProps {
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

export function CreateDocumentForm({ onSuccess, onCancel }: CreateDocumentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields },
    setError,
    reset,
  } = useForm<CreateDocumentDto>({
    resolver: zodResolver(CreateDocumentSchema),
    defaultValues: { title: '', status: 'draft', tags: [] },
    mode: 'onBlur',  // Validate on blur, not on every keystroke
  });

  const { mutate: createDocument } = useCreateDocument({
    mutation: {
      onSuccess: (data) => { reset(); onSuccess(data.id); },
      onError: (error) => {
        // Map API validation errors back to form fields
        const apiErrors = extractValidationErrors(error);
        apiErrors?.forEach(({ field, message }) =>
          setError(field as keyof CreateDocumentDto, { message })
        );
      },
    },
  });

  const onSubmit = (data: CreateDocumentDto) => createDocument({ data });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Create document">
      <FormField
        label="Title"
        error={errors.title?.message}
        required
      >
        <input
          {...register('title')}
          id="title"
          type="text"
          aria-required="true"
          aria-describedby={errors.title ? 'title-error' : undefined}
          aria-invalid={!!errors.title}
          className={cn('input', errors.title && 'input-error')}
        />
      </FormField>

      <FormField label="Status" error={errors.status?.message}>
        <select {...register('status')} id="status">
          <option value="draft">Draft</option>
          <option value="review">In Review</option>
          <option value="published">Published</option>
        </select>
      </FormField>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Create Document</Button>
      </div>
    </form>
  );
}
```

## FormField Wrapper Component
```tsx
// packages/ui/src/components/FormField.tsx
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactElement;
}

export function FormField({ label, error, required, hint, children }: FormFieldProps) {
  const id = children.props.id;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span aria-hidden="true" className="text-destructive ml-1">*</span>}
      </label>
      {hint && <p id={hintId} className="form-hint">{hint}</p>}
      {children}
      {error && (
        <p id={errorId} role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
```

## Rules
- `zodResolver` ALWAYS from `@hookform/resolvers/zod`
- Use shared schema from `packages/validation` — never duplicate validation
- `mode: 'onBlur'` for better UX (not `onChange` which is distracting)
- Always map API errors back to form fields via `setError`
- `noValidate` on `<form>` to disable native browser validation
- Every input needs `id`, label association, `aria-invalid`, `aria-describedby`
- Never disable submit button — use `isSubmitting` for loading state only

## Token Optimization

**Load when** when wiring React Hook Form with Zod resolver and server errors. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
