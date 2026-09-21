/**
 * Tiny in-memory LRU with TTL. Lives for the lifetime of the function
 * instance (Vercel keeps warm instances around; the CDN cache in front of
 * the handler does the heavy lifting).
 */
export class LruCache<V> {
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, { value: V; expires: number }>();

  constructor(max: number, ttlMs: number) {
    this.max = Math.max(1, max);
    this.ttlMs = ttlMs;
  }

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires <= now) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: now + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}
