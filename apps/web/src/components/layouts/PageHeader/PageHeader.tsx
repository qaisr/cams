'use client';

import { PageHeader as LumenPageHeader } from '@lumen/react/PageHeader';

import type { PageHeaderProps } from './PageHeader.types';

/**
 * Thin wrapper over the Lumen `PageHeader` primitive.
 *
 * Renders the page title (`heading`) with optional `description`, a right-side
 * `button` slot, and an above-heading `navigation` slot. The Lumen primitive is
 * a plain FC (no `ref`), so this wrapper is a plain FC and passes all props
 * straight through.
 */
export function PageHeader(props: PageHeaderProps) {
  return <LumenPageHeader {...props} />;
}

PageHeader.displayName = 'PageHeader';
