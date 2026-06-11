/* global React */
//
// ===================== IndexedDB Layer =====================
//
// Speichert Beleg-Bilder (Data-URLs, ggf. mehrere MB pro Bild) außerhalb
// von localStorage. localStorage behält weiterhin die kleinen Metadaten
// (Händler, Betrag, Datum, MwSt., Kategorie). Bilder werden über
// receiptId aus IDB nachgeladen.
//
// Public API (Promise-basiert):
//   await idbPutImage(id, dataUrl, mediaType)
//   await idbGetImage(id)            -> { dataUrl, mediaType } | null
//   await idbDeleteImage(id)
//   await idbHasImage(id)            -> bool
//   await idbAllImages()             -> Map<id, {dataUrl, mediaType}>
//   await idbClearImages()
//
// React-Hook:
//   const img = useReceiptImage(id)  -> { dataUrl, mediaType } | null | undefined
//                                       (undefined = lädt noch, null = nicht vorhanden)
//

const IDB_NAME = "ausgaben-trocken";
const IDB_VERSION = 1;
const STORE_IMAGES = "receipt-images";

let _dbPromise = null;

function _openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nicht verfügbar."));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { _dbPromise = null; reject(req.error || new Error("IDB open failed")); };
    req.onblocked = () => { _dbPromise = null; reject(new Error("IDB blocked")); };
  });
  return _dbPromise;
}

function _tx(mode) {
  return _openDb().then((db) => {
    const tx = db.transaction(STORE_IMAGES, mode);
    return tx.objectStore(STORE_IMAGES);
  });
}

