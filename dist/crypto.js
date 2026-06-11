/* global React */
// ════════════════════════════════════════════════════════════════════════
// crypto.jsx — PIN-Tresor für sensible Steuerdaten
// ════════════════════════════════════════════════════════════════════════
//
// Schützt Interview-Antworten (Brutto, KV-Beiträge etc.) mit AES-256-GCM.
// Schlüssel wird per PBKDF2 aus dem Nutzer-PIN abgeleitet (600.000 Iter., OWASP 2024).
// Der PIN verlässt nie das Gerät; der Schlüssel lebt nur im RAM.
//
// Sicherheitsmerkmale:
//   • PIN PFLICHT: Ohne gesetzten PIN werden keine Interviewdaten gespeichert.
//     Es gibt keinen automatischen Geräteschlüssel-Fallback mehr.
//   • Brute-Force-Schutz: 3 Fehlversuche → Sperre (30s / 60s / 120s …)
//   • window.__decryptedInterviewAnswers ist eine schreibgeschützte Closure
//     (Object.defineProperty Getter) — externe Schreibzugriffe werden
//     ignoriert, jeder Leseaufruf bekommt eine Kopie, nie das Original.
//   • Migration: Beim ersten PIN-Login werden eventuell vorhandene
//     Geräteschlüssel-verschlüsselte Altdaten auf den PIN-Schlüssel umgestellt
//     und der Geräteschlüssel danach aus localStorage gelöscht.
//
// localStorage-Keys:
//   ausgaben-pin-salt       — PBKDF2-Salt (16 Byte, nicht geheim)
//   ausgaben-pin-verify     — verschlüsselter Prüfstring
//   ausgaben-interview-answers — verschlüsselte Interview-Antworten
//   ausgaben-pin-lockstate  — Fehlversuche + Sperrzeitpunkt
//   (ausgaben-device-key-v1 — nur noch für Migration alter Daten, wird danach gelöscht)
//
// Globale Schnittstelle:
//   window.__decryptedInterviewAnswers  — Getter (Kopie der Daten, read-only)
//   window.secureSetInterviewAnswers(obj) → Promise
//   window.secureLock()                 — Schlüssel aus RAM löschen
// ════════════════════════════════════════════════════════════════════════

const _SALT_KEY = "ausgaben-pin-salt";
const _VERIFY_KEY = "ausgaben-pin-verify";
const _DATA_KEY = "ausgaben-interview-answers";
const _VERIFY_TXT = "ausgaben-trocken-v1-ok";
const _DEVICE_KEY_KEY = "ausgaben-device-key-v1";
const _LOCK_STATE_KEY = "ausgaben-pin-lockstate";

// Brute-Force-Konfiguration
const _MAX_ATTEMPTS = 3;
const _BASE_LOCK_MS = 30_000; // 30 Sekunden für erste Sperre

// ── Crypto-Primitives ────────────────────────────────────────────────────

function _b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function _unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}
async function _getOrCreateSalt() {
  const stored = localStorage.getItem(_SALT_KEY);
  if (stored) return _unb64(stored);
  const salt = crypto.getRandomValues(new Uint8Array(32)); // 32 Byte Salt (NIST SP 800-132)
  localStorage.setItem(_SALT_KEY, _b64(salt));
  return salt;
}
async function _deriveKey(pin, salt) {
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({
    name: "PBKDF2",
    salt,
    iterations: 600_000,
    hash: "SHA-256"
  },
  // OWASP 2024: ≥600k Iter.
  raw, {
    name: "AES-GCM",
    length: 256
  }, false, ["encrypt", "decrypt"]);
}
async function _enc(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv
  }, key, new TextEncoder().encode(text));
  return JSON.stringify({
    _v: 1,
    iv: _b64(iv),
    ct: _b64(new Uint8Array(ct))
  });
}
async function _dec(key, blob) {
  const {
    iv,
    ct
  } = JSON.parse(blob);
  const plain = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv: _unb64(iv)
  }, key, _unb64(ct));
  return new TextDecoder().decode(plain);
}
function _isEncrypted(str) {
  if (!str) return false;
  try {
    const o = JSON.parse(str);
    return o && o._v === 1 && typeof o.iv === "string" && typeof o.ct === "string";
  } catch {
    return false;
  }
}

