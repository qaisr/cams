import type { PageHeader as LumenPageHeader } from '@lumen/react/PageHeader';
import type { ComponentProps } from 'react';

/**
 * App-level PageHeader props — the full Lumen `PageHeader` prop set. `heading`
 * is required and supplies the page title; `description`, `button`, and
 * `navigation` are optional slots.
 *
 * Note: Lumen's `PageHeader` is a plain function component (no `ref`), so the
 * app wrapper is a plain FC rather than `forwardRef`.
 */
export type PageHeaderProps = ComponentProps<typeof LumenPageHeader>;
