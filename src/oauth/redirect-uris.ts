const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const isLoopbackRedirectUri = (uri: string): boolean => {
  if (!URL.canParse(uri)) {
    return false;
  }

  const url = new URL(uri);

  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
};

export const isAllowedRedirectUri = (uri: string, allowed: string[]): boolean =>
  allowed.includes(uri) || isLoopbackRedirectUri(uri);

export const disallowedRedirectUris = (uris: string[], allowed: string[]): string[] =>
  uris.filter(uri => !isAllowedRedirectUri(uri, allowed));
