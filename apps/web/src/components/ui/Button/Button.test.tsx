import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as stories from './Button.stories';

const { Primary, Secondary, Tertiary, Disabled, Loading, IconOnly } = composeStories(stories);

describe('Button', () => {
  describe('Rendering', () => {
    it('renders the primary variant with its label', () => {
      const { getByRole } = render(<Primary />);
      expect(getByRole('button', { name: 'Primary' })).toBeInTheDocument();
    });

    it('renders the secondary variant', () => {
      const { getByRole } = render(<Secondary />);
      expect(getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
    });

    it('renders the tertiary variant', () => {
      const { getByRole } = render(<Tertiary />);
      expect(getByRole('button', { name: 'Tertiary' })).toBeInTheDocument();
    });

    it('merges custom className onto the underlying button', () => {
      const { getByRole } = render(<Primary className="custom-cls" />);
      expect(getByRole('button')).toHaveClass('custom-cls');
    });
  });

  describe('States', () => {
    it('is disabled when the disabled prop is set', () => {
      const { getByRole } = render(<Disabled />);
      expect(getByRole('button', { name: 'Disabled' })).toBeDisabled();
    });

    it('announces a loading state via aria-disabled', () => {
      const { getByRole } = render(<Loading />);
      // In disabled loading mode Lumen uses aria-disabled, not native disabled.
      expect(getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Interactions', () => {
    it('fires onClick when clicked', async () => {
      const onClick = jest.fn();
      const user = userEvent.setup();
      const { getByRole } = render(<Primary onClick={onClick} />);
      await user.click(getByRole('button', { name: 'Primary' }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire onClick when disabled', async () => {
      const onClick = jest.fn();
      const user = userEvent.setup();
      const { getByRole } = render(<Disabled onClick={onClick} />);
      await user.click(getByRole('button', { name: 'Disabled' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('exposes an accessible name for icon-only buttons via aria-label', () => {
      const { getByRole } = render(<IconOnly />);
      expect(getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    });

    it('is reachable as a button role', () => {
      const { getByRole } = render(<Primary />);
      expect(getByRole('button')).toBeVisible();
    });
  });

  describe('Edge Cases', () => {
    it('forwards a ref to the underlying button element', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Primary ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
