/**
 * Jest mock for the Lumen `PageHeader` primitive. Renders a heading (element
 * configurable), description, optional navigation slot, and action button slot
 * so wrapper unit tests can assert heading level and slot rendering.
 */
import type { HTMLAttributes, JSX, ReactNode } from 'react';

interface MockPageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  heading: string;
  element?: string;
  description?: ReactNode;
  button?: ReactNode;
  navigation?: ReactNode;
  showPagePadding?: boolean;
}

export const PageHeader = ({
  heading,
  element = 'h1',
  description,
  button,
  navigation,
  showPagePadding: _showPagePadding,
  ...rest
}: MockPageHeaderProps) => {
  const Heading = element as keyof JSX.IntrinsicElements;
  return (
    <div {...rest}>
      {navigation ? <div>{navigation}</div> : null}
      <Heading>{heading}</Heading>
      {description ? <div>{description}</div> : null}
      {button ? <div>{button}</div> : null}
    </div>
  );
};

PageHeader.displayName = 'MockLumenPageHeader';
