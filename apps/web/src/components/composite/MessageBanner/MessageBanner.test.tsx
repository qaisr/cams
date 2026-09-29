import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MessageBanner } from './MessageBanner';
import * as stories from './MessageBanner.stories';

const { Info, Success, Dismissible } = composeStories(stories);

describe('MessageBanner', () => {
  describe('Rendering', () => {
    it('renders the heading and description', () => {
      const { getByText } = render(<Info />);
      expect(getByText('Verify your details')).toBeInTheDocument();
      expect(
        getByText('Check that the information below is correct before continuing.'),
      ).toBeInTheDocument();
    });

    it('renders the success variant heading', () => {
      const { getByText } = render(<Success />);
      expect(getByText('Application submitted')).toBeInTheDocument();
    });

    it('exposes a status role for assistive technology', () => {
      const { getByRole } = render(<Info />);
      expect(getByRole('status')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('passes the variant through to the primitive', () => {
      const { getByRole } = render(<Success />);
      expect(getByRole('status')).toHaveAttribute('data-variant', 'success');
    });

    it('is not rendered when closed', () => {
      const { queryByRole } = render(
        <MessageBanner variant="info" heading="Hidden" isOpen={false} />,
      );
      expect(queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('fires onClose when the close button is clicked', async () => {
      const onClose = jest.fn();
      const user = userEvent.setup();
      const { getByRole } = render(
        <MessageBanner variant="info" heading="Dismiss me" isOpen onClose={onClose} />,
      );
      await user.click(getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('hides the banner after dismissal via the controlled story', async () => {
      const user = userEvent.setup();
      const { getByRole, queryByText } = render(<Dismissible />);
      await user.click(getByRole('button', { name: 'Close' }));
      expect(queryByText('Verify your details')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders the caption text when provided', () => {
      const { getByText } = render(
        <MessageBanner variant="info" heading="With caption" caption="Updated just now" />,
      );
      expect(getByText('Updated just now')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders without a close button when onClose is omitted', () => {
      const { queryByRole } = render(<MessageBanner variant="info" heading="No dismiss" />);
      expect(queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });
  });
});
