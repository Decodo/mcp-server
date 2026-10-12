import { cookieValue } from '../cookies';

describe('cookieValue', () => {
  it('finds the named cookie and decodes it', () => {
    expect(cookieValue('a=1; decodo_oauth_pending=abc%20def; b=2', 'decodo_oauth_pending')).toBe('abc def');
  });

  it('returns undefined when the cookie is missing or malformed', () => {
    expect(cookieValue(undefined, 'x')).toBeUndefined();
    expect(cookieValue('a=1', 'x')).toBeUndefined();
    expect(cookieValue('x=%E0%A4%A', 'x')).toBeUndefined();
    expect(cookieValue('x=%', 'x')).toBeUndefined();
  });
});
