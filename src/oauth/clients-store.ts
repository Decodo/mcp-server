import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthClientInformationFull, OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { log } from '../logger';
import { readBoundedText } from './bounded-body';
import { disallowedRedirectUris } from './redirect-uris';
import type { Sealer } from './sealer';
import { TtlStore } from './ttl-store';

type FetchLike = typeof fetch;

const SEAL_PURPOSE = 'client';

const PUBLIC_CLIENT = 'none';

export const MAX_CLIENT_NAME_LENGTH = 128;

export const MAX_REDIRECT_URIS = 10;

export const MAX_REDIRECT_URI_LENGTH = 1024;

export const MAX_SCOPE_LENGTH = 256;

const MAX_METADATA_DOCUMENT_BYTES = 64 * 1024;

const METADATA_DOCUMENT_TTL_MS = 60 * 60 * 1000;

const METADATA_FETCH_TIMEOUT_MS = 5_000;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[/;

type SealedClient = Pick<
  OAuthClientMetadata,
  'client_name' | 'redirect_uris' | 'grant_types' | 'response_types' | 'scope' | 'token_endpoint_auth_method'
> & {
  client_id_issued_at?: number;
};

export const isClientIdMetadataUrl = (clientId: string): boolean => {
  if (!URL.canParse(clientId)) {
    return false;
  }

  const url = new URL(clientId);

  return (
    url.protocol === 'https:' &&
    url.pathname !== '/' &&
    !url.hash &&
    !url.username &&
    !LOOPBACK_HOSTS.has(url.hostname) &&
    !IP_LITERAL.test(url.hostname)
  );
};

export const assertClientMetadataBounded = (client: Pick<OAuthClientMetadata, 'redirect_uris' | 'client_name' | 'scope'>): void => {
  if (client.redirect_uris.length === 0) {
    throw new InvalidClientMetadataError('redirect_uris must contain at least one uri');
  }

  if (client.redirect_uris.length > MAX_REDIRECT_URIS) {
    throw new InvalidClientMetadataError(`redirect_uris must contain at most ${MAX_REDIRECT_URIS} uris`);
  }

  if (client.redirect_uris.some(uri => uri.length > MAX_REDIRECT_URI_LENGTH)) {
    throw new InvalidClientMetadataError(`each redirect_uri must be at most ${MAX_REDIRECT_URI_LENGTH} characters`);
  }

  if (client.client_name && client.client_name.length > MAX_CLIENT_NAME_LENGTH) {
    throw new InvalidClientMetadataError(`client_name must be at most ${MAX_CLIENT_NAME_LENGTH} characters`);
  }

  if (client.scope && client.scope.length > MAX_SCOPE_LENGTH) {
    throw new InvalidClientMetadataError(`scope must be at most ${MAX_SCOPE_LENGTH} characters`);
  }
};

export class ClientsStore implements OAuthRegisteredClientsStore {
  private readonly metadataDocuments = new TtlStore<OAuthClientInformationFull>(METADATA_DOCUMENT_TTL_MS);

  private readonly sealer: Sealer;

  private readonly allowedRedirectUris: string[];

  private readonly fetch: FetchLike;

  constructor({
    sealer,
    allowedRedirectUris,
    fetch = globalThis.fetch,
  }: {
    sealer: Sealer;
    allowedRedirectUris: string[];
    fetch?: FetchLike;
  }) {
    this.sealer = sealer;
    this.allowedRedirectUris = allowedRedirectUris;
    this.fetch = fetch;
  }

  registerClient(client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>): OAuthClientInformationFull {
    if (client.token_endpoint_auth_method !== PUBLIC_CLIENT) {
      throw new InvalidClientMetadataError(`only public clients are supported (token_endpoint_auth_method "${PUBLIC_CLIENT}")`);
    }

    assertClientMetadataBounded(client);
    this.assertRedirectUrisAllowed(client.redirect_uris);

    const sealed: SealedClient = {
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      scope: client.scope,
      token_endpoint_auth_method: PUBLIC_CLIENT,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };

    return {
      ...client,
      ...sealed,
      client_id: this.sealer.seal(SEAL_PURPOSE, sealed),
      client_secret: undefined,
      client_secret_expires_at: undefined,
    };
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    if (isClientIdMetadataUrl(clientId)) {
      return this.metadataDocuments.get(clientId) ?? (await this.fetchMetadataDocument(clientId));
    }

    const sealed = this.sealer.unseal<SealedClient>(SEAL_PURPOSE, clientId);

    return sealed && { ...sealed, client_id: clientId };
  }

  private assertRedirectUrisAllowed(redirectUris: string[]): void {
    const disallowed = disallowedRedirectUris(redirectUris, this.allowedRedirectUris);

    if (disallowed.length > 0) {
      throw new InvalidClientMetadataError(`redirect_uri not allowed: ${disallowed.join(', ')}`);
    }
  }

  private async fetchMetadataDocument(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    try {
      const response = await this.fetch(clientId, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        log('warn', 'oauth.client_metadata.fetch_failed', { clientId, status: response.status });
        return;
      }

      const text = await readBoundedText(response, MAX_METADATA_DOCUMENT_BYTES);

      if (text === undefined) {
        log('warn', 'oauth.client_metadata.too_large', { clientId, maxBytes: MAX_METADATA_DOCUMENT_BYTES });
        return;
      }

      const document = JSON.parse(text) as { client_id?: unknown };

      if (document.client_id !== clientId) {
        log('warn', 'oauth.client_metadata.client_id_mismatch', { clientId });
        return;
      }

      const parsed = OAuthClientMetadataSchema.safeParse(document);

      if (!parsed.success) {
        log('warn', 'oauth.client_metadata.invalid', { clientId, issues: parsed.error.message });
        return;
      }

      try {
        assertClientMetadataBounded(parsed.data);
      } catch (error) {
        log('warn', 'oauth.client_metadata.invalid', { clientId, issues: error instanceof Error ? error.message : String(error) });
        return;
      }

      const disallowed = disallowedRedirectUris(parsed.data.redirect_uris, this.allowedRedirectUris);

      if (disallowed.length > 0) {
        log('warn', 'oauth.client_metadata.redirect_uri_not_allowed', { clientId, disallowed });
        return;
      }

      const client: OAuthClientInformationFull = {
        ...parsed.data,
        client_id: clientId,
        token_endpoint_auth_method: PUBLIC_CLIENT,
      };

      this.metadataDocuments.set(clientId, client);

      return client;
    } catch (error) {
      log('warn', 'oauth.client_metadata.fetch_failed', {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
}
