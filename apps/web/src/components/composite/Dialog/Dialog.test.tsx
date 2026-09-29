import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog } from './Dialog';
import * as stories from './Dialog.stories';

const { Info, Success } = composeStories(stories);

describe('Dialog', () => {
  describe('Rendering', () => {
    it('is not rendered while closed', () => {
      const { queryByRole } = render(<Info />);
      expect(queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders with an accessible name once opened', async () => {
      const user = userEvent.setup();
      const { getByRole } = render(<Info />);
      await user.click(getByRole('button', { name: 'Open dialog' }));
      expect(getByRole('dialog')).toHaveAccessibleName('Confirm your details');
    });

    it('renders the heading text for the success variant', async () => {
      const user = userEvent.setup();
      const { getByRole } = render(<Success />);
      await user.click(getByRole('button', { name: 'Open dialog' }));
      expect(getByRole('dialog')).toHaveAccessibleName('Application submitted');
    });
  });

  describe('States', () => {
    it('marks the dialog as modal', async () => {
      const user = userEvent.setup();
      const { getByRole } = render(<Info />);
      await user.click(getByRole('button', { name: 'Open dialog' }));
      expect(getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Interactions', () => {
    it('fires onClose when the close button is clicked', async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();
      const { getByRole } = render(
        <Dialog heading="Standalone" isOpen onClose={onClose}>
          <p>Body</p>
        </Dialog>,
      );
      await user.click(getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('invokes the action button handler', async () => {
      const onAction = jest.fn();
      const user = userEvent.setup();
      const { getByRole } = render(
        <Dialog
          heading="Standalone"
          isOpen
          onClose={() => {}}
          buttonAction={{ text: 'Accept', onClick: onAction }}
        >
          <p>Body</p>
        </Dialog>,
      );
      await user.click(getByRole('button', { name: 'Accept' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('exposes the body content inside the dialog', async () => {
      const user = userEvent.setup();
      const { getByRole, getByText } = render(<Info />);
      await user.click(getByRole('button', { name: 'Open dialog' }));
      expect(
        getByText('A dialog appears in front of content to prompt for a decision.'),
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders without an action button when none is provided', () => {
      const { getByRole, queryByRole } = render(
        <Dialog heading="Minimal" isOpen onClose={() => {}}>
          <p>Body</p>
        </Dialog>,
      );
      expect(getByRole('dialog')).toBeInTheDocument();
      // Only the close button should be present.
      expect(queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });
  });
});
