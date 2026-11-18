import { dbGet, dbGetAll, dbPut, dbDelete } from './db.js';
import { validateConcert } from '../performance/concert-model.js';

/** Concert persistence (STO-001..005). */
export const concertRepo = {
  async list() {
    const all = await dbGetAll('concerts');
    return all
      .map((c) => ({ id: c.id, name: c.name, updatedAt: c.updatedAt }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  },

  async load(id) {
    const raw = await dbGet('concerts', id);
    if (!raw) return null;
    const result = validateConcert(raw);
    return result.ok ? result.concert : null;
  },

  save(concert) {
    return dbPut('concerts', concert);
  },

  remove(id) {
    return dbDelete('concerts', id);
  },

  getLastOpened() {
    return dbGet('meta', 'lastConcertId');
  },

  setLastOpened(id) {
    return dbPut('meta', id, 'lastConcertId');
  },

  loadSettings() {
    return dbGet('settings', 'app');
  },

  saveSettings(settings) {
    return dbPut('settings', settings, 'app');
  },
};

/** Ask the browser not to evict our data under storage pressure (STO-005). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
