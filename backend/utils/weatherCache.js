const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SIZE = 500;

class WeatherCache {
  constructor() { this.cache = new Map(); }

  set(key, value) {
    if (this.cache.size >= MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, ts: Date.now() });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) return { value: entry.value, stale: true, stale_at: new Date(entry.ts).toISOString() };
    return { value: entry.value, stale: false };
  }
}

module.exports = new WeatherCache();
