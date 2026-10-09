import { CLAUDE_REDIRECT_URIS } from '../config';
import { disallowedRedirectUris, isAllowedRedirectUri, isLoopbackRedirectUri } from '../redirect-uris';

describe('redirect uri allowlist', () => {
  it('accepts the Claude callbacks exactly', () => {
    for (const uri of CLAUDE_REDIRECT_URIS) {
      expect(isAllowedRedirectUri(uri, CLAUDE_REDIRECT_URIS)).toBe(true);
    }

    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback/../evil', CLAUDE_REDIRECT_URIS)).toBe(false);
    expect(isAllowedRedirectUri('https://claude.ai.evil.com/api/mcp/auth_callback', CLAUDE_REDIRECT_URIS)).toBe(false);
  });

  it('accepts loopback on any port and path, http only', () => {
    expect(isLoopbackRedirectUri('http://localhost/callback')).toBe(true);
    expect(isLoopbackRedirectUri('http://localhost:3118/callback')).toBe(true);
    expect(isLoopbackRedirectUri('http://127.0.0.1:6274/oauth/callback')).toBe(true);
    expect(isLoopbackRedirectUri('http://[::1]:8080/cb')).toBe(true);
    expect(isLoopbackRedirectUri('https://localhost/callback')).toBe(false);
    expect(isLoopbackRedirectUri('http://localhost.evil.com/callback')).toBe(false);
    expect(isLoopbackRedirectUri('not a url')).toBe(false);
  });

  it('accepts extra exact uris from configuration', () => {
    const allowed = [...CLAUDE_REDIRECT_URIS, 'https://partner.example/cb'];

    expect(isAllowedRedirectUri('https://partner.example/cb', allowed)).toBe(true);
    expect(isAllowedRedirectUri('https://partner.example/cb?x=1', allowed)).toBe(false);
  });

  it('lists every uri that is not allowed', () => {
    expect(
      disallowedRedirectUris(
        ['https://claude.ai/api/mcp/auth_callback', 'https://evil.example/cb', 'http://localhost/cb', 'https://other.example/cb'],
        CLAUDE_REDIRECT_URIS
      )
    ).toEqual(['https://evil.example/cb', 'https://other.example/cb']);
  });
});
