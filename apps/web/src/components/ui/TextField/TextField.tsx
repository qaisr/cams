'use client';

import { TextField as LumenTextField } from '@lumen/react/TextField';
import { forwardRef } from 'react';

import type { TextFieldProps } from './TextField.types';

/**
 * Thin wrapper over the Lumen `TextField` primitive.
 *
 * Controlled input — callers must supply `value` and `onChange`. The full Lumen
 * variant union (text/email/number/password/currency/search/textarea) is
 * preserved. Ref forwards to the underlying input/textarea element.
 */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(
  (props, ref) => <LumenTextField ref={ref} {...props} />,
);

TextField.displayName = 'TextField';