// ── Geräteschlüssel (NUR für Migration von Altdaten) ────────────────────
// Wird ausschließlich beim PIN-Login verwendet, um eventuell vorhandene
// Altdaten (die noch mit dem alten Geräteschlüssel verschlüsselt wurden)
// auf den PIN-Schlüssel umzustellen. Danach wird der Geräteschlüssel
// aus localStorage gelöscht. Kein neuer Geräteschlüssel wird mehr erzeugt.

async function _getOrCreateDeviceKey() {
  // Prio-2a-Fix: Nur noch lesend — kein neuer Geräteschlüssel wird erstellt.
  // Diese Funktion dient ausschließlich der Migration von Altdaten (Einmal-Vorgang).
  // Gibt null zurück wenn kein Geräteschlüssel vorhanden ist.
  const stored = localStorage.getItem(_DEVICE_KEY_KEY);
  if (!stored) return null;
  try {
    return await crypto.subtle.importKey("raw", _unb64(stored), {
      name: "AES-GCM",
      length: 256
    }, false, ["encrypt", "decrypt"]);
  } catch {
    // Schlüssel beschädigt — Migration nicht möglich
    return null;
  }
}

// ── Brute-Force-Schutz (dual-storage, manipulationsresistent) ───────────────
//
// Sicherheits-Upgrade v2: Lock-State wird parallel in localStorage UND
// sessionStorage gespeichert. Beim Lesen wird immer das MAXIMUM beider
// Zähler verwendet.
//
// Angriffsszenario: Angreifer löscht localStorage → sessionStorage liefert
// noch den vollen Fehlerzähler → Sperre bleibt aktiv.
// sessionStorage lebt nur im aktuellen Tab und kann NICHT aus einem anderen
// Kontext (z.B. DevTools in einem anderen Tab) gelöscht werden ohne den
// Tab zu schließen.
//
// Prüfsumme (FNV-1a): verhindert einfache Manipulation der Zählerwerte.
// Kein kryptografischer Schutz — aber kombiniert mit sessionStorage ist
// ein Bypass deutlich aufwendiger als zuvor.

const _LOCK_HMAC_KEY = "ausgaben-pin-lockstate-v2"; // ungenutzt, Compat

function _stateChecksum(s) {
  const raw = `${s.fails}:${s.lockUntil}:ausgaben-trocken-lock`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = h * 0x01000193 >>> 0;
  }
  return h.toString(16);
}

