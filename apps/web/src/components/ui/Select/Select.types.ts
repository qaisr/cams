import type { Select as LumenSelect } from '@lumen/react/Select';
import type { ComponentProps } from 'react';

/**
 * App-level Select props — the full Lumen `Select` prop set. Controlled:
 * callers supply `value` + `onChange(value: string)` and an `options` array.
 */
export type SelectProps = ComponentProps<typeof LumenSelect>;

export type { SelectOption } from '@lumen/react/Select';
