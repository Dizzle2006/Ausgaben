/* global React */
// ────────────────────────────────────────────────────────────────────────
// scanner-patches.jsx
// Erweiterungen für den Beleg-Scanner — werden global registriert, damit
// scanner.jsx unverändert bleiben kann.
//
// Liefert auf window:
//   • detectDuplicate(candidate, existing)  → { isDuplicate, match }
//   • AutoKat.learn(haendler, steuerkat)
//   • AutoKat.predict(haendler)             → "werbungskosten" | … | null
// ────────────────────────────────────────────────────────────────────────

// ── Levenshtein-Distanz (für Fuzzy-Händlervergleich) ────────────────────
function _levenshtein(a, b) {
  a = (a || "").toLowerCase().trim();
  b = (b || "").toLowerCase().trim();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0
    )
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

// Prüft ob zwei Händlernamen "gleich genug" sind
function _nameMatch(a, b) {
  a = (a || "").toLowerCase().trim();
  b = (b || "").toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return _levenshtein(a, b) <= 3; // max. 3 Zeichenfehler
}

/**
 * Duplikat-Erkennung.
 * Gibt { isDuplicate: boolean, match: receipt | null } zurück.
 * Kriterien: gleicher Betrag (Cent) + gleiches Datum + ähnlicher Händler
 */
function detectDuplicate(candidate, existing) {
  if (!Array.isArray(existing) || !existing.length)
    return { isDuplicate: false, match: null };

  const cAmt  = Math.round((Number(candidate.gesamtbetrag) || 0) * 100);
  const cDate = candidate.datum || "";

  for (const r of existing) {
    const rAmt  = Math.round((Number(r.gesamtbetrag) || 0) * 100);
    const rDate = r.datum || "";
    if (cAmt > 0 && cAmt === rAmt && cDate && cDate === rDate) {
      if (_nameMatch(candidate.haendler, r.haendler))
        return { isDuplicate: true, match: r };
    }
  }
  return { isDuplicate: false, match: null };
}

// ── Auto-Kategorisierung (lernt Händler→Steuerkat-Paare) ────────────────
const AUTOKAT_KEY = "ausgaben-autokat-v1";

const AutoKat = (() => {
  // Händlernamen normieren: lowercase, Sonderzeichen entfernen
  function normalize(s) {
    return (s || "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9äöüß\s]/g, "")
      .replace(/\s+/g, " ");
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(AUTOKAT_KEY) || "{}"); }
    catch { return {}; }
  }

  function save(map) {
    try { localStorage.setItem(AUTOKAT_KEY, JSON.stringify(map)); }
    catch {}
  }

  // Lernschritt: Händler + Kategorie mit Häufigkeit tracken
  function learn(haendler, steuerkat) {
    if (!haendler || !steuerkat) return;
    const map = load();
    const key = normalize(haendler);
    if (!key) return;
    const entry = map[key] || {};
    entry[steuerkat] = (entry[steuerkat] || 0) + 1;
    map[key] = entry;
    save(map);
  }

  function _winner(counts) {
    return Object.entries(counts || {})
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  // Vorhersage: häufigste gespeicherte Kategorie für diesen Händler
  function predict(haendler) {
    if (!haendler) return null;
    const map = load();
    const key = normalize(haendler);
    if (!key) return null;

    // 1. Exakter Treffer
    if (map[key]) return _winner(map[key]);

    // 2. Fuzzy: gespeicherter Key ist Substring des neuen (oder umgekehrt)
    for (const k of Object.keys(map))
      if (k.length >= 3 && (key.includes(k) || k.includes(key)))
        return _winner(map[k]);

    return null;
  }

  return { learn, predict };
})();

(function _secureExport() {
  const _defs = { detectDuplicate, AutoKat };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
