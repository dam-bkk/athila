// Tiny in-memory TTL cache — shields upstream public APIs (OpenSky etc.)
// from per-user request storms once the app is shared.

type Entry = { at: number; data: unknown };
const store = new Map<string, Entry>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.data as T;
  try {
    const data = await loader();
    store.set(key, { at: now, data });
    return data;
  } catch (e) {
    // On failure, serve stale if we have any — resilience over freshness.
    if (hit) return hit.data as T;
    throw e;
  }
}
