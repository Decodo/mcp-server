import { InvalidClientMetadataError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import {
  ClientsStore,
  MAX_CLIENT_NAME_LENGTH,
  MAX_REDIRECT_URIS,
  MAX_REDIRECT_URI_LENGTH,
  MAX_SCOPE_LENGTH,
  isClientIdMetadataUrl,
} from '../clients-store';
import { CLAUDE_REDIRECT_URIS } from '../config';
import { Sealer } from '../sealer';

const CLAUDE_CODE_CLIENT_ID = 'https://claude.ai/oauth/claude-code-client-metadata';

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

const metadataDocument = {
  client_id: CLAUDE_CODE_CLIENT_ID,
  client_name: 'Claude Code',
  redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code'],
  response_types: ['code'],
};

const registration = {
  client_name: 'Claude',
  redirect_uris: [CLAUDE_CALLBACK],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code'],
  response_types: ['code'],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const storeWith = (fetchMock: jest.Mock = jest.fn(), sealer = new Sealer('secret')) =>
  new ClientsStore({ sealer, allowedRedirectUris: CLAUDE_REDIRECT_URIS, fetch: fetchMock as unknown as typeof fetch });

describe('isClientIdMetadataUrl', () => {
  it('accepts an https url with a path', () => {
    expect(isClientIdMetadataUrl(CLAUDE_CODE_CLIENT_ID)).toBe(true);
  });

  it('rejects plain ids, http, root paths, loopback and ip literals', () => {
    expect(isClientIdMetadataUrl('7b1a0d6e-5f3c-4a2b-9c8d-1e2f3a4b5c6d')).toBe(false);
    expect(isClientIdMetadataUrl('http://example.com/client')).toBe(false);
    expect(isClientIdMetadataUrl('https://example.com/')).toBe(false);
    expect(isClientIdMetadataUrl('https://localhost/client')).toBe(false);
    expect(isClientIdMetadataUrl('https://10.0.0.1/client')).toBe(false);
    expect(isClientIdMetadataUrl('https://example.com/client#frag')).toBe(false);
  });
});

describe('ClientsStore dynamic registration', () => {
  it('seals the registration into the client id and resolves it without storage', async () => {
    const sealer = new Sealer('secret');
    const registered = storeWith(jest.fn(), sealer).registerClient(registration);

    expect(registered.client_id).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(registered.client_secret).toBeUndefined();
    expect(registered.client_id_issued_at).toEqual(expect.any(Number));

    const resolvedElsewhere = await storeWith(jest.fn(), new Sealer('secret')).getClient(registered.client_id);
    expect(resolvedElsewhere).toMatchObject({
      client_id: registered.client_id,
      client_name: 'Claude',
      redirect_uris: [CLAUDE_CALLBACK],
      token_endpoint_auth_method: 'none',
    });
  });

  it('does not resolve a client id sealed with another secret', async () => {
    const registered = storeWith(jest.fn(), new Sealer('one')).registerClient(registration);

    await expect(storeWith(jest.fn(), new Sealer('two')).getClient(registered.client_id)).resolves.toBeUndefined();
  });

  it('returns undefined for an unknown plain id without fetching', async () => {
    const fetchMock = jest.fn();

    await expect(storeWith(fetchMock).getClient('missing')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects redirect uris outside the allowlist', () => {
    expect(() =>
      storeWith().registerClient({ ...registration, redirect_uris: [CLAUDE_CALLBACK, 'https://evil.example/cb'] })
    ).toThrow(InvalidClientMetadataError);
    expect(() =>
      storeWith().registerClient({ ...registration, redirect_uris: ['https://evil.example/cb'] })
    ).toThrow('https://evil.example/cb');
  });

  it('accepts loopback redirect uris', () => {
    expect(() =>
      storeWith().registerClient({ ...registration, redirect_uris: ['http://localhost:6274/oauth/callback'] })
    ).not.toThrow();
  });

  it('rejects an empty redirect uri list and an oversized client name', () => {
    expect(() => storeWith().registerClient({ ...registration, redirect_uris: [] })).toThrow(InvalidClientMetadataError);
    expect(() =>
      storeWith().registerClient({ ...registration, client_name: 'n'.repeat(MAX_CLIENT_NAME_LENGTH + 1) })
    ).toThrow(InvalidClientMetadataError);
    expect(() =>
      storeWith().registerClient({ ...registration, client_name: 'n'.repeat(MAX_CLIENT_NAME_LENGTH) })
    ).not.toThrow();
  });

  it('rejects too many, over-long redirect uris and an over-long scope', () => {
    const loopback = (n: number) => `http://localhost:${n}/callback`;

    expect(() =>
      storeWith().registerClient({ ...registration, redirect_uris: Array.from({ length: MAX_REDIRECT_URIS + 1 }, (_, i) => loopback(i)) })
    ).toThrow(InvalidClientMetadataError);
    expect(() =>
      storeWith().registerClient({ ...registration, redirect_uris: [`http://localhost/${'p'.repeat(MAX_REDIRECT_URI_LENGTH)}`] })
    ).toThrow(InvalidClientMetadataError);
    expect(() => storeWith().registerClient({ ...registration, scope: 's'.repeat(MAX_SCOPE_LENGTH + 1) })).toThrow(
      InvalidClientMetadataError
    );
    expect(() => storeWith().registerClient({ ...registration, scope: 's'.repeat(MAX_SCOPE_LENGTH) })).not.toThrow();
  });

  it('rejects confidential clients', () => {
    expect(() =>
      storeWith().registerClient({ ...registration, token_endpoint_auth_method: 'client_secret_post', client_secret: 's' })
    ).toThrow(InvalidClientMetadataError);
    expect(() => storeWith().registerClient({ ...registration, token_endpoint_auth_method: undefined })).toThrow(
      InvalidClientMetadataError
    );
  });
});

describe('ClientsStore client id metadata documents', () => {
  it('resolves a document as a public client', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(metadataDocument));

    const client = await storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID);

    expect(fetchMock).toHaveBeenCalledWith(CLAUDE_CODE_CLIENT_ID, expect.objectContaining({ redirect: 'error' }));
    expect(client).toMatchObject({
      client_id: CLAUDE_CODE_CLIENT_ID,
      redirect_uris: metadataDocument.redirect_uris,
      token_endpoint_auth_method: 'none',
    });
    expect(client?.client_secret).toBeUndefined();
  });

  it('refuses a document over the size limit without buffering it', async () => {
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(16 * 1024));
      },
    });
    const fetchMock = jest.fn().mockResolvedValue(new Response(endless, { headers: { 'Content-Type': 'application/json' } }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
    expect(pulls).toBeLessThan(10);

    const declared = new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '10000000' } });
    await expect(storeWith(jest.fn().mockResolvedValue(declared)).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('refuses a document whose metadata is out of bounds', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...metadataDocument, redirect_uris: [`http://localhost/${'p'.repeat(MAX_REDIRECT_URI_LENGTH)}`] }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('caches a fetched document', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(metadataDocument));
    const store = storeWith(fetchMock);

    await store.getClient(CLAUDE_CODE_CLIENT_ID);
    await store.getClient(CLAUDE_CODE_CLIENT_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a document whose client_id differs from the url', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ...metadataDocument, client_id: 'https://evil.example/other' }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('rejects a document with a redirect uri outside the allowlist', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...metadataDocument, redirect_uris: ['https://evil.example/cb'] }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('rejects a document without redirect_uris', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ ...metadataDocument, redirect_uris: undefined }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('returns undefined when the document cannot be fetched', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('network down'));
    const notFound = jest.fn().mockResolvedValue(jsonResponse({}, 404));

    await expect(storeWith(failing).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
    await expect(storeWith(notFound).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });
});
