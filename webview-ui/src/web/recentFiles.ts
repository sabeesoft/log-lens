/**
 * "Recent files" for the web app — the browser equivalent of VS Code's Recent
 * list. It stores File System Access handles in IndexedDB so a file can be
 * reopened with one click (Chromium). Handles can't be persisted in Firefox /
 * Safari, so there Recent simply stays empty. Nothing here touches the network;
 * IndexedDB is local to this origin on this device.
 */

export interface RecentEntry {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  openedAt: number;
}

const DB_NAME = 'log-lens';
const STORE = 'recent-handles';
const MAX_RECENTS = 8;

function supported(): boolean {
  return typeof indexedDB !== 'undefined' && typeof FileSystemFileHandle !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Most-recent-first list of stored handles. Returns [] when unsupported. */
export async function getRecents(): Promise<RecentEntry[]> {
  if (!supported()) return [];
  try {
    const all = (await tx<RecentEntry[]>('readonly', (s) => s.getAll())) ?? [];
    return all.sort((a, b) => b.openedAt - a.openedAt);
  } catch {
    return [];
  }
}

/** Remember a handle (dedup by name; trims to MAX_RECENTS). No-op when unsupported. */
export async function addRecent(handle: FileSystemFileHandle): Promise<void> {
  if (!supported()) return;
  try {
    const existing = await getRecents();
    const sameName = existing.filter((e) => e.name !== handle.name);
    await tx('readwrite', (s) => {
      // Drop any prior entry for the same file name, then store the fresh one.
      existing
        .filter((e) => e.name === handle.name)
        .forEach((e) => s.delete(e.id));
      return s.put({
        id: crypto.randomUUID(),
        name: handle.name,
        handle,
        openedAt: Date.now(),
      } satisfies RecentEntry);
    });
    // Trim overflow (oldest first).
    const overflow = sameName.slice(MAX_RECENTS - 1);
    if (overflow.length) {
      await tx('readwrite', (s) => {
        overflow.forEach((e) => s.delete(e.id));
        return s.count();
      });
    }
  } catch {
    // Best-effort; recents are a convenience, never critical.
  }
}

export async function removeRecent(id: string): Promise<void> {
  if (!supported()) return;
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

/**
 * Re-read a recent file. Re-requests read permission if the browser dropped it;
 * returns null if permission is denied or the file is gone (e.g. moved/deleted).
 */
export async function reopenRecent(entry: RecentEntry): Promise<File | null> {
  const handle = entry.handle as FileSystemFileHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  try {
    const query = (await handle.queryPermission?.({ mode: 'read' })) ?? 'granted';
    if (query !== 'granted') {
      const req = (await handle.requestPermission?.({ mode: 'read' })) ?? 'denied';
      if (req !== 'granted') return null;
    }
    return await handle.getFile();
  } catch {
    return null;
  }
}