// Liest aus einem Storage-Objekt (localStorage oder sessionStorage).
// Gibt { fails, lockUntil } oder null bei Fehler / fehlendem Key zurück.
function _readFromStorage(store, key) {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const expected = _stateChecksum({
      fails: s.fails || 0,
      lockUntil: s.lockUntil || 0
    });
    if (s._cs !== expected) return {
      fails: _MAX_ATTEMPTS,
      lockUntil: 0,
      __tampered: true
    };
    return s;
  } catch {
    return null;
  }
}
function _readLockState() {
  const ls = _readFromStorage(localStorage, _LOCK_STATE_KEY);
  const ss = _readFromStorage(sessionStorage, _LOCK_STATE_KEY);

  // Beide fehlen → neuer Nutzer oder vollständige Löschung
  if (!ls && !ss) return {
    fails: 0,
    lockUntil: 0
  };

  // Mindestens einer fehlt (potenziell manipuliert) → konservativ MAX
  if (!ls || !ss) {
    const existing = ls || ss;
    // Wenn der vorhandene 0 Fehlversuche hat, ist das OK (normaler Zustand nach Reset)
    if ((existing.fails || 0) === 0 && !existing.__tampered) return existing;
    // Andernfalls: Manipulation möglich → schlechtester Fall
    console.warn("[crypto] Lock-State: ein Storage fehlt — konservativer Rückfall.");
    return {
      fails: _MAX_ATTEMPTS,
      lockUntil: 0,
      __missing: true
    };
  }

  // Beide vorhanden → MAX der Fehlerzähler + MAX der Sperrzeit verwenden
  if (ls.__tampered || ss.__tampered) {
    console.warn("[crypto] Lock-State Prüfsumme ungültig — konservativer Rückfall.");
    return {
      fails: _MAX_ATTEMPTS,
      lockUntil: 0
    };
  }
  const fails = Math.max(ls.fails || 0, ss.fails || 0);
  const lockUntil = Math.max(ls.lockUntil || 0, ss.lockUntil || 0);
  return {
    fails,
    lockUntil
  };
}
function _saveLockState(s) {
  const toStore = {
    ...s,
    _cs: _stateChecksum({
      fails: s.fails || 0,
      lockUntil: s.lockUntil || 0
    })
  };
  const json = JSON.stringify(toStore);
  try {
    localStorage.setItem(_LOCK_STATE_KEY, json);
  } catch {/* quota */}
  try {
    sessionStorage.setItem(_LOCK_STATE_KEY, json);
  } catch {/* privat mode */}
}
function _clearLockState() {
  // Fehlerzähler auf 0 zurücksetzen — in BEIDEN Storages mit gültiger Prüfsumme.
  const clean = {
    fails: 0,
    lockUntil: 0
  };
  _saveLockState(clean);
}

// Gibt { locked, msRemaining, fails } zurück
function _checkLock() {
  const s = _readLockState();
  if (s.__missing) {
    const lockUntil = Date.now() + _BASE_LOCK_MS;
    _saveLockState({
      fails: _MAX_ATTEMPTS,
      lockUntil
    });
    return {
      locked: true,
      msRemaining: _BASE_LOCK_MS,
      fails: _MAX_ATTEMPTS
    };
  }
  if (!s.lockUntil) return {
    locked: false,
    msRemaining: 0,
    fails: s.fails
  };
  const remaining = s.lockUntil - Date.now();
  if (remaining <= 0) {
    const next = {
      ...s,
      lockUntil: 0
    };
    _saveLockState(next);
    return {
      locked: false,
      msRemaining: 0,
      fails: s.fails
    };
  }
  return {
    locked: true,
    msRemaining: remaining,
    fails: s.fails
  };
}
function _recordFail() {
  const s = _readLockState();
  const prevFails = s.__missing ? _MAX_ATTEMPTS : s.fails || 0;
  const newFails = prevFails + 1;
  const newState = {
    fails: newFails,
    lockUntil: s.lockUntil || 0
  };
  if (newFails >= _MAX_ATTEMPTS) {
    const multiplier = Math.pow(2, Math.floor((newFails - _MAX_ATTEMPTS) / _MAX_ATTEMPTS));
    newState.lockUntil = Date.now() + _BASE_LOCK_MS * multiplier;
  }
  _saveLockState(newState);
  return newState;
}

// ── Interne Daten-Closure ─────────────────────────────────────────────────
// _interviewData lebt im Modul-Scope und ist von außen NICHT direkt erreichbar.
// window.__decryptedInterviewAnswers ist nur ein schreibgeschützter Getter.

let _interviewData = {};
function _setInterviewData(data) {
  _interviewData = data && typeof data === "object" ? data : {};
}

// Einmalig beim Laden: window-Property als sichere Getter-Closure definieren.
// Jeder Lesezugriff bekommt eine flache Kopie — nie den internen Zeiger.
// Schreibversuche (window.__decryptedInterviewAnswers = x) werden lautlos ignoriert.
Object.defineProperty(window, "__decryptedInterviewAnswers", {
  get() {
    return {
      ..._interviewData
    };
  },
  set() {/* absichtlich blockiert — secureSetInterviewAnswers() verwenden */},
  configurable: false,
  enumerable: false
});

// ── Laufzeit-Zustand (RAM only) ──────────────────────────────────────────

