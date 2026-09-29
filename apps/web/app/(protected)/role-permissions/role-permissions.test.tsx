import RolePermissionsPage from './page';
import { renderWithProviders, screen } from '../../../src/test-utils';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

function makeAdminSession(groups: string[]) {
  const payload = {
    sub: 'test-sub',
    lanId: 'qa.admin',
    name: 'QA Admin',
    email: 'qa.admin@example.com',
    groups,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const token = `${header}.${body}.fakesig`;
  sessionStorage.setItem('accessToken', token);
  sessionStorage.setItem(
    'authUser',
    JSON.stringify({
      sub: payload.sub,
      lanId: payload.lanId,
      name: payload.name,
      email: payload.email,
      groups,
    }),
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('RolePermissionsPage — authorized (mx-admin)', () => {
  beforeEach(() => {
    makeAdminSession(['mx-admin']);
  });

  it('renders all 5 groups in the table', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Requestor')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Negotiator')).toBeInTheDocument();
  });

  it('deny permissions have the deny chip CSS class', () => {
    renderWithProviders(<RolePermissionsPage />);
    const denyChip = screen.getByText('deny:legal-opinions');
    expect(denyChip.className).toMatch(/chipDeny/);
  });

  it('mx-superadmin Notes column shows "Full access — bypasses all RBAC checks"', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByText('Full access — bypasses all RBAC checks')).toBeInTheDocument();
  });

  it('renders all 6 authorization strategy sections', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByText('How Access Is Determined')).toBeInTheDocument();
    expect(screen.getByText('Allow and Deny Rules')).toBeInTheDocument();
    expect(screen.getByText('Superadmin Behavior')).toBeInTheDocument();
    expect(screen.getByText('Route and Action Checks')).toBeInTheDocument();
    expect(screen.getByText('Why This Matters for Users')).toBeInTheDocument();
    expect(screen.getByText('How To Request Access Changes')).toBeInTheDocument();
  });
});

describe('RolePermissionsPage — authorized (mx-superadmin)', () => {
  beforeEach(() => {
    makeAdminSession(['mx-superadmin']);
  });

  it('renders the full table for mx-superadmin', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByText('Role-Permission Matrix')).toBeInTheDocument();
    expect(screen.getByText('Superadmin')).toBeInTheDocument();
  });
});

describe('RolePermissionsPage — unauthorized (mx-user)', () => {
  beforeEach(() => {
    makeAdminSession(['mx-user']);
  });

  it('renders AccessDenied instead of the table', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText('Role-Permission Matrix')).not.toBeInTheDocument();
  });
});

describe('RolePermissionsPage — unauthenticated (no session)', () => {
  it('renders AccessDenied when there is no session', () => {
    renderWithProviders(<RolePermissionsPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});
