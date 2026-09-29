// Template: Accessible Form Component with React Hook Form + Zod
// Replace: {{Feature}}, {{feature}}, {{fields}}
// File: apps/web/src/components/forms/Create{{Feature}}Form.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Create{{Feature}}Schema, type Create{{Feature}}Dto } from '@repo/validation';
import { useCreate{{Feature}} } from '@/hooks/generated/{{feature}}';
import { useQueryClient } from '@tanstack/react-query';
import { getGet{{Feature}}sQueryKey } from '@/hooks/generated/{{feature}}';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { extractValidationErrors } from '@/lib/api-error';
import { toast } from '@/lib/toast';

interface Create{{Feature}}FormProps {
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

export function Create{{Feature}}Form({ onSuccess, onCancel }: Create{{Feature}}FormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<Create{{Feature}}Dto>({
    resolver: zodResolver(Create{{Feature}}Schema),
    mode: 'onBlur',
  });

  const { mutate: create, isPending } = useCreate{{Feature}}({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGet{{Feature}}sQueryKey() });
        toast.success('{{Feature}} created successfully');
        reset();
        onSuccess(data.id);
      },
      onError: (error) => {
        const fieldErrors = extractValidationErrors(error);
        if (fieldErrors?.length) {
          fieldErrors.forEach(({ field, message }) =>
            setError(field as keyof Create{{Feature}}Dto, { message })
          );
        } else {
          toast.error('Failed to create {{feature}}. Please try again.');
        }
      },
    },
  });

  const onSubmit = (data: Create{{Feature}}Dto) => create({ data });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Create {{feature}} form"
      className="space-y-4"
    >
      {/* Add fields here using FormField wrapper */}
      <FormField label="Name" error={errors.name?.message} required>
        <input
          {...register('name')}
          id="name"
          type="text"
          aria-required="true"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="input w-full"
          placeholder="Enter name"
        />
      </FormField>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting || isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isSubmitting || isPending}
          aria-busy={isSubmitting || isPending}
        >
          Create {{Feature}}
        </Button>
      </div>
    </form>
  );
}