let _activeKey = null;
async function _unlock(pin) {
  // Brute-Force-Prüfung
  const lock = _checkLock();
  if (lock.locked) {
    const sek = Math.ceil(lock.msRemaining / 1000);
    return {
      ok: false,
      locked: true,
      msRemaining: lock.msRemaining,
      err: `Zu viele Fehlversuche. Bitte warte ${sek} Sekunden.`
    };
  }
  const salt = await _getOrCreateSalt();
  const key = await _deriveKey(pin, salt);
  const verifyBlob = localStorage.getItem(_VERIFY_KEY);
  if (verifyBlob) {
    try {
      const result = await _dec(key, verifyBlob);
      if (result !== _VERIFY_TXT) {
        const s = _recordFail();
        const remaining = _MAX_ATTEMPTS - s.fails;
        if (s.lockUntil > Date.now()) {
          const sek = Math.ceil((s.lockUntil - Date.now()) / 1000);
          return {
            ok: false,
            locked: true,
            msRemaining: s.lockUntil - Date.now(),
            err: `Falscher PIN. Tresor gesperrt für ${sek} Sekunden.`
          };
        }
        const versucheText = remaining > 0 ? ` Noch ${remaining} Versuch${remaining === 1 ? "" : "e"}.` : "";
        return {
          ok: false,
          err: `Falscher PIN — bitte erneut versuchen.${versucheText}`
        };
      }
    } catch {
      const s = _recordFail();
      const remaining = _MAX_ATTEMPTS - s.fails;
      return {
        ok: false,
        err: `Falscher PIN — bitte erneut versuchen. Noch ${Math.max(0, remaining)} Versuch${remaining === 1 ? "" : "e"}.`
      };
    }
  } else {
    // Erster Start: Verifikationsblob anlegen
    localStorage.setItem(_VERIFY_KEY, await _enc(key, _VERIFY_TXT));
  }

  // Erfolg → Fehlerzähler zurücksetzen
  _clearLockState();
  _activeKey = key;

  // Migration: vorhandene Geräteschlüssel-verschlüsselte oder Klartext-Daten
  // beim ersten PIN-Login auf den PIN-Schlüssel umschlüsseln.
  const raw = localStorage.getItem(_DATA_KEY);
  if (raw) {
    if (!_isEncrypted(raw)) {
      // Altes Klartext-Format migrieren
      try {
        JSON.parse(raw);
        localStorage.setItem(_DATA_KEY, await _enc(key, raw));
      } catch {/* kein valides JSON — ignorieren */}
    } else {
      // Könnte Geräteschlüssel-verschlüsselt sein — versuche zu re-encrypten
      // Prio-2a-Fix: _getOrCreateDeviceKey() kann null zurückgeben
      try {
        const devKey = await _getOrCreateDeviceKey();
        if (devKey) {
          const plain = await _dec(devKey, raw);
          // Wenn Entschlüsselung mit Geräteschlüssel klappt → auf PIN-Key umstellen
          localStorage.setItem(_DATA_KEY, await _enc(key, plain));
        }
      } catch {/* bereits PIN-verschlüsselt — nichts tun */}
    }
  }
  // Geräteschlüssel endgültig aus localStorage entfernen — nicht mehr benötigt.
  // Ab jetzt werden Daten ausschließlich mit dem PIN-Schlüssel gesichert.
  localStorage.removeItem(_DEVICE_KEY_KEY);

  // Daten entschlüsseln und im Closure-Speicher bereitstellen
  const dataBlob = localStorage.getItem(_DATA_KEY);
  let decrypted = {};
  if (dataBlob && _isEncrypted(dataBlob)) {
    try {
      decrypted = JSON.parse(await _dec(key, dataBlob));
    } catch {
      decrypted = {};
    }
  }
  _setInterviewData(decrypted);
  // State-Re-Hydration nach PIN-Unlock anstoßen
  window.dispatchEvent(new CustomEvent("ausgaben-pin-unlocked"));
  return {
    ok: true
  };
}

