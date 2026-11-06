import { env } from '../config/env.mjs';

export function createResponseCache({ ttlMs = 30000, maxEntries = 500, now = Date.now } = {}) {
  const entries = new Map();
  let generation = 0;

  function clear() {
    entries.clear();
    generation++;
  }

  function read(req, res, next) {
    // Cache on this server only; browsers must not retain registration information.
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' || req.path === '/health') return next();
    const key = req.originalUrl;
    const cached = entries.get(key);
    if (cached && cached.expiresAt > now()) {
      return res.set('X-Cache', 'HIT').type('json').send(cached.body);
    }
    entries.delete(key);
    res.set('X-Cache', 'MISS');
    const requestGeneration = generation;
    const json = res.json.bind(res);
    res.json = (body) => {
      const expiresAt = Math.min(now() + ttlMs, res.locals.cacheExpiresAt ?? Infinity);
      if (res.statusCode === 200 && requestGeneration === generation && expiresAt > now()) {
        if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
        entries.set(key, { body: JSON.stringify(body), expiresAt });
      }
      return json(body);
    };
    next();
  }

  function invalidateWrites(req, res, next) {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) clear();
      });
    }
    next();
  }

  return { read, invalidateWrites, clear };
}

// One application process: a bounded Map avoids requiring another hosted service.
export const responseCache = createResponseCache({ ttlMs: env.cacheTtlMs });
