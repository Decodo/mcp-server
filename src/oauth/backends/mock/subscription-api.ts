import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import express from 'express';
import { TOKEN_EXCHANGE_ERROR } from '../../token-exchange';
import { TtlStore } from '../../ttl-store';
import { REQUEST_JWT, verifyRequestJwt } from '../decodo/request-jwt';
import type { RequestJwtClaims } from '../decodo/request-jwt';

const PENDING_TTL_MS = REQUEST_JWT.LIFETIME_SECONDS * 1000;

const CODE_TTL_MS = 60_000;

const CODE_BYTES = 32;

type PendingRequest = Pick<RequestJwtClaims, 'client_id' | 'redirect_uri' | 'state' | 'code_challenge'>;

type IssuedCode = PendingRequest & {
  scraperApiKey: string;
};

export type Decision = {
  redirectUri: string;
  state: string;
  code?: string;
  error?: 'access_denied';
};

export class MockRequestError extends Error {}

export class MockSubscriptionApi {
  private readonly pending = new TtlStore<PendingRequest>(PENDING_TTL_MS);

  private readonly codes = new TtlStore<IssuedCode>(CODE_TTL_MS);

  constructor(
    private readonly publicKey: KeyObject,
    private readonly registeredClient: { clientId: string; kid: string; redirectUri: string }
  ) {}

  validateRequest({ clientId, request }: { clientId: string; request: string }): { uuid: string; clientName: string } {
    const decoded = verifyRequestJwt(request, this.publicKey);

    if (!decoded) {
      throw new MockRequestError('request JWT signature or format is invalid');
    }

    const { header, claims } = decoded;
    const now = Math.floor(Date.now() / 1000);

    const failures = [
      header.kid !== this.registeredClient.kid && 'kid is not registered for this client',
      claims.aud !== REQUEST_JWT.AUDIENCE && 'aud must be subscription-api',
      claims.client_id !== clientId && 'client_id in the JWT differs from the query',
      clientId !== this.registeredClient.clientId && 'unknown client_id',
      claims.redirect_uri !== this.registeredClient.redirectUri && 'redirect_uri is not the registered one',
      claims.code_challenge_method !== REQUEST_JWT.CODE_CHALLENGE_METHOD && 'code_challenge_method must be S256',
      claims.code_challenge?.length !== 43 && 'code_challenge must be 43 characters',
      !(claims.state?.length >= 16 && claims.state.length <= 255) && 'state must be 16 to 255 characters',
      !(claims.exp > claims.iat && claims.exp - claims.iat <= REQUEST_JWT.LIFETIME_SECONDS) && 'exp must be within 120 s of iat',
      claims.exp < now - 30 && 'request has expired',
    ].filter((failure): failure is string => typeof failure === 'string');

    if (failures.length > 0) {
      throw new MockRequestError(failures.join('; '));
    }

    const uuid = randomUUID();
    this.pending.set(uuid, {
      client_id: claims.client_id,
      redirect_uri: claims.redirect_uri,
      state: claims.state,
      code_challenge: claims.code_challenge,
    });

    return { uuid, clientName: 'Decodo MCP (mock)' };
  }

  pendingRequest(uuid: string): (PendingRequest & { uuid: string }) | undefined {
    const pending = this.pending.get(uuid);

    return pending && { ...pending, uuid };
  }

  decide({ uuid, decision, scraperApiKey }: { uuid: string; decision: string; scraperApiKey: string }): Decision {
    const pending = this.pending.take(uuid);

    if (!pending) {
      throw new MockRequestError('Exchange request can no longer be decided.');
    }

    if (decision !== 'approve') {
      return { redirectUri: pending.redirect_uri, state: pending.state, error: 'access_denied' };
    }

    const code = randomBytes(CODE_BYTES).toString('base64url');
    this.codes.set(code, { ...pending, scraperApiKey });

    return { redirectUri: pending.redirect_uri, state: pending.state, code };
  }

  exchange({ clientId, code, codeVerifier }: { clientId: string; code: string; codeVerifier: string }):
    | { ok: true; sapiToken: string }
    | { ok: false; status: number; appCode: string } {
    const issued = this.codes.take(code);

    if (!issued) {
      return { ok: false, status: 400, appCode: TOKEN_EXCHANGE_ERROR.INVALID_GRANT };
    }

    if (issued.client_id !== clientId) {
      return { ok: false, status: 403, appCode: TOKEN_EXCHANGE_ERROR.INVALID_CLIENT };
    }

    if (createHash('sha256').update(codeVerifier).digest('base64url') !== issued.code_challenge) {
      return { ok: false, status: 400, appCode: TOKEN_EXCHANGE_ERROR.INVALID_GRANT };
    }

    return { ok: true, sapiToken: issued.scraperApiKey };
  }
}

export const mockSubscriptionApiRouter = (api: MockSubscriptionApi): express.Router => {
  const router = express.Router();

  router.use(express.json());

  router.post('/token-exchange/request', (req, res) => {
    const { client_id: clientId, request } = req.body ?? {};

    if (typeof clientId !== 'string' || typeof request !== 'string') {
      res.status(422).json({ status_code: 422, title: 'Unprocessable Entity', detail: 'client_id and request are required' });
      return;
    }

    try {
      const { uuid, clientName } = api.validateRequest({ clientId, request });
      const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();
      res.status(201).json({ uuid, client_name: clientName, expires_at: expiresAt });
    } catch (error) {
      const detail = error instanceof MockRequestError ? error.message : 'unexpected error';
      res.status(400).json({ status_code: 400, title: 'Bad Request', detail });
    }
  });

  router.post('/token-exchange/exchange', (req, res) => {
    const { client_id: clientId, code, code_verifier: codeVerifier } = req.body ?? {};

    if (typeof clientId !== 'string' || typeof code !== 'string' || typeof codeVerifier !== 'string') {
      res.status(422).json({ status_code: 422, title: 'Unprocessable Entity', detail: 'client_id, code and code_verifier are required' });
      return;
    }

    const result = api.exchange({ clientId, code, codeVerifier });

    if (!result.ok) {
      res.status(result.status).json({
        status_code: result.status,
        title: result.status === 403 ? 'Forbidden' : 'Bad Request',
        detail: 'Exchange failed.',
        app_code: result.appCode,
      });
      return;
    }

    res.status(200).json({ sapi_token: result.sapiToken, label: 'mock key' });
  });

  return router;
};
