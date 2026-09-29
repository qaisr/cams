import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { MockKeyStore } from './mock-key-store';

const mockConfig = (overrides: Record<string, string> = {}) => ({
  get: (key: string, def?: string) => overrides[key] ?? def,
  getOrThrow: (key: string) => {
    if (overrides[key] === undefined) throw new Error(`Missing: ${key}`);
    return overrides[key];
  },
});

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const buildService = async (env: Record<string, string> = {}) => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        MockKeyStore,
        { provide: ConfigService, useValue: mockConfig({ NODE_ENV: 'development', ...env }) },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed.mock.token'),
            decode: jest.fn().mockReturnValue({
              sub: 'mock-user1',
              lanId: 'user1',
              name: 'user1',
              email: 'user1@mock.ppcc',
              groups: ['mx-requestor'],
              iat: 0,
              exp: 99999,
            }),
            verify: jest.fn().mockReturnValue({ sub: 'user1' }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    return service;
  };

  describe('onModuleInit', () => {
    it('throws if MOCK_AUTH_ENABLED=true in production', async () => {
      const svc = await buildService({ MOCK_AUTH_ENABLED: 'true', NODE_ENV: 'production' });
      expect(() => svc.onModuleInit()).toThrow('MOCK_AUTH_ENABLED=true is not permitted');
    });

    it('does not throw in development', async () => {
      const svc = await buildService({ MOCK_AUTH_ENABLED: 'true', NODE_ENV: 'development' });
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  describe('mockLogin', () => {
    it('throws UnauthorizedException if mock strategy not set', async () => {
      const svc = await buildService({ MOCK_AUTH_ENABLED: 'true' });
      expect(() => svc.mockLogin({ lanId: 'user1', groups: ['mx-requestor'] })).toThrow(
        UnauthorizedException,
      );
    });

    it('returns accessToken and user when mock strategy is wired', async () => {
      const svc = await buildService({ MOCK_AUTH_ENABLED: 'true' });
      svc.setMockStrategyRef({ signToken: jest.fn().mockReturnValue('signed.mock.token') });

      const result = svc.mockLogin({ lanId: 'user1', groups: ['mx-requestor'] });

      expect(result.accessToken).toBe('signed.mock.token');
      expect(result.user.lanId).toBe('user1');
    });

    it('signs token with correct groups', async () => {
      const svc = await buildService({ MOCK_AUTH_ENABLED: 'true' });
      const signToken = jest.fn().mockReturnValue('tok');
      svc.setMockStrategyRef({ signToken });

      svc.mockLogin({ lanId: 'admin1', groups: ['mx-admin', 'mx-requestor'] });

      expect(signToken).toHaveBeenCalledWith(
        expect.objectContaining({ lanId: 'admin1', groups: ['mx-admin', 'mx-requestor'] }),
      );
    });
  });

  describe('realLogin', () => {
    it('throws UnauthorizedException (PKCE not yet configured)', async () => {
      const svc = await buildService();
      expect(() => svc.realLogin({ code: 'abc', redirectUri: 'https://example.com' })).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateToken', () => {
    it('returns payload on valid token', async () => {
      const svc = await buildService();
      const result = svc.validateToken('valid.token');
      expect(result).toEqual(expect.objectContaining({ sub: 'user1' }));
    });

    it('throws UnauthorizedException on invalid token', async () => {
      const svc = await buildService();
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });
      expect(() => svc.validateToken('bad.token')).toThrow(UnauthorizedException);
    });
  });
});
