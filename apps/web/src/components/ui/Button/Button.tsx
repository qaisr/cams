'use client';

import { Button as LumenButton } from '@lumen/react/Button';
import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

import type { ButtonProps } from './Button.types';

/**
 * Thin wrapper over the Lumen `Button` primitive.
 *
 * Composes Lumen's variant/icon/loading API and forwards the ref to the
 * underlying `<button>`. Only layout/utility classes should be passed via
 * `className`; visual styling (colour, radius, spacing) is owned by Lumen tokens.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <LumenButton ref={ref} variant={variant} className={cn(className)} {...props} />
  ),
);

Button.displayName = 'Button';