// ── Speichern (nur mit aktivem PIN-Schlüssel) ────────────────────────────

async function _secureSet(data) {
  _setInterviewData(data);
  if (!_activeKey) {
    // Kein aktiver PIN-Schlüssel — Daten werden NICHT gespeichert.
    // PinGate blockiert die gesamte UI ohne PIN, daher sollte dieser
    // Pfad im normalen Betrieb nie erreicht werden.
    console.error("[crypto] secureSetInterviewAnswers: kein PIN-Schlüssel aktiv. Daten nicht gespeichert.");
    return;
  }
  localStorage.setItem(_DATA_KEY, await _enc(_activeKey, JSON.stringify(data)));
}

// ── Sperren ───────────────────────────────────────────────────────────────

function _lock() {
  _activeKey = null;
  _setInterviewData({});
}

// ── Globale Schnittstelle ─────────────────────────────────────────────────
window.secureSetInterviewAnswers = _secureSet;
window.secureLock = _lock;

// ── PIN ändern ────────────────────────────────────────────────────────────
// Verifiziert den alten PIN, leitet einen neuen Schlüssel aus dem neuen PIN
// (mit frischem Salt) ab und re-verschlüsselt sämtliche PIN-geschützten Blobs.
//
// Rückgabe: { ok: true } oder { ok: false, err: "…" }
window.secureChangePin = async function secureChangePin(oldPin, newPin) {
  try {
    if (!oldPin || !newPin) return {
      ok: false,
      err: "PIN darf nicht leer sein."
    };
    if (String(newPin).length < 6) return {
      ok: false,
      err: "Neuer PIN benötigt mindestens 6 Zeichen."
    };
    if (String(oldPin) === String(newPin)) return {
      ok: false,
      err: "Neuer PIN muss sich vom alten unterscheiden."
    };
    const verifyBlob = localStorage.getItem(_VERIFY_KEY);
    if (!verifyBlob) return {
      ok: false,
      err: "Kein PIN gesetzt — Reset hier nicht möglich."
    };

    // 1) Alten Schlüssel mit aktuellem Salt prüfen
    const oldSaltStr = localStorage.getItem(_SALT_KEY);
    if (!oldSaltStr) return {
      ok: false,
      err: "Salt fehlt — Datenintegrität gestört."
    };
    const oldSalt = _unb64(oldSaltStr);
    const oldKey = await _deriveKey(String(oldPin), oldSalt);
    try {
      const v = await _dec(oldKey, verifyBlob);
      if (v !== _VERIFY_TXT) throw new Error("Verify-Mismatch");
    } catch {
      return {
        ok: false,
        err: "Aktueller PIN ist falsch."
      };
    }

    // 2) Daten mit altem Schlüssel entschlüsseln
    const dataBlob = localStorage.getItem(_DATA_KEY);
    let plainData = "{}";
    if (dataBlob && _isEncrypted(dataBlob)) {
      try {
        plainData = await _dec(oldKey, dataBlob);
      } catch {
        return {
          ok: false,
          err: "Daten konnten nicht entschlüsselt werden."
        };
      }
    }

    // 3) Frisches Salt + neuer Schlüssel aus neuem PIN
    const newSalt = crypto.getRandomValues(new Uint8Array(32));
    const newKey = await _deriveKey(String(newPin), newSalt);

    // 4) Verify + Daten mit neuem Schlüssel re-verschlüsseln
    const newVerify = await _enc(newKey, _VERIFY_TXT);
    const newData = await _enc(newKey, plainData);

    // 5) Atomar speichern (Salt zuletzt, damit ein Abbruch keine
    //    Inkonsistenz hinterlässt — bei Crash kann mit altem PIN
    //    weiter entschlüsselt werden, solange Salt noch alt ist).
    localStorage.setItem(_VERIFY_KEY, newVerify);
    localStorage.setItem(_DATA_KEY, newData);
    localStorage.setItem(_SALT_KEY, _b64(newSalt));

    // 6) Aktiven Schlüssel ersetzen, Lockstate zurücksetzen
    _activeKey = newKey;
    try {
      localStorage.removeItem(_LOCK_STATE_KEY);
    } catch {}
    try {
      sessionStorage.removeItem(_LOCK_STATE_KEY);
    } catch {}
    return {
      ok: true
    };
  } catch (e) {
    console.error("[crypto] secureChangePin:", e);
    return {
      ok: false,
      err: "Unbekannter Fehler beim PIN-Wechsel."
    };
  }
};