async function idbPutImage(id, dataUrl, mediaType) {
  if (!id || !dataUrl) return;
  // Prio-3a: Bild verschlüsseln wenn PIN-Schlüssel aktiv
  let encDataUrl = dataUrl;
  let imgEnc = false;
  if (typeof window.secureImageEncrypt === "function") {
    try {
      const enc = await window.secureImageEncrypt(dataUrl);
      if (enc !== dataUrl) { encDataUrl = enc; imgEnc = true; }
    } catch { /* Fallback: unverschlüsselt */ }
  }
  const store = await _tx("readwrite");
  return new Promise((resolve, reject) => {
    const r = store.put({ id, dataUrl: encDataUrl, mediaType: mediaType || "image/jpeg", savedAt: Date.now(), _enc: imgEnc });
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function idbGetImage(id) {
  if (!id) return null;
  try {
    const store = await _tx("readonly");
    const result = await new Promise((resolve, reject) => {
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
    if (!result) return null;
    // Prio-3a: Bild entschlüsseln wenn nötig
    if (result._enc && typeof window.secureImageDecrypt === "function") {
      try {
        result.dataUrl = await window.secureImageDecrypt(result.dataUrl);
        result._enc = false; // entschlüsselt, Rückgabe sauber
      } catch {
        return null; // Entschlüsselung fehlgeschlagen (z.B. falscher PIN)
      }
    }
    return result;
  } catch {
    return null;
  }
}

async function idbHasImage(id) {
  const v = await idbGetImage(id);
  return !!v;
}

async function idbDeleteImage(id) {
  if (!id) return;
  try {
    const store = await _tx("readwrite");
    await new Promise((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } catch {}
}

async function idbAllImages() {
  try {
    const store = await _tx("readonly");
    const rows = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
    const map = new Map();
    // Prio-3a: Bilder entschlüsseln wenn nötig (z.B. für Export + Größenberechnung)
    for (const row of rows) {
      let dataUrl = row.dataUrl;
      if (row._enc && typeof window.secureImageDecrypt === "function") {
        try { dataUrl = await window.secureImageDecrypt(dataUrl); }
        catch { continue; } // Entschlüsselung fehlgeschlagen → Bild überspringen
      }
      map.set(row.id, { dataUrl, mediaType: row.mediaType });
    }
    return map;
  } catch {
    return new Map();
  }
}

async function idbClearImages() {
  try {
    const store = await _tx("readwrite");
    await new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } catch {}
}

// ===================== React-Integration =====================
//
// Ein einfacher In-Memory-Cache + Pub/Sub, damit mehrere Komponenten
// dasselbe Bild nicht parallel laden und auch über Updates Bescheid bekommen.
//
const _imgCache = new Map();   // id -> { dataUrl, mediaType } | null
const _imgListeners = new Map(); // id -> Set<fn>

function _emit(id) {
  const set = _imgListeners.get(id);
  if (!set) return;
  set.forEach((fn) => {
    try { fn(_imgCache.get(id)); } catch {}
  });
}

async function _ensureLoaded(id) {
  if (_imgCache.has(id)) return _imgCache.get(id);
  const val = await idbGetImage(id);
  _imgCache.set(id, val ? { dataUrl: val.dataUrl, mediaType: val.mediaType } : null);
  _emit(id);
  return _imgCache.get(id);
}

// Cache invalidieren — z. B. nach put/delete
function _invalidate(id, newValue) {
  if (newValue === undefined) _imgCache.delete(id);
  else _imgCache.set(id, newValue);
  _emit(id);
}

// Wrapper: Put + Cache-Update
async function idbPutImageCached(id, dataUrl, mediaType) {
  await idbPutImage(id, dataUrl, mediaType);
  // Cache erhält immer den Klartext (Bild vor Verschlüsselung)
  _invalidate(id, { dataUrl, mediaType: mediaType || "image/jpeg" });
}
async function idbDeleteImageCached(id) {
  await idbDeleteImage(id);
  _invalidate(id, null);
}

// React-Hook für ein Beleg-Bild
function useReceiptImage(id) {
  const [val, setVal] = React.useState(() => (id && _imgCache.has(id) ? _imgCache.get(id) : undefined));

  React.useEffect(() => {
    if (!id) { setVal(null); return; }

    // Subscribe
    let set = _imgListeners.get(id);
    if (!set) { set = new Set(); _imgListeners.set(id, set); }
    const fn = (v) => setVal(v);
    set.add(fn);

    if (_imgCache.has(id)) {
      setVal(_imgCache.get(id));
    } else {
      setVal(undefined);
      _ensureLoaded(id);
    }

    return () => {
      const s = _imgListeners.get(id);
      if (s) { s.delete(fn); if (s.size === 0) _imgListeners.delete(id); }
    };
  }, [id]);

  return val;
}

// ===================== Migration =====================
//
// Belege, die noch ein Inline-Bild im State haben (alte localStorage-Belege),
// werden in IDB verschoben — und das `image`/`imageType` aus dem State entfernt.
// Liefert true zurück, falls sich der State geändert hat.
//
async function migrateInlineImagesToIDB(state, setState) {
  const receipts = state.receipts || [];
  const toMigrate = receipts.filter((r) => r.image);
  if (toMigrate.length === 0) return;

  // FIX #8: try/catch pro Beleg — kein früher Return, Loop läuft durch
  const successIds = new Set();
  for (const r of toMigrate) {
    try {
      await idbPutImageCached(r.id, r.image, r.imageType || "image/jpeg");
      successIds.add(r.id);
    } catch (e) {
      console.warn("IDB migration failed for", r.id, e);
    }
  }

  // FIX #8: Nur erfolgreich migrierte Belege aus dem State entfernen
  if (successIds.size === 0) return;
  setState((s) => ({
    ...s,
    receipts: (s.receipts || []).map((r) => {
      if (!r.image || !successIds.has(r.id)) return r;
      const { image, imageType, ...rest } = r;
      return rest;
    }),
  }));
}

(function _secureExport() {
  const _defs = { idbGetImage, idbHasImage, idbAllImages, idbClearImages, useReceiptImage, migrateInlineImagesToIDB, idbPutImageCached, idbDeleteImageCached };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
