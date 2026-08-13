// Storage for recordings on the user's own device.
//
// A long session is kept as several audio files rather than one, because the
// server will not accept a single upload above 4.5 MB. Each segment is a
// complete, independently decodable file — a WebM stream cannot simply be cut
// into pieces after recording, since only the first chunk carries the headers.
//
// Layout in IndexedDB:
//   "<base>__count"  → number of segments
//   "<base>__0"      → first segment blob
//   "<base>__1"      → second segment blob, and so on
//
// Recordings made before segmentation existed are stored at "<base>" alone, and
// are still read correctly.

const DB_NAME = 'EvaluateDB'
const STORE = 'recordings'

export function sessionKey(date: string, topic: string) {
  return `session_${date}_${topic}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function put(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE], 'readwrite')
        tx.objectStore(STORE).put(value, key)
        // Resolve on completion, not on put(), so a reader cannot run before
        // the write has actually landed.
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
  )
}

function get<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([STORE], 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve((req.result as T) ?? null)
        req.onerror = () => reject(req.error)
      })
  )
}

export function saveSegment(base: string, index: number, blob: Blob) {
  return put(`${base}__${index}`, blob)
}

export function saveSegmentCount(base: string, count: number) {
  return put(`${base}__count`, count)
}

/** All segments for a session, in order. Empty if nothing was recorded. */
export async function loadSegments(base: string): Promise<Blob[]> {
  const count = await get<number>(`${base}__count`)

  if (typeof count === 'number' && count > 0) {
    const segments: Blob[] = []
    for (let i = 0; i < count; i++) {
      const blob = await get<Blob>(`${base}__${i}`)
      if (blob) segments.push(blob)
    }
    return segments
  }

  // Recording made before segmentation was added.
  const legacy = await get<Blob>(base)
  return legacy ? [legacy] : []
}

export async function totalSize(base: string): Promise<number> {
  const segments = await loadSegments(base)
  return segments.reduce((sum, b) => sum + b.size, 0)
}
