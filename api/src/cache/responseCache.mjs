import { env } from '../config/env.mjs';
import { changes } from '../events/changes.mjs';

function normalizePath(path) {
  try {
    return decodeURIComponent(path).replace(/\/+$/, '');
  } catch {
    return path;
  }
}

function eventResource(match) {
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return `event:${id}:${match[2] ? 'registrations' : 'detail'}`;
}

function resourceFor(path) {
  const normalized = normalizePath(path);
  if (normalized === '/events') return 'events:list';
  if (normalized === '/stats') return 'stats';
  const event = normalized.match(/^\/events\/([^/]+)(\/registrations)?$/);
  if (event) return eventResource(event) || normalized;
  return normalized;
}

function resourcesForChange({ type, eventId }) {
  const detail = `event:${eventId}:detail`;
  const registrations = `event:${eventId}:registrations`;
  const resources = {
    'event.created': ['events:list', 'stats'],
    'event.updated': ['events:list', 'stats', detail],
    'event.deleted': ['events:list', 'stats', detail, registrations],
    'registration.created': ['stats', detail, registrations]
  };
  return resources[type] || [];
}

export function createResponseCache({ ttlMs = 30000, maxEntries = 500, now = Date.now } = {}) {
  const entries = new Map();
  const pendingReads = new Set();

  function invalidate(resources) {
    const affected = new Set(resources);
    for (const [key, entry] of entries) if (affected.has(entry.resource)) entries.delete(key);
    // Cancel only affected in-flight fills; unrelated reads and cached entries survive.
    for (const read of pendingReads) if (affected.has(read.resource)) read.valid = false;
  }

  function clear() {
    entries.clear();
    for (const read of pendingReads) read.valid = false;
  }

  function store(key, resource, body, res, read) {
    pendingReads.delete(read);
    const expiresAt = Math.min(now() + ttlMs, res.locals.cacheExpiresAt ?? Infinity);
    if (res.statusCode !== 200 || !read.valid || expiresAt <= now()) return;
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
    entries.set(key, { resource, body: JSON.stringify(body), expiresAt });
  }

  function read(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const resource = resourceFor(req.path);
    if (req.method !== 'GET' || resource === '/health') return next();
    const key = req.originalUrl;
    const cached = entries.get(key);
    if (cached && cached.expiresAt > now()) {
      return res.set('X-Cache', 'HIT').type('json').send(cached.body);
    }
    entries.delete(key);
    res.set('X-Cache', 'MISS');
    const pending = { resource, valid: true };
    pendingReads.add(pending);
    res.once?.('close', () => {
      pending.valid = false;
      pendingReads.delete(pending);
    });
    const json = res.json.bind(res);
    res.json = (body) => {
      store(key, resource, body, res, pending);
      return json(body);
    };
    next();
  }

  return { read, clear, invalidateChange: (change) => invalidate(resourcesForChange(change)) };
}

export const responseCache = createResponseCache({ ttlMs: env.cacheTtlMs });
changes.subscribe((change) => responseCache.invalidateChange(change));
