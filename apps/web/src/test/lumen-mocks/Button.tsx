/**
 * Jest mock for the Lumen `Button` primitive.
 *
 * Lumen ships ESM-only subpath exports with no `require` condition, so jest
 * cannot resolve `@lumen/react/Button`. This mock renders a semantic
 * `<button>` that mirrors the accessibility-relevant contract (role, name,
 * disabled/aria-disabled, ref forwarding), letting our wrapper's unit tests
 * assert the wrapper's own behaviour. Real Lumen rendering + axe audits are
 * exercised by Storybook (build-storybook + test-runner).
 */
import { forwardRef } from 'react';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface MockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  icon?: string;
  iconPosition?: string;
  loading?: {
    isLoading?: boolean;
    text?: string;
    successText?: string;
    mode?: 'interactive' | 'disabled';
  };
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, MockButtonProps>(
  ({ variant, icon, iconPosition: _iconPosition, loading, children, disabled, ...rest }, ref) => {
    const isLoadingDisabled = loading?.isLoading && loading.mode === 'disabled';
    return (
      <button
        ref={ref}
        type="button"
        data-variant={variant}
        data-icon={icon}
        disabled={disabled || undefined}
        aria-disabled={isLoadingDisabled ? 'true' : undefined}
        {...rest}
      >
        {loading?.isLoading ? (loading.text ?? 'Loading') : children}
      </button>
    );
  },
);

Button.displayName = 'MockLumenButton';
