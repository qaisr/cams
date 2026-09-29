import { HttpResponse, http } from 'msw';

import SecurePage from './page';
import { getGetAuthMePermissionsResponseMock } from '../../../src/hooks/generated';
import { server } from '../../../src/mocks/server';
import { renderWithProviders, screen, waitFor } from '../../../src/test-utils';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

function makeFakeJwt(expiresInSeconds = 3600): string {
  const payload = {
    sub: 'test-sub',
    lanId: 'qa.user',
    name: 'QA User',
    email: 'qa.user@example.com',
    groups: ['mx-admin'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

const fakeUser = {
  sub: 'test-sub',
  lanId: 'qa.user',
  name: 'QA User',
  email: 'qa.user@example.com',
  groups: ['mx-admin'],
};

beforeEach(() => {
  sessionStorage.setItem('accessToken', makeFakeJwt());
  sessionStorage.setItem('authUser', JSON.stringify(fakeUser));
  mockReplace.mockClear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('SecurePage', () => {
  it('renders identity fields from auth context', async () => {
    renderWithProviders(<SecurePage />);
    await waitFor(() => expect(screen.queryByText('Loading permissions…')).not.toBeInTheDocument());
    expect(screen.getByText('qa.user')).toBeInTheDocument();
    expect(screen.getByText('QA User')).toBeInTheDocument();
    expect(screen.getByText('qa.user@example.com')).toBeInTheDocument();
  });

  it('renders effective permissions from API response', async () => {
    const mockData = getGetAuthMePermissionsResponseMock({
      effectivePermissions: ['doc:read', 'app:admin'],
      isSuperadmin: false,
    });
    server.use(
      http.get('*/auth/me/permissions', () => HttpResponse.json(mockData, { status: 200 })),
    );

    renderWithProviders(<SecurePage />);
    await waitFor(() => expect(screen.getByText('doc:read')).toBeInTheDocument());
    expect(screen.getByText('app:admin')).toBeInTheDocument();
  });

  it('shows superadmin badge when isSuperadmin is true', async () => {
    server.use(
      http.get('*/auth/me/permissions', () =>
        HttpResponse.json(
          getGetAuthMePermissionsResponseMock({ isSuperadmin: true, effectivePermissions: [] }),
          { status: 200 },
        ),
      ),
    );

    renderWithProviders(<SecurePage />);
    await waitFor(() => expect(screen.getByText('Superadmin')).toBeInTheDocument());
  });

  it('shows loading state while permissions are loading', () => {
    renderWithProviders(<SecurePage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading permissions/i);
  });

  it('shows error state when permissions request fails', async () => {
    server.use(http.get('*/auth/me/permissions', () => HttpResponse.json(null, { status: 500 })));

    renderWithProviders(<SecurePage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i));
  });

  it('calls logout when Sign Out is clicked', async () => {
    renderWithProviders(<SecurePage />);
    await waitFor(() => expect(screen.queryByText('Loading permissions…')).not.toBeInTheDocument());

    const signOut = screen.getByRole('button', { name: /sign out/i });
    signOut.click();

    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });
});
