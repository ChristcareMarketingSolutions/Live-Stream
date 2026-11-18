/**
 * Minimal promise wrapper over IndexedDB (STO-001, docs/02 §10).
 * Stores: concerts (keyPath id), meta (key/value), settings (key/value).
 */
const DB_NAME = 'stagecraft';
const DB_VERSION = 1;

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser window.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('concerts'))
        db.createObjectStore('concerts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(
        new Error('Storage is blocked by another STAGECRAFT tab. Close other tabs and reload.'),
      );
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function run(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'));
      }),
  );
}

export const dbGet = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const dbGetAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const dbPut = (store, value, key) =>
  run(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)));
export const dbDelete = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
