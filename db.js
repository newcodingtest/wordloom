export const stores = [
  "words",
  "progress",
  "quizAttempts",
  "meta",
  "studyEvents",
];
export function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("wordloom-toefl-v1", 2);
    r.onupgradeneeded = () => {
      for (const name of stores)
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, {
            keyPath: name === "meta" ? "key" : "id",
          });
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error("다른 Wordloom 탭을 닫고 다시 시도하세요."));
  });
}
export function all(db, store) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store),
      r = t.objectStore(store).getAll();
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
  });
}
export function write(db, changes, clear = [], deletes = {}) {
  return new Promise((resolve, reject) => {
    const names = [
        ...new Set([
          ...Object.keys(changes),
          ...clear,
          ...Object.keys(deletes),
        ]),
      ],
      t = db.transaction(names, "readwrite");
    try {
      for (const n of clear) t.objectStore(n).clear();
      for (const [n, ids] of Object.entries(deletes))
        for (const id of ids) t.objectStore(n).delete(id);
      for (const [n, rows] of Object.entries(changes))
        for (const row of rows) t.objectStore(n).put(row);
    } catch (e) {
      t.abort();
      reject(e);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || Error("저장 취소"));
  });
}
export function recordSeen(db, id) {
  return new Promise((resolve, reject) => {
    const t = db.transaction("progress", "readwrite"),
      s = t.objectStore("progress"),
      r = s.get(id);
    r.onsuccess = () => {
      const p = { id, ...r.result };
      p.seenCount = (p.seenCount || 0) + 1;
      s.put(p);
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
