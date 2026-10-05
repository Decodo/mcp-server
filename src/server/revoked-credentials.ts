import { createHash } from 'node:crypto';
import type { AuthCredential } from '../auth';
import { TtlStore } from '../oauth/ttl-store';

const REMEMBER_MS = 5 * 60 * 1000;

export class RevokedCredentials {
  private readonly rejected = new TtlStore<true>(REMEMBER_MS);

  add(credential: AuthCredential): void {
    this.rejected.set(RevokedCredentials.fingerprint(credential), true);
  }

  has(credential: AuthCredential): boolean {
    return this.rejected.get(RevokedCredentials.fingerprint(credential)) === true;
  }

  private static fingerprint({ type, value }: AuthCredential): string {
    return createHash('sha256').update(`${type}:${value}`).digest('hex');
  }
}
