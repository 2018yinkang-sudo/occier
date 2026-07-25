const DEFAULT_TTL = 5 * 60 * 1000;

export class ProbeCache {
  constructor(ttl = DEFAULT_TTL) {
    this._cache = new Map();
    this._inFlight = new Map();
    this._ttl = ttl;
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.testedAt.getTime() > this._ttl) {
      this._cache.delete(key);
      return null;
    }
    return entry;
  }

  set(key, value) {
    this._cache.set(key, { ...value, testedAt: new Date() });
  }

  delete(key) {
    this._cache.delete(key);
  }

  clear() {
    this._cache.clear();
    this._inFlight.clear();
  }

  async fetch(key, fetcher) {
    const cached = this.get(key);
    if (cached) return cached;

    const inFlight = this._inFlight.get(key);
    if (inFlight) return await inFlight;

    const promise = fetcher().then((result) => {
      this._inFlight.delete(key);
      this.set(key, result);
      return result;
    }).catch((err) => {
      this._inFlight.delete(key);
      throw err;
    });

    this._inFlight.set(key, promise);
    return await promise;
  }

  get size() {
    return this._cache.size;
  }
}
