type Entry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * In-memory map whose entries expire after a fixed time to live.
 * Holds only short-lived OAuth state (pending authorizations, one-time codes),
 * so a restart or a second replica loses nothing a client cannot recover from
 * by starting the flow again.
 */
export class TtlStore<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {}

  set(key: string, value: T): void {
    this.sweep();
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return;
    }

    return entry.value;
  }

  /** Reads and removes the entry in one step, for single-use values. */
  take(key: string): T | undefined {
    const value = this.get(key);
    this.entries.delete(key);
    return value;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    this.sweep();
    return this.entries.size;
  }

  private sweep(): void {
    const now = this.now();

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
