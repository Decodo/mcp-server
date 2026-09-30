import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { log } from '../logger';
import { TtlStore } from './ttl-store';

type FetchLike = typeof fetch;

const REGISTERED_CLIENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const METADATA_DOCUMENT_TTL_MS = 60 * 60 * 1000;

const METADATA_FETCH_TIMEOUT_MS = 5_000;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[/;

/**
 * A client id that is itself an https URL points at a Client ID Metadata Document
 * (MCP authorization spec). Claude Code identifies itself this way.
 */
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

/**
 * Serves both registration styles Claude uses: dynamic client registration (RFC 7591)
 * for claude.ai and desktop, and Client ID Metadata Documents for Claude Code.
 * Registered clients live in memory; a client whose id is unknown after a restart
 * gets `invalid_client` and re-registers.
 */
export class ClientsStore implements OAuthRegisteredClientsStore {
  private readonly registered = new TtlStore<OAuthClientInformationFull>(REGISTERED_CLIENT_TTL_MS);

  private readonly metadataDocuments = new TtlStore<OAuthClientInformationFull>(METADATA_DOCUMENT_TTL_MS);

  private readonly fetch: FetchLike;

  constructor({ fetch = globalThis.fetch }: { fetch?: FetchLike } = {}) {
    this.fetch = fetch;
  }

  registerClient(client: OAuthClientInformationFull): OAuthClientInformationFull {
    this.registered.set(client.client_id, client);
    return client;
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const registered = this.registered.get(clientId);

    if (registered) {
      return registered;
    }

    if (!isClientIdMetadataUrl(clientId)) {
      return;
    }

    return this.metadataDocuments.get(clientId) ?? (await this.fetchMetadataDocument(clientId));
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

      const document = (await response.json()) as { client_id?: unknown };

      if (document.client_id !== clientId) {
        log('warn', 'oauth.client_metadata.client_id_mismatch', { clientId });
        return;
      }

      const parsed = OAuthClientMetadataSchema.safeParse(document);

      if (!parsed.success) {
        log('warn', 'oauth.client_metadata.invalid', { clientId, issues: parsed.error.message });
        return;
      }

      const client: OAuthClientInformationFull = {
        ...parsed.data,
        client_id: clientId,
        token_endpoint_auth_method: 'none',
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
