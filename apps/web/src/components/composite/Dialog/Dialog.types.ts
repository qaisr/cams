import type { Dialog as LumenDialog } from '@lumen/react/Dialog';
import type { ComponentProps } from 'react';

/**
 * App-level Dialog props — the full Lumen `Dialog` prop set. Controlled via
 * `isOpen` + `onClose`; `heading` supplies the accessible name and
 * `aria-describedby` should reference the body content.
 *
 * Note: Lumen's `Dialog` is a plain function component that accepts `ref` as a
 * regular prop (imperative `DialogRef`, not a DOM node), so the app wrapper is
 * a plain FC rather than `forwardRef`.
 */
export type DialogProps = ComponentProps<typeof LumenDialog>;

export type { DialogRef } from '@lumen/react/Dialog';
