/**
 * Jest mock for the Lumen `MessageBanner` primitive. Renders a `role="status"`
 * region with heading/description/action + optional close control so wrapper
 * unit tests can assert content, variant passthrough, and dismissal wiring.
 */
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

interface MockMessageBannerProps extends HTMLAttributes<HTMLDivElement> {
  heading?: string;
  description?: ReactNode;
  caption?: string;
  variant: string;
  type?: 'global' | 'contextual';
  action?: ReactElement;
  isOpen?: boolean;
  onClose?: (event: unknown) => void;
  headingElement?: string;
  animation?: boolean;
  autoFocus?: boolean;
}

export const MessageBanner = ({
  heading,
  description,
  caption,
  variant,
  type: _type,
  action,
  isOpen = true,
  onClose,
  headingElement: _headingElement,
  className,
  id,
  animation: _animation,
  autoFocus: _autoFocus,
  ref: _ref,
  ...rest
}: MockMessageBannerProps & { ref?: unknown }) => {
  if (!isOpen) return null;
  return (
    <div role="status" id={id} data-variant={variant} className={className} {...rest}>
      {heading ? <p>{heading}</p> : null}
      {description ? <div>{description}</div> : null}
      {caption ? <small>{caption}</small> : null}
      {action ?? null}
      {onClose ? (
        <button type="button" aria-label="Close" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  );
};

MessageBanner.displayName = 'MockLumenMessageBanner';
