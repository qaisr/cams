'use client';

import { Dialog as LumenDialog } from '@lumen/react/Dialog';

import type { DialogProps } from './Dialog.types';

/**
 * Thin wrapper over the Lumen `Dialog` primitive.
 *
 * Controlled via `isOpen` + `onClose`. `heading` provides the accessible name;
 * pass `aria-describedby` referencing the body content per Lumen guidance. The
 * Lumen primitive is a plain FC (its `ref` is an imperative `DialogRef`), so
 * this wrapper is a plain FC and passes all props — including `ref` — straight
 * through.
 */
export function Dialog(props: DialogProps) {
  return <LumenDialog {...props} />;
}

Dialog.displayName = 'Dialog';
