import { Sealer } from '../sealer';

describe('Sealer', () => {
  const withClock = () => {
    let now = 1_000_000;
    const sealer = new Sealer('secret', () => now);
    const advance = (ms: number) => {
      now += ms;
    };

    return { sealer, advance };
  };

  it('round-trips a payload', () => {
    const { sealer } = withClock();
    const token = sealer.seal('code', { a: 1, b: 'two' });

    expect(sealer.unseal('code', token)).toEqual({ a: 1, b: 'two' });
  });

  it('is opaque and different every time', () => {
    const { sealer } = withClock();
    const first = sealer.seal('code', { a: 1 });
    const second = sealer.seal('code', { a: 1 });

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('expires after the ttl', () => {
    const { sealer, advance } = withClock();
    const token = sealer.seal('code', { a: 1 }, 1_000);

    advance(999);
    expect(sealer.unseal('code', token)).toEqual({ a: 1 });

    advance(1);
    expect(sealer.unseal('code', token)).toBeUndefined();
  });

  it('rejects a token sealed for another purpose', () => {
    const { sealer } = withClock();
    const token = sealer.seal('client', { a: 1 });

    expect(sealer.unseal('code', token)).toBeUndefined();
  });

  it('rejects a token sealed with another secret', () => {
    const token = new Sealer('one').seal('code', { a: 1 });

    expect(new Sealer('two').unseal('code', token)).toBeUndefined();
  });

  it('rejects tampered, truncated and garbage tokens', () => {
    const { sealer } = withClock();
    const token = sealer.seal('code', { a: 1 });
    const flipped = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21);

    expect(sealer.unseal('code', flipped)).toBeUndefined();
    expect(sealer.unseal('code', token.slice(0, 10))).toBeUndefined();
    expect(sealer.unseal('code', 'not base64url at all!')).toBeUndefined();
    expect(sealer.unseal('code', '')).toBeUndefined();
  });
});
