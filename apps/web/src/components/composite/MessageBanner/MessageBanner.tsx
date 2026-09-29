'use client';

import { MessageBanner as LumenMessageBanner } from '@lumen/react/MessageBanner';

import type { MessageBannerProps } from './MessageBanner.types';

/**
 * Thin wrapper over the Lumen `MessageBanner` primitive.
 *
 * Surfaces a status/urgency message with an optional heading, description,
 * action, and close control. `variant` sets the urgency style; control
 * visibility with `isOpen` + `onClose`. The Lumen primitive is a plain FC
 * (its `ref` is a regular optional prop), so this wrapper is a plain FC and
 * passes all props — including `ref` — straight through.
 */
export function MessageBanner(props: MessageBannerProps) {
  return <LumenMessageBanner {...props} />;
}

MessageBanner.displayName = 'MessageBanner';
