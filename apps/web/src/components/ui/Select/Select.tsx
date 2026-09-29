'use client';

import { Select as LumenSelect } from '@lumen/react/Select';
import { forwardRef } from 'react';

import type { SelectProps } from './Select.types';

/**
 * Thin wrapper over the Lumen `Select` primitive.
 *
 * Controlled — callers supply `value`, `onChange(value)`, and `options`. Ref
 * forwards to the underlying listbox container element.
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>((props, ref) => (
  <LumenSelect ref={ref} {...props} />
));

Select.displayName = 'Select';
