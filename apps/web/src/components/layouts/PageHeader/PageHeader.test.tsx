import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react';

import { PageHeader } from './PageHeader';
import * as stories from './PageHeader.stories';
import { Button } from '../../ui/Button';

const { Default, WithAction, WithNavigation, SubsectionHeading } = composeStories(stories);

describe('PageHeader', () => {
  describe('Rendering', () => {
    it('renders the heading and description', () => {
      const { getByRole, getByText } = render(<Default />);
      expect(getByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
      expect(
        getByText('Manage your profile, security, and notification preferences.'),
      ).toBeInTheDocument();
    });

    it('renders the heading as an h1 by default', () => {
      const { getByRole } = render(<Default />);
      expect(getByRole('heading', { level: 1 })).toHaveTextContent('Account settings');
    });
  });

  describe('States', () => {
    it('honours a custom heading element level', () => {
      const { getByRole } = render(<SubsectionHeading />);
      expect(getByRole('heading', { level: 2 })).toHaveTextContent('Notification preferences');
    });
  });

  describe('Interactions', () => {
    it('renders the action button slot', () => {
      const { getByRole } = render(<WithAction />);
      expect(getByRole('button', { name: 'Add account' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders the navigation slot', () => {
      const { getByRole } = render(<WithNavigation />);
      expect(getByRole('link', { name: /Back to account/ })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('renders without optional slots', () => {
      const { getByRole, queryByRole } = render(<PageHeader heading="Minimal" />);
      expect(getByRole('heading', { name: 'Minimal' })).toBeInTheDocument();
      expect(queryByRole('button')).not.toBeInTheDocument();
    });

    it('forwards a custom button slot node', () => {
      const { getByRole } = render(
        <PageHeader heading="Reports" button={<Button>Export</Button>} />,
      );
      expect(getByRole('button', { name: 'Export' })).toBeInTheDocument();
    });
  });
});
