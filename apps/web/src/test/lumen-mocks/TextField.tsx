/**
 * Jest mock for the Lumen `TextField` primitive. Renders a linked
 * label + input/textarea with helptext and error messaging so wrapper unit
 * tests can assert labelling, value/onChange wiring, and error surfacing.
 */
import { forwardRef } from 'react';

import type { ReactNode } from 'react';

interface MockTextFieldProps {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  value: string;
  placeholder?: string;
  helptext?: ReactNode;
  errorMessage?: string | boolean;
  isDisabled?: boolean;
  isOptional?: boolean;
  isClearable?: boolean;
  autoComplete?: string;
  maxLength?: number;
  onChange: (event: unknown) => void;
  onBlur?: (event?: unknown) => void;
  onClearText?: (event: unknown) => void;
  isBold?: boolean;
  leadingContent?: ReactNode;
  showCounter?: boolean;
}

export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, MockTextFieldProps>(
  (
    {
      id,
      name,
      label,
      type = 'text',
      value,
      placeholder,
      helptext,
      errorMessage,
      isDisabled,
      isOptional,
      onChange,
      onBlur,
      // strip Lumen-only props so they don't leak onto the DOM node
      isClearable: _isClearable,
      onClearText: _onClearText,
      isBold: _isBold,
      leadingContent: _leadingContent,
      showCounter: _showCounter,
      ...rest
    },
    ref,
  ) => {
    const inputId = id ?? name ?? 'mock-textfield';
    const errorText = typeof errorMessage === 'string' ? errorMessage : undefined;
    const describedBy = errorText ? `${inputId}-error` : helptext ? `${inputId}-help` : undefined;
    const commonProps = {
      id: inputId,
      name: name ?? inputId,
      value,
      placeholder,
      disabled: isDisabled || undefined,
      'aria-invalid': errorText ? true : undefined,
      'aria-describedby': describedBy,
      onChange,
      onBlur,
      ...rest,
    };
    return (
      <div>
        {label ? (
          <label htmlFor={inputId}>
            {label}
            {isOptional ? ' (optional)' : ''}
          </label>
        ) : null}
        {type === 'textarea' ? (
          <textarea ref={ref as React.Ref<HTMLTextAreaElement>} {...commonProps} />
        ) : (
          <input ref={ref as React.Ref<HTMLInputElement>} type={type} {...commonProps} />
        )}
        {helptext ? <p id={`${inputId}-help`}>{helptext}</p> : null}
        {errorText ? (
          <p id={`${inputId}-error`} role="alert">
            {errorText}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = 'MockLumenTextField';
