import { HttpResponse, http } from 'msw';

import { getPostLoginResponseMock } from '../../../src/hooks/generated';
import { server } from '../../../src/mocks/server';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test-utils';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe('LoginMockPage', () => {
  let LoginMockPage: React.ComponentType;

  beforeEach(async () => {
    mockReplace.mockClear();
    const mod = await import('./page');
    LoginMockPage = mod.default;
  });

  it('renders all 5 groups from RBAC config', () => {
    renderWithProviders(<LoginMockPage />);
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Requestor')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Negotiator')).toBeInTheDocument();
  });

  it('shows the development-only banner', () => {
    renderWithProviders(<LoginMockPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/only available in development/i);
  });

  it('redirects to /secure on successful login', async () => {
    server.use(
      http.post('*/login', () => HttpResponse.json(getPostLoginResponseMock(), { status: 200 })),
    );

    renderWithProviders(<LoginMockPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in as superadmin/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/secure'));
  });

  it('shows an error message on login failure', async () => {
    server.use(http.post('*/login', () => HttpResponse.json(null, { status: 401 })));

    renderWithProviders(<LoginMockPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign in as superadmin/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/login failed/i));
  });
});
