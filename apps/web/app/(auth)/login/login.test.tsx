import LoginPage from './page';
import { renderWithProviders, screen } from '../../../src/test-utils';

jest.mock('next/link', () => {
  const MockLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('LoginPage', () => {
  it('renders Sign In button as disabled', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('shows the PingID configuration banner', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/PINGID_/);
  });

  it('renders link to mock login page', () => {
    renderWithProviders(<LoginPage />);
    const link = screen.getByRole('link', { name: /mock login/i });
    expect(link).toHaveAttribute('href', '/login-mock');
  });
});
