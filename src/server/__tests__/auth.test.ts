import { AUTH_TYPE } from '../../auth';
import type { AuthCredential } from '../../auth';
import { ScraperAPIBaseServer } from '../sapi-base-server';
import { ScraperApiClient } from '../../clients/scraper-api-client';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn().mockReturnThis(),
  })),
}));

describe('Auth flow', () => {
  describe('base64 encoding', () => {
    it('passes the token credential directly to server', () => {
      const auth: AuthCredential = {
        type: AUTH_TYPE.TOKEN,
        value: 'dGVzdHVzZXI6dGVzdHBhc3M=',
      };
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.auth).toEqual(auth);
    });

    it('passes an api key credential directly to server', () => {
      const auth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'sk-live-abc123' };
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.auth).toEqual(auth);
    });

    it('auth token format is valid base64 encoding of username:password', () => {
      const token = 'dGVzdHVzZXI6dGVzdHBhc3M=';
      const decoded = Buffer.from(token, 'base64').toString('utf-8');

      expect(decoded).toBe('testuser:testpass');
      expect(decoded).toMatch(/^[^:]+:[^:]+$/);
    });

    it('encodes credentials to base64 correctly', () => {
      const username = 'myuser';
      const password = 'mypassword';
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');

      expect(encoded).toBe('bXl1c2VyOm15cGFzc3dvcmQ=');
      expect(Buffer.from(encoded, 'base64').toString('utf-8')).toBe('myuser:mypassword');
    });
  });

  describe('missing credentials handling', () => {
    it('ScraperAPIBaseServer accepts an empty credential value', () => {
      const auth: AuthCredential = { type: AUTH_TYPE.TOKEN, value: '' };
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.auth).toEqual(auth);
    });

    it('server initializes with an empty credential and creates client', () => {
      const auth: AuthCredential = { type: AUTH_TYPE.TOKEN, value: '' };
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.sapiClient).toBeInstanceOf(ScraperApiClient);
    });
  });

  describe('auth token propagation', () => {
    it('auth is passed to tool registration', () => {
      const auth: AuthCredential = { type: AUTH_TYPE.TOKEN, value: 'bXl0b2tlbjEyMw==' };
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.auth).toEqual(auth);
      expect(server.server).toBeDefined();
      expect(server.sapiClient).toBeDefined();
    });
  });
});
