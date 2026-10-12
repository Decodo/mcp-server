import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

const IV_BYTES = 12;

const TAG_BYTES = 16;

type Sealed = {
  exp?: number;
};

export class Sealer {
  private readonly key: Buffer;

  constructor(
    secret: string,
    private readonly now: () => number = Date.now
  ) {
    this.key = createHash('sha256').update(secret).digest();
  }

  static randomSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  seal(purpose: string, payload: object, ttlMs?: number): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    cipher.setAAD(Buffer.from(purpose));

    const body: Sealed = ttlMs === undefined ? { ...payload } : { ...payload, exp: this.now() + ttlMs };
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(body), 'utf8'), cipher.final()]);

    return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64url');
  }

  unseal<T extends object>(purpose: string, token: string): T | undefined {
    let buffer: Buffer;

    try {
      buffer = Buffer.from(token, 'base64url');
    } catch {
      return;
    }

    if (buffer.length <= IV_BYTES + TAG_BYTES) {
      return;
    }

    const iv = buffer.subarray(0, IV_BYTES);
    const tag = buffer.subarray(buffer.length - TAG_BYTES);
    const encrypted = buffer.subarray(IV_BYTES, buffer.length - TAG_BYTES);

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAAD(Buffer.from(purpose));
      decipher.setAuthTag(tag);

      const body = JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
      ) as T & Sealed;

      if (body.exp !== undefined && body.exp <= this.now()) {
        return;
      }

      delete body.exp;

      return body as T;
    } catch {
      return;
    }
  }
}
