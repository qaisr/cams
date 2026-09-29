import type { MessageBanner as LumenMessageBanner } from '@lumen/react/MessageBanner';
import type { ComponentProps } from 'react';

/**
 * App-level MessageBanner props — the full Lumen `MessageBanner` prop set.
 * `variant` (message urgency) is required; `heading`/`description` supply the
 * content and `isOpen` + `onClose` control dismissal.
 *
 * Note: Lumen's `MessageBanner` is a plain function component that accepts
 * `ref` as a regular optional prop, so the app wrapper is a plain FC rather
 * than `forwardRef`.
 */
export type MessageBannerProps = ComponentProps<typeof LumenMessageBanner>;
