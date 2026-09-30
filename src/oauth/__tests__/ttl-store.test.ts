import { TtlStore } from '../ttl-store';

describe('TtlStore', () => {
  const withClock = () => {
    let now = 1_000;
    const store = new TtlStore<string>(100, () => now);
    const advance = (ms: number) => {
      now += ms;
    };

    return { store, advance };
  };

  it('returns a value before it expires', () => {
    const { store, advance } = withClock();
    store.set('a', 'one');
    advance(99);

    expect(store.get('a')).toBe('one');
  });

  it('drops a value once its ttl has passed', () => {
    const { store, advance } = withClock();
    store.set('a', 'one');
    advance(100);

    expect(store.get('a')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('take returns the value once', () => {
    const { store } = withClock();
    store.set('a', 'one');

    expect(store.take('a')).toBe('one');
    expect(store.take('a')).toBeUndefined();
  });

  it('sweeps expired entries on set', () => {
    const { store, advance } = withClock();
    store.set('a', 'one');
    advance(100);
    store.set('b', 'two');

    expect(store.size).toBe(1);
  });
});
