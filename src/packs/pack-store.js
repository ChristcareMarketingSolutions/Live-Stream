import { validateManifest, decodedBytes } from './pack-manifest.js';

export const PACK_CACHE = 'stagecraft-packs-v1';
const CONCURRENCY = 6;

/**
 * Downloads, caches (Cache API, ADR-0005) and decodes instrument packs.
 * Decoded buffers are shared by every instrument instance using the pack.
 *
 * @param {{ bus: import('../core/event-bus.js').EventBus, baseUrl: string }} deps
 */
export function createPackStore({ bus, baseUrl }) {
  /** @type {Map<string, any>} */
  const packs = new Map();

  const urlFor = (id, file) => `${baseUrl}packs/${id}/${file}`;

  function get(id) {
    if (!packs.has(id)) {
      packs.set(id, {
        id,
        manifest: null,
        buffers: new Map(),
        loaded: false,
        loading: null,
        progress: 0,
        memoryBytes: 0,
        error: null,
      });
    }
    return packs.get(id);
  }

  async function fetchCached(url) {
    const cache = 'caches' in globalThis ? await caches.open(PACK_CACHE) : null;
    if (cache) {
      const hit = await cache.match(url);
      if (hit) return hit;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    if (cache) await cache.put(url, res.clone());
    return res;
  }

  /**
   * Ensure the pack is downloaded and decoded for `ctx`. Safe to call repeatedly.
   * @param {string} id
   * @param {BaseAudioContext} ctx
   */
  function load(id, ctx) {
    const pack = get(id);
    if (pack.loaded) return Promise.resolve(pack);
    if (pack.loading) return pack.loading;
    pack.error = null;
    pack.loading = (async () => {
      try {
        const manifestRes = await fetchCached(urlFor(id, 'manifest.json'));
        const result = validateManifest(await manifestRes.json());
        if (!result.ok) throw new Error(`Invalid pack manifest: ${result.errors.join('; ')}`);
        pack.manifest = result.manifest;
        const files = [...new Set(pack.manifest.regions.map((r) => r.file))];
        let done = 0;
        const queue = [...files];
        const worker = async () => {
          while (queue.length) {
            const file = queue.shift();
            const res = await fetchCached(urlFor(id, file));
            const data = await res.arrayBuffer();
            const buffer = await ctx.decodeAudioData(data);
            pack.buffers.set(file, buffer);
            pack.memoryBytes += decodedBytes(buffer);
            done++;
            pack.progress = done / files.length;
            bus.emit('pack:progress', { id, progress: pack.progress });
          }
        };
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        pack.loaded = true;
        bus.emit('pack:loaded', { id, memoryBytes: pack.memoryBytes });
        return pack;
      } catch (err) {
        pack.error = err.message;
        pack.buffers.clear();
        pack.memoryBytes = 0;
        bus.emit('pack:error', { id, message: err.message });
        bus.emit('error', {
          code: 'pack-load-failed',
          message: `Could not load instrument "${id}". Check your connection and try again.`,
          detail: err,
        });
        throw err;
      } finally {
        pack.loading = null;
      }
    })();
    return pack.loading;
  }

  /** Is the pack stored for offline use? */
  async function isInstalled(id) {
    if (!('caches' in globalThis)) return false;
    const cache = await caches.open(PACK_CACHE);
    return !!(await cache.match(urlFor(id, 'manifest.json')));
  }

  /** Remove the pack from memory and from the offline cache. */
  async function remove(id) {
    const pack = get(id);
    pack.buffers.clear();
    pack.loaded = false;
    pack.memoryBytes = 0;
    pack.progress = 0;
    if ('caches' in globalThis) {
      const cache = await caches.open(PACK_CACHE);
      for (const req of await cache.keys()) {
        if (req.url.includes(`/packs/${id}/`)) await cache.delete(req);
      }
    }
    bus.emit('pack:removed', { id });
  }

  return {
    get,
    load,
    isInstalled,
    remove,
    totalMemory: () => [...packs.values()].reduce((s, p) => s + p.memoryBytes, 0),
  };
}
