import { generateKeyPairSync } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { MockKeyStore } from './mock-key-store';
import * as mockStrategy from './strategies/mock-jwt.strategy';
import { MockJwtStrategy } from './strategies/mock-jwt.strategy';

const mockAuthService = { setMockStrategyRef: jest.fn() };

describe('MockJwtStrategy', () => {
  let strategy: MockJwtStrategy;
  let mockKeyStore: MockKeyStore;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MockJwtStrategy,
        MockKeyStore,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get(MockJwtStrategy);
    mockKeyStore = module.get(MockKeyStore);
    strategy.onModuleInit();
  });

  it('initialises RSA key pair on startup', () => {
    expect(mockStrategy.mockPublicKey).toContain('PUBLIC KEY');
    expect(mockStrategy.mockPrivateKey).toContain('PRIVATE KEY');
  });

  it('stores keys in MockKeyStore on init', () => {
    expect(mockKeyStore.privateKey).toContain('PRIVATE KEY');
    expect(mockKeyStore.publicKey).toContain('PUBLIC KEY');
  });

  it('registers itself with AuthService on init', () => {
    expect(mockAuthService.setMockStrategyRef).toHaveBeenCalledWith(strategy);
  });

  it('uses provided MOCK_JWT_PRIVATE_KEY env var if set', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

    const module = await Test.createTestingModule({
      providers: [
        MockJwtStrategy,
        MockKeyStore,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(privPem) },
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    const strat = module.get(MockJwtStrategy);
    strat.onModuleInit();

    expect(mockStrategy.mockPrivateKey).toBe(privPem);
  });

  it('validate() returns the payload unchanged', () => {
    const payload = {
      sub: 'sub1',
      lanId: 'user1',
      name: 'User One',
      email: 'u@test.com',
      groups: ['mx-requestor'],
      iat: 0,
      exp: 999,
    };
    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('signToken() returns a valid RS256 JWT string', () => {
    const payload = {
      sub: 'sub1',
      lanId: 'user1',
      name: 'User',
      email: 'u@test.com',
      groups: ['mx-requestor'],
    };
    const token = strategy.signToken(payload);
    expect(typeof token).toBe('string');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    const header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString());
    expect(header.alg).toBe('RS256');
  });
});
