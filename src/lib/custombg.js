// Your own background picture or GIF, kept in this browser profile's
// IndexedDB (too big for localStorage). Only ever on your own PC.
const DB = "moony-bg", STORE = "bg", KEY = "current";

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const loadBg = () => tx("readonly", (s) => s.get(KEY)).catch(() => null);
export const saveBg = (blob) => tx("readwrite", (s) => s.put(blob, KEY));
export const clearBg = () => tx("readwrite", (s) => s.delete(KEY));

let listeners = new Set();
export const onBgChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emitBgChange = () => listeners.forEach((fn) => fn());
