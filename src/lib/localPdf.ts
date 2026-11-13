// PDFs opened from your own device, kept in this browser (IndexedDB) under
// the deck's link: nothing is uploaded and no Google permission is needed.
// Like prueba-1. If storage is blocked, it simply isn't remembered.
const DB = "synaptic-pdfs";
const STORE = "pdfs";

function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const d = await db();
    return await new Promise<T>((ok, fail) => {
      const req = fn(d.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  } catch {
    return null;
  }
}

export const getLocalPdf = (key: string) => run<Blob | undefined>("readonly", (s) => s.get(key)).then((b) => b ?? null);
export const saveLocalPdf = (key: string, file: Blob) => run("readwrite", (s) => s.put(file, key));
export const deleteLocalPdf = (key: string) => run("readwrite", (s) => s.delete(key));
