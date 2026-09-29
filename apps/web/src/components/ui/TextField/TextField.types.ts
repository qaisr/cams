import type { TextField as LumenTextField } from '@lumen/react/TextField';
import type { ComponentProps } from 'react';

/**
 * App-level TextField props — the full Lumen `TextField` prop union
 * (text/password/currency/search/textarea variants), which is a controlled
 * component requiring `value` + `onChange`.
 */
export type TextFieldProps = ComponentProps<typeof LumenTextField>;

export type { TextFieldChangeEvent } from '@lumen/react/TextField';