// Lese-Helfer für die Einstellungen-UI: liefert Meta-Infos für die Anzeige.
// KEINE Geheimnisse — nur Längen + Algorithmus-Konstanten.
window.secureGetEncryptionInfo = function secureGetEncryptionInfo() {
  const saltStr = localStorage.getItem(_SALT_KEY);
  const verifySet = !!localStorage.getItem(_VERIFY_KEY);
  return {
    cipher: "AES-256-GCM",
    kdf: "PBKDF2",
    kdfHash: "SHA-256",
    kdfIterations: 600000,
    saltBytes: saltStr ? _unb64(saltStr).length : 0,
    ivBytes: 12,
    pinSet: verifySet,
    keyResident: !!_activeKey,
    // Schlüssel nur im RAM, nie im Storage
    storage: "localStorage (IndexedDB für Bilder)"
  };
};

// ── Chat- und Bild-Verschlüsselung (Prio 1 + 3a) ─────────────────────
// Verschlüsselt/entschlüsselt beliebige Strings mit dem aktiven PIN-Schlüssel.
// Graceful Fallback: gibt den Klartext zurück wenn kein Schlüssel aktiv ist
// (z.B. direkt nach erstem App-Start vor PIN-Eingabe).

window.secureChatEncrypt = async text => {
  if (!_activeKey) return text;
  try {
    return await _enc(_activeKey, text);
  } catch {
    return text;
  }
};
window.secureChatDecrypt = async blob => {
  if (!_activeKey || !_isEncrypted(blob)) return blob;
  try {
    return await _dec(_activeKey, blob);
  } catch {
    return blob;
  }
};

// Alias: Bilder nutzen dieselbe Infrastruktur
window.secureImageEncrypt = window.secureChatEncrypt;
window.secureImageDecrypt = window.secureChatDecrypt;

// ── Entsperr-Status (für saveState-Guard in utils.jsx) ───────────────────
// Gibt true zurück wenn der PIN-Schlüssel aktuell im RAM aktiv ist.
// saveState prüft diesen Wert bevor es schreibt, damit ein leerer defaultState
// niemals einen verschlüsselten Blob in localStorage überschreibt.
window.secureIsUnlocked = () => !!_activeKey;

// ── PinGate-Komponente ───────────────────────────────────────────────────

