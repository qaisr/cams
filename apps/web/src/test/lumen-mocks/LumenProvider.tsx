/**
 * Jest mock for the Lumen `LumenProvider`. Renders children in a passthrough
 * wrapper (the real provider only injects theme CSS, which is irrelevant to
 * jsdom unit tests). Keeps `composeStories` decorators working under jest.
 */
import type { ReactNode } from 'react';

interface MockLumenProviderProps {
  children?: ReactNode;
  as?: keyof HTMLElementTagNameMap;
  [key: string]: unknown;
}

export const LumenProvider = ({
  children,
  as: _as,
  theme: _theme,
  colorScheme: _colorScheme,
  ...rest
}: MockLumenProviderProps) => <div {...rest}>{children}</div>;

LumenProvider.displayName = 'MockLumenProvider';

export default LumenProvider;
