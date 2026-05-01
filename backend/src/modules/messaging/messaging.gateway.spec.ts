import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthSocket, MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildSocket = (
  overrides: Partial<AuthSocket['handshake']> = {},
): AuthSocket => {
  const handshake = {
    auth: {} as Record<string, unknown>,
    headers: {} as Record<string, string>,
    ...overrides,
  };
  return {
    id: 'sock-1',
    handshake,
    data: {},
    disconnect: jest.fn(),
  } as unknown as AuthSocket;
};

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let jwtService: jest.Mocked<Pick<JwtService, 'verify'>>;

  beforeEach(async () => {
    jwtService = { verify: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        { provide: MessagingService, useValue: {} },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();
    gateway = moduleRef.get(MessagingGateway);
  });

  describe('handleConnection', () => {
    it('verifies token from handshake.auth.token and sets client.data.userId', () => {
      const client = buildSocket({ auth: { token: 'valid.jwt.token' } });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('valid.jwt.token', {
        secret: 'test-secret',
      });
      expect(client.data.userId).toBe(userId);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to Authorization Bearer header when handshake.auth has no token', () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Bearer header.jwt.token' },
      });
      jwtService.verify.mockReturnValue({ sub: userId } as never);

      gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith('header.jwt.token', {
        secret: 'test-secret',
      });
      expect(client.data.userId).toBe(userId);
    });

    it('disconnects when no token is present', () => {
      const client = buildSocket({ auth: {}, headers: {} });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.data.userId).toBeUndefined();
    });

    it('disconnects when token verification throws', () => {
      const client = buildSocket({ auth: { token: 'bad.jwt' } });
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.data.userId).toBeUndefined();
    });

    it('ignores Authorization header that is not a Bearer scheme', () => {
      const client = buildSocket({
        auth: {},
        headers: { authorization: 'Basic abc' },
      });

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw and performs no DB writes', () => {
      const client = buildSocket();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });
});
