import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';

const mockAuthService = {
  mockLogin: jest.fn(),
  realLogin: jest.fn(),
};

const mockPermissionsService = {
  resolve: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let configGet: jest.Mock;

  const build = async (mockEnabled: boolean) => {
    configGet = jest.fn().mockImplementation((key: string) => {
      if (key === 'MOCK_AUTH_ENABLED') return mockEnabled ? 'true' : 'false';
      return undefined;
    });

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: PermissionsService, useValue: mockPermissionsService },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    controller = module.get(AuthController);
    return controller;
  };

  beforeEach(() => jest.clearAllMocks());

  describe('login (mock mode)', () => {
    beforeEach(async () => {
      await build(true);
    });

    it('delegates to authService.mockLogin with valid body', () => {
      const body = { lanId: 'user1', groups: ['mx-requestor'] };
      mockAuthService.mockLogin.mockReturnValue({ accessToken: 'tok', user: {} });

      controller.login(body);

      expect(mockAuthService.mockLogin).toHaveBeenCalledWith(body);
    });

    it('throws ZodError for invalid mock body', () => {
      expect(() => controller.login({ foo: 'bar' })).toThrow();
    });
  });

  describe('login (real mode)', () => {
    beforeEach(async () => {
      await build(false);
    });

    it('delegates to authService.realLogin with valid body', () => {
      const body = { code: 'abc123', redirectUri: 'https://example.com/cb' };
      mockAuthService.realLogin.mockImplementation(() => {
        throw new UnauthorizedException();
      });

      expect(() => controller.login(body)).toThrow(UnauthorizedException);
      expect(mockAuthService.realLogin).toHaveBeenCalledWith(body);
    });
  });

  describe('getJwks', () => {
    it('returns empty keys when mock disabled', async () => {
      await build(false);
      const result = controller.getJwks() as { keys: unknown[] };
      expect(result.keys).toHaveLength(0);
    });
  });

  describe('getMyPermissions', () => {
    it('delegates to permissionsService.resolve', async () => {
      await build(true);
      const user = {
        sub: 'u1',
        lanId: 'u1',
        name: 'User',
        email: 'u1@mock.ppcc',
        groups: ['mx-requestor'],
        iat: 0,
        exp: 99999,
      };
      const expected = {
        lanId: 'u1',
        groups: ['mx-requestor'],
        effectivePermissions: ['doc:create', 'app:create', 'app:update'],
        isSuperadmin: false,
      };
      mockPermissionsService.resolve.mockReturnValue(expected);

      const result = controller.getMyPermissions(user);

      expect(result).toEqual(expected);
      expect(mockPermissionsService.resolve).toHaveBeenCalledWith(user);
    });
  });
});
