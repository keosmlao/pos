const buckets = globalThis.__posRateLimitBuckets || new Map();
globalThis.__posRateLimitBuckets = buckets;

export function consumeRateLimit(key, { limit = 5, windowMs = 15 * 60_000 } = {}) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}

export function clearRateLimit(key) {
  buckets.delete(key);
}
