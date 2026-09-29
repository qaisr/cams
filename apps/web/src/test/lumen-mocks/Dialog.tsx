/**
 * Jest mock for the Lumen `Dialog` primitive. Renders a `role="dialog"` with an
 * accessible name, optional action/close buttons, and body content when open,
 * so wrapper unit tests can assert open/close wiring and labelling.
 */
import type { HTMLAttributes, ReactNode } from 'react';

interface MockButtonConfig {
  text?: string;
  onClick?: (event: unknown) => void;
  'aria-label'?: string;
  id?: string;
}

interface MockDialogProps extends HTMLAttributes<HTMLDivElement> {
  heading: string;
  isOpen: boolean;
  onClose: (event: unknown) => void;
  buttonClose?: MockButtonConfig;
  buttonAction?: MockButtonConfig;
  variant?: string;
  privacyScreen?: boolean;
  children?: ReactNode;
  ref?: unknown;
}

export const Dialog = ({
  heading,
  isOpen,
  onClose,
  buttonClose,
  buttonAction,
  variant: _variant,
  privacyScreen: _privacyScreen,
  ref: _ref,
  children,
  ...rest
}: MockDialogProps) => {
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={heading} {...rest}>
      <h2>{heading}</h2>
      <div>{children}</div>
      {buttonAction ? (
        <button type="button" onClick={buttonAction.onClick}>
          {buttonAction.text}
        </button>
      ) : null}
      <button type="button" onClick={(e) => (buttonClose?.onClick ?? onClose)(e)}>
        {buttonClose?.text ?? 'Close'}
      </button>
    </div>
  );
};

Dialog.displayName = 'MockLumenDialog';
