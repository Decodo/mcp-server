import { ClientsStore, isClientIdMetadataUrl } from '../clients-store';

const CLAUDE_CODE_CLIENT_ID = 'https://claude.ai/oauth/claude-code-client-metadata';

const metadataDocument = {
  client_id: CLAUDE_CODE_CLIENT_ID,
  client_name: 'Claude Code',
  redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code'],
  response_types: ['code'],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const storeWith = (fetchMock: jest.Mock) =>
  new ClientsStore({ fetch: fetchMock as unknown as typeof fetch });

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

describe('ClientsStore', () => {
  it('returns a dynamically registered client', async () => {
    const store = storeWith(jest.fn());
    const client = {
      client_id: 'abc',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
    };

    store.registerClient(client);

    await expect(store.getClient('abc')).resolves.toEqual(client);
  });

  it('returns undefined for an unknown plain id without fetching', async () => {
    const fetchMock = jest.fn();
    const store = storeWith(fetchMock);

    await expect(store.getClient('missing')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves a client id metadata document as a public client', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(metadataDocument));
    const store = storeWith(fetchMock);

    const client = await store.getClient(CLAUDE_CODE_CLIENT_ID);

    expect(fetchMock).toHaveBeenCalledWith(CLAUDE_CODE_CLIENT_ID, expect.objectContaining({ redirect: 'error' }));
    expect(client).toMatchObject({
      client_id: CLAUDE_CODE_CLIENT_ID,
      redirect_uris: metadataDocument.redirect_uris,
      token_endpoint_auth_method: 'none',
    });
    expect(client?.client_secret).toBeUndefined();
  });

  it('caches a fetched metadata document', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(metadataDocument));
    const store = storeWith(fetchMock);

    await store.getClient(CLAUDE_CODE_CLIENT_ID);
    await store.getClient(CLAUDE_CODE_CLIENT_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a document whose client_id differs from the url', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ ...metadataDocument, client_id: 'https://evil.example/other' }));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('rejects a document without redirect_uris', async () => {
    const withoutRedirects = { ...metadataDocument, redirect_uris: undefined };
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(withoutRedirects));

    await expect(storeWith(fetchMock).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });

  it('returns undefined when the document cannot be fetched', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('network down'));
    const notFound = jest.fn().mockResolvedValue(jsonResponse({}, 404));

    await expect(storeWith(failing).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
    await expect(storeWith(notFound).getClient(CLAUDE_CODE_CLIENT_ID)).resolves.toBeUndefined();
  });
});
