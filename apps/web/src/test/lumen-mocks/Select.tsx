/**
 * Jest mock for the Lumen `Select` primitive. Renders a labelled native
 * `<select>` (Lumen uses a custom listbox, but native select preserves the
 * value/onChange contract and accessible name for wrapper unit tests).
 */
import { forwardRef } from 'react';

import type { ReactNode } from 'react';

interface MockSelectOption {
  label?: string;
  value: string;
  disabled?: boolean;
}

interface MockSelectProps {
  label?: string;
  value?: string;
  placeholder?: string;
  options: MockSelectOption[];
  disabled?: boolean;
  errorMessage?: string | boolean;
  helptext?: ReactNode;
  isOptional?: boolean;
  isBold?: boolean;
  leadingIcon?: unknown;
  onChange?: (value: string) => void;
  onOpen?: () => void;
  onDismiss?: () => void;
  'data-tracking-id'?: string;
}

export const Select = forwardRef<HTMLDivElement, MockSelectProps>(
  (
    {
      label,
      value,
      placeholder,
      options,
      disabled,
      errorMessage,
      helptext,
      isOptional,
      onChange,
      isBold: _isBold,
      leadingIcon: _leadingIcon,
      onOpen: _onOpen,
      onDismiss: _onDismiss,
      ...rest
    },
    ref,
  ) => {
    const selectId = 'mock-select';
    const errorText = typeof errorMessage === 'string' ? errorMessage : undefined;
    return (
      <div ref={ref} {...rest}>
        {label ? (
          <label htmlFor={selectId}>
            {label}
            {isOptional ? ' (optional)' : ''}
          </label>
        ) : null}
        <select
          id={selectId}
          value={value ?? ''}
          disabled={disabled || undefined}
          aria-invalid={errorText ? true : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label ?? opt.value}
            </option>
          ))}
        </select>
        {helptext ? <p>{helptext}</p> : null}
        {errorText ? <p role="alert">{errorText}</p> : null}
      </div>
    );
  },
);

Select.displayName = 'MockLumenSelect';
