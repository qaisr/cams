import type { ButtonProps as LumenButtonProps } from '@lumen/react/Button';

/**
 * App-level Button props. Extends the Lumen `Button` primitive with a merge-safe
 * `className` (composed via `cn`) while re-exporting Lumen's full prop surface
 * (`variant`, `icon`, `iconPosition`, `loading`, `aria-label`, native button attrs).
 */
export interface ButtonProps extends LumenButtonProps {
  /** Additional Tailwind/layout utility classes, merged with Lumen's own. */
  className?: string;
}

export type { ButtonVariants } from '@lumen/react/Button';
