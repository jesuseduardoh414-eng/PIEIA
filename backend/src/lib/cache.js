// Caché en memoria con TTL para datos semi-estáticos (normativa, tipologías, catálogo).
// Cada entrada: { value, expiresAt }. Las claves son strings arbitrarios.

const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { store.delete(key); return undefined; }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key) { store.delete(key); }

export function cacheDeletePrefix(prefix) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