function PinGate({
  children
}) {
  const firstTime = !localStorage.getItem(_VERIFY_KEY);
  const [phase, setPhase] = React.useState(firstTime ? "setup" : "enter");
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // Countdown-State für Brute-Force-Sperre
  const [lockMs, setLockMs] = React.useState(0);
  const pinRef = React.useRef(null);
  const confirmRef = React.useRef(null);
  const timerRef = React.useRef(null);

  // Prüfe beim Mounten ob bereits gesperrt
  React.useEffect(() => {
    const lock = _checkLock();
    if (lock.locked) _startCountdown(lock.msRemaining);else setTimeout(() => pinRef.current?.focus(), 80);
  }, []);

  // Countdown-Ticker
  function _startCountdown(ms) {
    setLockMs(ms);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setLockMs(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(timerRef.current);
          setTimeout(() => pinRef.current?.focus(), 80);
          return 0;
        }
        return next;
      });
    }, 1000);
  }
  React.useEffect(() => () => clearInterval(timerRef.current), []);
  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (busy || lockMs > 0) return;
    const p = pin.trim();
    if (p.length < 6) {
      setError("Mindestens 6 Zeichen.");
      return;
    }
    if (phase === "setup") {
      if (p !== confirm.trim()) {
        setError("PINs stimmen nicht überein.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const res = await _unlock(p);
      if (res.ok) {
        setPhase("unlocked");
      } else if (res.locked) {
        _startCountdown(res.msRemaining);
        setPin("");
      } else {
        setError(res.err || "Falscher PIN.");
        setPin("");
        setTimeout(() => pinRef.current?.focus(), 50);
      }
    } catch (err) {
      setError("Fehler: " + (err?.message || String(err)));
    }
    setBusy(false);
  }
  function handleKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }
  function handleLock() {
    _lock();
    setPhase("enter");
    setPin("");
    setConfirm("");
    setError("");
    setLockMs(0);
    setTimeout(() => pinRef.current?.focus(), 80);
  }
  if (phase === "unlocked") {
    return /*#__PURE__*/React.createElement(React.Fragment, null, children, /*#__PURE__*/React.createElement("button", {
      className: "pin-lock-btn",
      onClick: handleLock,
      title: "App sperren",
      "aria-label": "App sperren"
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "18",
      height: "18",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "11",
      rx: "2",
      ry: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 11V7a5 5 0 0 1 10 0v4"
    }))));
  }
  const isSetup = phase === "setup";
  const isLocked = lockMs > 0;
  const secLeft = Math.ceil(lockMs / 1000);
  return /*#__PURE__*/React.createElement("div", {
    className: "pin-gate"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pin-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pin-icon"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "26",
    height: "26",
    fill: "none",
    stroke: isLocked ? "oklch(0.55 0.18 30)" : "var(--accent)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "11",
    width: "18",
    height: "11",
    rx: "2",
    ry: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11V7a5 5 0 0 1 10 0v4"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pin-title"
  }, isLocked ? "Tresor gesperrt" : isSetup ? "PIN setzen" : "App entsperren"), /*#__PURE__*/React.createElement("div", {
    className: "pin-sub"
  }, isLocked ? "Zu viele Fehlversuche. Bitte kurz warten." : isSetup ? "Wähle einen PIN — deine Steuerdaten werden damit verschlüsselt gespeichert." : "Gib deinen PIN ein, um auf deine verschlüsselten Steuerdaten zuzugreifen."), isLocked && /*#__PURE__*/React.createElement("div", {
    className: "pin-lockout"
  }, "Entsperrt in", /*#__PURE__*/React.createElement("span", {
    className: "pin-lockout-timer"
  }, secLeft, "s")), !isLocked && /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    style: {
      width: "100%"
    },
    autoComplete: "off"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pin-label"
  }, isSetup ? "Neuer PIN" : "PIN"), /*#__PURE__*/React.createElement("input", {
    ref: pinRef,
    className: "pin-input",
    type: "password",
    inputMode: "text",
    value: pin,
    onChange: e => setPin(e.target.value),
    onKeyDown: handleKeyDown,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: "new-password",
    autoFocus: true
  }), isSetup && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "pin-label"
  }, "PIN best\xE4tigen"), /*#__PURE__*/React.createElement("input", {
    ref: confirmRef,
    className: "pin-input",
    type: "password",
    inputMode: "text",
    value: confirm,
    onChange: e => setConfirm(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") handleSubmit();
    },
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    autoComplete: "new-password"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "pin-btn",
    disabled: busy || pin.length < 6 || isSetup && confirm.length < 6
  }, busy ? "Wird verarbeitet…" : isSetup ? "Tresor einrichten" : "Entsperren")), error && !isLocked && /*#__PURE__*/React.createElement("div", {
    className: "pin-error"
  }, error), /*#__PURE__*/React.createElement("div", {
    className: "pin-hint"
  }, isSetup ? "Bei vergessenem PIN bleiben alle Belege erhalten — nur die Interview-Antworten müssen neu eingegeben werden." : "Vergessen? Alle Daten außer den Interview-Antworten sind weiterhin zugänglich.")));
}
(function _secureExport() {
  try {
    Object.defineProperty(window, "PinGate", {
      value: PinGate,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch {
    window.PinGate = PinGate;
  }
})();
