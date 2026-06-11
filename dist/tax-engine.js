/* global React, fmtEUR */
// ────────────────────────────────────────────────────────────────────────
// tax-engine.jsx
// Steuer-Berechnungen + UI-Komponenten für die Steuer-Ansicht.
//
// Achtung: vereinfachte Formeln nach BMF-Programmierhinweisen — keine
// Steuerberatung.
//
// ════════════════════════════════════════════════════════════════════════
// REMOTE-CONFIGURATION
// ════════════════════════════════════════════════════════════════════════
// EINZIGE WAHRHEIT für Steuerwerte: tax-config.json im Repo.
//
// Beim App-Start versucht fetchLatestTaxConfig() in dieser Reihenfolge:
//   1. GitHub-Raw    (immer aktuellster Stand, Cache-Bust via ?t=…)
//   2. ./tax-config.json (lokales Repo-File, falls GitHub offline)
//   3. localStorage  (letzter erfolgreicher Fetch)
//   4. INLINE_BOOTSTRAP (1:1-Kopie der Repo-tax-config.json,
//                         nur für allerersten Offline-Start)
//
// Es gibt KEINE eingebackenen "Schatten-Steuersätze". Jeder Wert kommt
// aus dem JSON. INLINE_BOOTSTRAP existiert nur, damit die App nicht
// crasht, falls ein User die PWA das erste Mal ohne Netz öffnet —
// und es ist eine wortwörtliche Kopie der Repo-Datei.
// ────────────────────────────────────────────────────────────────────────

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/Dizzle2006/Ausgaben/main/tax-config.json";
const LOCAL_CONFIG_URL = "./tax-config.json";

// 1:1-Snapshot von tax-config.json. Bei jedem Update der Repo-Datei
// MUSS dieser Block mit-aktualisiert werden — er ist die letzte
// Rettungsleine für den allerersten Offline-Start.
const INLINE_BOOTSTRAP = {
  meta: {
    letzte_aktualisierung: "2026-05-23",
    quellen: ["BMF Grundfreibetrag 2024-2026", "Steueränderungsgesetz 2025", "Finanztip, Steuertipps.de (verifiziert Mai 2026)", "§32a EStG 2026 (Steuerfortentwicklungsgesetz, verifiziert Mai 2026)"]
  },
  grundfreibetrag: {
    "2024": 11784,
    "2025": 12096,
    "2026": 12348
  },
  werbungskostenpauschale: {
    "2024": 1230,
    "2025": 1230,
    "2026": 1230,
    hinweis_2026: "Gewerkschaftsbeiträge ab 2026 immer absetzbar, auch unter Pauschale"
  },
  entfernungspauschale: {
    bis_2025: {
      km_1_bis_20: 0.30,
      ab_km_21: 0.38
    },
    ab_2026: {
      ab_km_1: 0.38,
      hinweis: "Vereinheitlichung ab erstem Kilometer"
    }
  },
  minijob_grenze_monatlich: {
    "2024": 538,
    "2025": 556,
    "2026": 603
  },
  sparerpauschbetrag: {
    single: 1000,
    verheiratet: 2000
  },
  soli_freigrenze_einzelveranlagung: {
    "2024": 18130,
    "2025": 19950,
    "2026": 20350
  },
  kindergeld_monatlich: {
    bis_2025: 255,
    ab_2026: 259
  },
  kinderfreibetrag_gesamt_2026: 9756,
  kapitalertragsteuer_satz: 0.25,
  soli_satz: 0.055,
  homeoffice: {
    pauschale_pro_tag: 6,
    max_tage: 210,
    max_jahresbetrag: 1260
  },
  haushaltsnahe_dienstleistungen: {
    max_ermaessigung: 4000,
    max_aufwendungen: 20000
  },
  handwerkerleistungen: {
    max_ermaessigung: 1200,
    max_arbeitskosten: 6000
  },
  minijob_haushalt: {
    max_ermaessigung: 510
  },
  kirchensteuer_satz: {
    BY: 0.08,
    BW: 0.08,
    default: 0.09
  },
  studenten: {
    erststudium_sonderausgaben_max: 6000,
    laptop_sofortabschreibung_seit: 2021,
    laptop_mindestnutzung_prozent: 10,
    verpflegung_pauschale_8h: 14,
    verpflegung_pauschale_24h: 28,
    verlustvortrag_rueckwirkend_jahre: 7,
    freiwillige_abgabe_rueckwirkend_jahre: 4,
    kindergeld_eltern_altersgrenze: 25,
    kindergeld_einkommensgrenze_student: 15500
  },
  tarifzonen: {
    "2024": {
      zone1_ende: 17005,
      zone2_ende: 66760,
      zone3_ende: 277825,
      k1a: 979.18,
      k1b: 1400,
      k2a: 192.59,
      k2b: 2397,
      k2c: 966.53,
      flat42_abzug: 10379,
      flat45_abzug: 18714
    },
    "2025": {
      zone1_ende: 17443,
      zone2_ende: 68480,
      zone3_ende: 277825,
      k1a: 979.18,
      k1b: 1400,
      k2a: 192.59,
      k2b: 2397,
      k2c: 966.53,
      flat42_abzug: 10602,
      flat45_abzug: 18936
    },
    "2026": {
      zone1_ende: 17799,
      zone2_ende: 69878,
      zone3_ende: 277825,
      k1a: 979.18,
      k1b: 1400,
      k2a: 181.19,
      k2b: 2397,
      k2c: 1025.38,
      flat42_abzug: 10637.32,
      flat45_abzug: 18919.93
    }
  },
  beitragsbemessungsgrenze: {
    "2024": {
      kv_pv_monatlich: 5175,
      rv_monatlich: 7550
    },
    "2025": {
      kv_pv_monatlich: 5512,
      rv_monatlich: 8050
    },
    "2026": {
      kv_pv_monatlich: 5775,
      rv_monatlich: 8400
    }
  },
  gwg_grenze_brutto: 952,
  riester: {
    grundzulage: 175,
    kinderzulage_ab_2008: 300,
    kinderzulage_vor_2008: 185,
    max_sa_abzug: 2100,
    mindestbeitrag_prozent: 0.04,
    mindestbeitrag_absolut: 60
  },
  ruerup: {
    hoechstbetrag: 29344,
    // § 10 Abs.3 EStG: BBG RV West 2026 × 18,6% × 2
    abzugsprozent: 1.0 // JStG 2022: 100 % ab VZ 2023
  },
  steuerklasse_2_entlastungsbetrag: 4008,
  sv_saetze_an: {
    kv: 0.0735,
    rv: 0.093,
    alv: 0.013,
    pv: 0.018,
    pv_kinderlos: 0.023
  }
};

// ────────────────────────────────────────────────────────────────────────
// normalizeTaxConfig(raw)
// Adapter: tax-config.json-Schema → Per-Jahr-Schema, das die Engine
// (calcESt, calcBruttoNetto, calcKapESt, calcWK …) erwartet.
//
// Liefert zusätzlich `__raw` mit der Original-JSON, damit andere
// Komponenten (z.B. Minijob-Grenzen, Studenten-Sonderregeln) direkt
// auf das ursprüngliche Schema zugreifen können.
// ────────────────────────────────────────────────────────────────────────
function normalizeTaxConfig(raw) {
  const r = raw && typeof raw === "object" ? raw : INLINE_BOOTSTRAP;
  const years = Object.keys(r.grundfreibetrag || INLINE_BOOTSTRAP.grundfreibetrag);
  const out = {};
  for (const y of years) {
    const yNum = Number(y);
    const ent = yNum >= 2026 ? {
      km_bis_20: r.entfernungspauschale?.ab_2026?.ab_km_1 ?? 0.38,
      km_ab_21: r.entfernungspauschale?.ab_2026?.ab_km_1 ?? 0.38
    } : {
      km_bis_20: r.entfernungspauschale?.bis_2025?.km_1_bis_20 ?? 0.30,
      km_ab_21: r.entfernungspauschale?.bis_2025?.ab_km_21 ?? 0.38
    };
    // FIX #1: Tarifzonen per Jahr lesen (Fallback: 2025-Werte)
    const tz = r.tarifzonen?.[y] ?? r.tarifzonen?.["2025"] ?? INLINE_BOOTSTRAP.tarifzonen?.["2025"];
    // FIX #3: Beitragsbemessungsgrenze per Jahr lesen (Fallback: 2025-Werte)
    const bbg = r.beitragsbemessungsgrenze?.[y] ?? r.beitragsbemessungsgrenze?.["2025"] ?? INLINE_BOOTSTRAP.beitragsbemessungsgrenze?.["2025"];
    out[y] = {
      grundfreibetrag: r.grundfreibetrag?.[y] ?? INLINE_BOOTSTRAP.grundfreibetrag[y] ?? 0,
      wk_pauschale: r.werbungskostenpauschale?.[y] ?? 1230,
      // nicht in tax-config.json — fester Wert aus § 10c EStG.
      sonderausgaben_pauschale: 36,
      sparerpauschbetrag_single: r.sparerpauschbetrag?.single ?? 1000,
      sparerpauschbetrag_verheiratet: r.sparerpauschbetrag?.verheiratet ?? 2000,
      homeoffice_pro_tag: r.homeoffice?.pauschale_pro_tag ?? 6,
      homeoffice_max_tage: r.homeoffice?.max_tage ?? 210,
      entfernung_km_bis_20: ent.km_bis_20,
      entfernung_km_ab_21: ent.km_ab_21,
      verpflegung_8h: r.studenten?.verpflegung_pauschale_8h ?? 14,
      verpflegung_24h: r.studenten?.verpflegung_pauschale_24h ?? 28,
      kapest_satz: r.kapitalertragsteuer_satz ?? 0.25,
      soli_satz: r.soli_satz ?? 0.055,
      kirchensteuer_satz: r.kirchensteuer_satz || {
        BY: 0.08,
        BW: 0.08,
        default: 0.09
      },
      minijob_grenze: r.minijob_grenze_monatlich?.[y] ?? null,
      // FIX #2: Soli-Freigrenze aus Config; Fallback 18130 (2024-Wert)
      soli_freigrenze: r.soli_freigrenze_einzelveranlagung?.[y] ?? 18130,
      soli_milderung_satz: r.soli_milderung_satz ?? 0.119,
      // FIX #1: Tarifzonen-Grenzen und Progressionskoeffizienten
      zone1_ende: tz?.zone1_ende ?? 17443,
      zone2_ende: tz?.zone2_ende ?? 68480,
      zone3_ende: tz?.zone3_ende ?? 277825,
      k1a: tz?.k1a ?? 979.18,
      k1b: tz?.k1b ?? 1400,
      k2a: tz?.k2a ?? 192.59,
      k2b: tz?.k2b ?? 2397,
      k2c: tz?.k2c ?? 966.53,
      flat42_abzug: tz?.flat42_abzug ?? 10602,
      flat45_abzug: tz?.flat45_abzug ?? 18936,
      // FIX #3: Beitragsbemessungsgrenzen (monatlich)
      bbg_kv_monatlich: bbg?.kv_pv_monatlich ?? 5512,
      bbg_rv_monatlich: bbg?.rv_monatlich ?? 8050,
      // SV-Sätze AN aus Config (§ 226 SGB V, § 157 SGB VI, § 341 SGB III, § 55 SGB XI)
      sv_kv: r.sv_saetze_an?.kv ?? 0.0735,
      sv_rv: r.sv_saetze_an?.rv ?? 0.093,
      sv_alv: r.sv_saetze_an?.alv ?? 0.013,
      sv_pv: r.sv_saetze_an?.pv ?? 0.018,
      sv_pv_kinderlos: r.sv_saetze_an?.pv_kinderlos ?? 0.023,
      // Steuerklasse 2: Entlastungsbetrag (§ 24b EStG)
      sk2_entlastungsbetrag: r.steuerklasse_2_entlastungsbetrag ?? 4008,
      // Riester (§ 10a EStG)
      riester_grundzulage: r.riester?.grundzulage ?? 175,
      riester_kinderzulage_ab_2008: r.riester?.kinderzulage_ab_2008 ?? 300,
      riester_kinderzulage_vor_2008: r.riester?.kinderzulage_vor_2008 ?? 185,
      riester_max_sa_abzug: r.riester?.max_sa_abzug ?? 2100,
      riester_mindestbeitrag_prozent: r.riester?.mindestbeitrag_prozent ?? 0.04,
      riester_mindestbeitrag_absolut: r.riester?.mindestbeitrag_absolut ?? 60,
      // Rürup / Basisrente (§ 10 Abs. 1 Nr. 2 EStG)
      ruerup_hoechstbetrag: r.ruerup?.hoechstbetrag ?? 29344,
      ruerup_abzugsprozent: r.ruerup?.abzugsprozent ?? 1.0
    };
  }

  // Original-JSON immer mitschleppen, damit Sonderregel-Komponenten
  // (Studenten-Pauschalen etc.) das vollständige Schema lesen können.
  // Sicherheit: __raw wird eingefroren — externe Manipulation der Steuerwerte
  // wird damit zur Laufzeit verhindert.
  const frozenRaw = Object.freeze(Object.assign({}, r));
  Object.defineProperty(out, "__raw", {
    value: frozenRaw,
    enumerable: false,
    writable: false,
    // unveränderlich nach Zuweisung
    configurable: false
  });
  return out;
}

// Laufzeit-Variable. Bootstrap aus localStorage (rohes JSON), sonst INLINE.
let STEUER_KONSTANTEN;
let LAST_CONFIG_SOURCE = "inline-bootstrap";
let LAST_CONFIG_DATE = INLINE_BOOTSTRAP.meta?.letzte_aktualisierung ?? "?";
(function bootstrap() {
  try {
    const cached = localStorage.getItem("tax_constants_raw");
    if (cached) {
      const raw = JSON.parse(cached);
      STEUER_KONSTANTEN = normalizeTaxConfig(raw);
      LAST_CONFIG_SOURCE = "localStorage";
      LAST_CONFIG_DATE = raw?.meta?.letzte_aktualisierung ?? "?";
      return;
    }
  } catch {/* fällt durch */}
  STEUER_KONSTANTEN = normalizeTaxConfig(INLINE_BOOTSTRAP);
})();

// ────────────────────────────────────────────────────────────────────────
// fetchLatestTaxConfig
// Holt tax-config.json beim App-Start. Reihenfolge: GitHub-Raw → lokal.
// Persistiert das **rohe** JSON in localStorage und ersetzt die
// normalisierte Laufzeit-Variable. Feuert `tax-config-updated` Event,
// damit React-Komponenten re-rendern können.
// ────────────────────────────────────────────────────────────────────────
async function fetchLatestTaxConfig() {
  const cacheBust = `?t=${Date.now()}`;
  const sources = [{
    name: "GitHub",
    url: GITHUB_RAW_URL + cacheBust
  }, {
    name: "lokal",
    url: LOCAL_CONFIG_URL + cacheBust
  }];
  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        cache: "no-store"
      });
      if (!res.ok) {
        console.warn(`[Steuern] ${src.name} HTTP ${res.status}`);
        continue;
      }
      const raw = await res.json();
      if (!raw || typeof raw !== "object" || !raw.grundfreibetrag) {
        console.warn(`[Steuern] ${src.name} JSON ungültig – übersprungen`);
        continue;
      }
      try {
        localStorage.setItem("tax_constants_raw", JSON.stringify(raw));
      } catch {/* quota voll – egal */}
      STEUER_KONSTANTEN = normalizeTaxConfig(raw);
      LAST_CONFIG_SOURCE = src.name;
      LAST_CONFIG_DATE = raw?.meta?.letzte_aktualisierung ?? "?";
      console.info(`%c[Steuern] Konfiguration aktiv: ${src.name} · Stand ${LAST_CONFIG_DATE}`, "color:#5b8a3a;font-weight:600");
      window.dispatchEvent(new CustomEvent("tax-config-updated", {
        detail: {
          source: src.name,
          date: LAST_CONFIG_DATE,
          raw
        }
      }));
      return;
    } catch (e) {
      console.warn(`[Steuern] ${src.name} fetch fehlgeschlagen:`, e?.message || e);
    }
  }
  console.warn(`[Steuern] Keine Remote-Aktualisierung möglich – nutze ${LAST_CONFIG_SOURCE} (Stand ${LAST_CONFIG_DATE})`);
}
window.fetchLatestTaxConfig = fetchLatestTaxConfig;
function getK(year) {
  const y = String(year);
  // Bei unbekannten Jahren auf das jüngste vorhandene Jahr zurückfallen.
  if (STEUER_KONSTANTEN[y]) return STEUER_KONSTANTEN[y];
  const knownYears = Object.keys(STEUER_KONSTANTEN).filter(k => /^\d{4}$/.test(k)).sort();
  const newest = knownYears[knownYears.length - 1];
  return STEUER_KONSTANTEN[newest] || normalizeTaxConfig(INLINE_BOOTSTRAP)["2026"];
}

// Hook: rendert ein Komponentenstück neu, sobald die Steuer-Config
// per Fetch ersetzt wird. Liefert die aktuellen __raw-Daten zurück.
function useTaxConfig() {
  const [, setN] = React.useState(0);
  React.useEffect(() => {
    const onUpd = () => setN(n => n + 1);
    window.addEventListener("tax-config-updated", onUpd);
    return () => window.removeEventListener("tax-config-updated", onUpd);
  }, []);
  return {
    raw: STEUER_KONSTANTEN.__raw,
    source: LAST_CONFIG_SOURCE,
    date: LAST_CONFIG_DATE
  };
}

// ────────────────────────────────────────────────────────────────────────
// Einkommensteuer nach § 32a EStG (vereinfachte Progressionsformel)
// ────────────────────────────────────────────────────────────────────────
// _calcEStRaw — § 32a EStG ohne Rundung (Basis für exakten Grenzsteuersatz)
function _calcEStRaw(zve, year) {
  const K = getK(year);
  const gf = K.grundfreibetrag;
  zve = Math.max(0, zve);
  if (zve <= gf) return 0;
  if (zve <= K.zone1_ende) {
    const y = (zve - gf) / 10000;
    return (K.k1a * y + K.k1b) * y;
  }
  if (zve <= K.zone2_ende) {
    const y = (zve - K.zone1_ende) / 10000;
    return (K.k2a * y + K.k2b) * y + K.k2c;
  }
  if (zve <= K.zone3_ende) {
    return 0.42 * zve - K.flat42_abzug;
  }
  return 0.45 * zve - K.flat45_abzug;
}
function calcESt(zve, year) {
  // Gerundetes Ergebnis (Anzeige/Abzüge); Tarifformel in _calcEStRaw
  return Math.round(_calcEStRaw(Math.round(Number(zve) || 0), year));
}

// SV-Sätze und SK2-Entlastungsbetrag werden ausschließlich aus dem
// K-Objekt (tax-config.json via normalizeTaxConfig) gelesen.
// Die früheren Konstanten SV={} und SK_FB={} sind entfernt — alle Werte
// kommen aus K.sv_kv / K.sv_rv / … / K.sk2_entlastungsbetrag.

// ────────────────────────────────────────────────────────────────────────
// calcBruttoNetto
// ────────────────────────────────────────────────────────────────────────
function calcBruttoNetto({
  brutto,
  steuerklasse = 1,
  kirchensteuer = false,
  bundesland = "default",
  kinder = false,
  year = 2025
}) {
  const K = getK(year);
  brutto = Number(brutto) || 0;
  steuerklasse = Number(steuerklasse) || 1;

  // SV-Sätze aus Config (kein hardcoded SV-Objekt)
  const pv_satz = kinder ? K.sv_pv : K.sv_pv_kinderlos;
  // FIX #3: BBG-Kappung — SV-Beiträge nur bis zur Beitragsbemessungsgrenze
  const kv_basis = Math.min(brutto, K.bbg_kv_monatlich * 12);
  const rv_basis = Math.min(brutto, K.bbg_rv_monatlich * 12);
  const kv = Math.round(kv_basis * K.sv_kv);
  const rv = Math.round(rv_basis * K.sv_rv);
  const alv = Math.round(rv_basis * K.sv_alv);
  const pv = Math.round(kv_basis * pv_satz);
  const sv = kv + rv + alv + pv;

  // SK2-Entlastungsbetrag (§ 24b EStG) aus Config
  const SK_GF_MAP = {
    1: true,
    2: true,
    3: true,
    4: true,
    5: false,
    6: false
  };
  const sk = {
    gf: SK_GF_MAP[steuerklasse] ?? true,
    extra: steuerklasse === 2 ? K.sk2_entlastungsbetrag : 0
  };
  let zve;
  if (steuerklasse === 6) {
    zve = brutto - sv;
  } else if (steuerklasse === 5) {
    // SK V: WK- und SA-Pauschale werden im Lohnsteuerabzug berücksichtigt,
    // nur der Grundfreibetrag nicht (liegt beim Partner in SK III).
    zve = Math.max(0, brutto - sv - K.wk_pauschale - K.sonderausgaben_pauschale);
  } else {
    zve = brutto - sv - K.wk_pauschale - K.sonderausgaben_pauschale;
    if (sk.gf) zve = Math.max(0, zve - K.grundfreibetrag - sk.extra);
    if (steuerklasse === 3) zve = Math.max(0, zve / 2);
  }
  const est_einfach = calcESt(zve, year);
  const lohnsteuer = steuerklasse === 3 ? Math.round(est_einfach * 2) : est_einfach;

  // FIX #2: Soli-Freigrenze aus Config statt hardcodiertem 18130
  const soli_fg = K.soli_freigrenze ?? 18130;
  // Milderungszone § 4 S. 2 SolzG: oberhalb der Freigrenze max. 11,9 % des
  // übersteigenden Betrags — kein harter Sprung mehr auf volle 5,5 %.
  const soli_mild = K.soli_milderung_satz ?? 0.119;
  const soli = lohnsteuer > soli_fg ? Math.round(Math.min(lohnsteuer * K.soli_satz, (lohnsteuer - soli_fg) * soli_mild)) : 0;
  const kst_satz = K.kirchensteuer_satz[bundesland] || K.kirchensteuer_satz.default;
  const kst = kirchensteuer ? Math.round(lohnsteuer * kst_satz) : 0;
  const abzuege = sv + lohnsteuer + soli + kst;
  return {
    brutto,
    netto: Math.max(0, brutto - abzuege),
    lohnsteuer,
    soli,
    kst,
    kv,
    rv,
    alv,
    pv,
    sv,
    abzuege
  };
}

// ────────────────────────────────────────────────────────────────────────
// calcKapESt — aus investments.trades
// ────────────────────────────────────────────────────────────────────────
// FIX #5: zve als optionaler Parameter für Günstigerprüfung nach §32d Abs. 6 EStG
function calcKapESt({
  trades = [],
  year = "2025",
  verheiratet = false,
  kirchensteuer = false,
  bundesland = "default",
  zve = null
}) {
  const K = getK(year);
  const y = String(year);
  const yearTrades = trades.filter(t => (t.date || "").startsWith(y));

  // FIX #6: Getrennte Verlustverrechnung Aktien/Sonstige (§20 Abs. 6 S. 5 EStG)
  const aktienTrades = yearTrades.filter(t => t.type === "aktien");
  const sonstigeTrades = yearTrades.filter(t => t.type !== "aktien");
  const aktienGewinn = aktienTrades.filter(t => (Number(t.amount) || 0) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const aktienVerlust = aktienTrades.filter(t => (Number(t.amount) || 0) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const aktienSaldo = aktienGewinn - aktienVerlust;
  const sonstigerGewinn = sonstigeTrades.filter(t => (Number(t.amount) || 0) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const sonstigerVerlust = sonstigeTrades.filter(t => (Number(t.amount) || 0) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const sonstigeSaldo = sonstigerGewinn - sonstigerVerlust;

  // FIX #6: Aktien-Verluste dürfen nur Aktien-Gewinne mindern
  const aktienSteuerpflichtig = Math.max(0, aktienSaldo);
  const sonstigesNetto = Math.max(0, sonstigeSaldo + Math.min(0, aktienSaldo));
  const gewinn = aktienGewinn + sonstigerGewinn;
  const verlust = aktienVerlust + sonstigerVerlust;
  const saldo = aktienSaldo + sonstigeSaldo;
  const freibetrag = verheiratet ? K.sparerpauschbetrag_verheiratet : K.sparerpauschbetrag_single;
  const steuerpflichtig = Math.max(0, aktienSteuerpflichtig + sonstigesNetto - freibetrag);
  const kapest = Math.round(steuerpflichtig * K.kapest_satz);
  const soli = kapest > 0 ? Math.round(kapest * K.soli_satz) : 0;
  const kst_satz = K.kirchensteuer_satz[bundesland] || K.kirchensteuer_satz.default;
  const kst = kirchensteuer && kapest > 0 ? Math.round(kapest * kst_satz) : 0;

  // FIX #5: Günstigerprüfung nach §32d Abs. 6 EStG (nur wenn zvE bekannt)
  let guenstigerPruefung = null;
  if (steuerpflichtig > 0 && zve !== null) {
    const grenzsteuersatz = calcGrenzsteuersatz(zve, year);
    if (grenzsteuersatz < K.kapest_satz) {
      guenstigerPruefung = {
        empfohlen: true,
        grenzsteuersatz,
        ersparnis: Math.round((K.kapest_satz - grenzsteuersatz) * steuerpflichtig)
      };
    }
  }
  return {
    gewinn: Math.round(gewinn),
    verlust: Math.round(verlust),
    saldo: Math.round(saldo),
    freibetrag,
    steuerpflichtig: Math.round(steuerpflichtig),
    kapest,
    soli,
    kst,
    gesamt: kapest + soli + kst,
    // FIX #6: Getrennte Saldos für Aktien/Sonstige im Rückgabeobjekt
    aktienSaldo: Math.round(aktienSaldo),
    sonstigeSaldo: Math.round(sonstigeSaldo),
    guenstigerHinweis: steuerpflichtig > 0 && steuerpflichtig < 5000,
    // FIX #5: null wenn zvE nicht übergeben wurde
    guenstigerPruefung
  };
}

// ────────────────────────────────────────────────────────────────────────
// calcWK — Werbungskosten + Pendlerpauschale + Homeoffice
// ────────────────────────────────────────────────────────────────────────
function calcWK({
  receipts = [],
  year = "2025",
  arbeitstage = 220,
  entfernung_km = 0,
  homeoffice_tage = 0
}) {
  const K = getK(year);
  const y = String(year);
  const belegSumme = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const pendlertage = Math.max(0, arbeitstage - homeoffice_tage);
  // FIX #4: Ab 2026 einheitlich 0,38 €/km ab km 1 — Split-Logik nur bis 2025
  let km_zone1, km_zone2;
  if (Number(year) >= 2026) {
    km_zone1 = entfernung_km;
    km_zone2 = 0;
  } else {
    km_zone1 = Math.min(entfernung_km, 20);
    km_zone2 = Math.max(0, entfernung_km - 20);
  }
  const pendler = Math.round(pendlertage * (km_zone1 * K.entfernung_km_bis_20 + km_zone2 * K.entfernung_km_ab_21));
  const ho_anrechenbar = Math.min(homeoffice_tage, K.homeoffice_max_tage);
  const homeoffice = Math.round(ho_anrechenbar * K.homeoffice_pro_tag);
  const wk_gesamt = Math.round(belegSumme + pendler + homeoffice);
  return {
    belegSumme: Math.round(belegSumme),
    pendlerpauschale: pendler,
    homeoffice_pauschale: homeoffice,
    wk_gesamt,
    pauschale: K.wk_pauschale,
    lohntSichEinzeln: wk_gesamt > K.wk_pauschale,
    vorteil: Math.max(0, wk_gesamt - K.wk_pauschale)
  };
}

// ════════════════════════════════════════════════════════════════════════
// Profil-Engine + Steuer-Mathematik
// ════════════════════════════════════════════════════════════════════════

// buildUserProfile — leitet aus Rohdaten ein typisiertes Steuerprofil ab.
// Nie undefined/null — immer saubere Defaults.
function buildUserProfile(interviewAnswers, tweaks) {
  const ia = interviewAnswers || {};
  const t = tweaks || {};
  const beschaeftigung = ia.beschaeftigung || t.berufstyp || "arbeitnehmer";
  const familienstand = ia.familienstand || t.familienstand || "ledig";
  const kinder = !!ia.kinder;
  // NEU: Feature 2 — Bundesland bevorzugt aus Interview, Fallback tweaks
  const bundesland = ia.bundesland || t.bundesland || "default";
  const steuerklasse = Number(t.steuerklasse) || 1;
  const brutto = Number(ia.brutto) || Number(ia.jahresbrutto) || 0;
  // NEU: Feature 2 — kirchenmitglied aus Interview oder tweaks
  const kirchenmitglied = !!ia.kirchenmitglied || !!t.kirchensteuer;
  const istStudent = ["student_dual", "student_trial", "student_voll"].includes(beschaeftigung);
  const hatAusbildungsverhaeltnis = ["student_dual", "student_trial", "azubi"].includes(beschaeftigung);
  const studiumTyp = ia.studium_typ || null;
  const studium = istStudent || beschaeftigung === "azubi" ? {
    typ: studiumTyp,
    trialeStudium: beschaeftigung === "student_trial",
    hatAusbildungsverhaeltnis,
    tageImBetrieb: Number(ia.betrieb_tage) || 0,
    tageUni: Number(ia.uni_tage) || 0,
    tageBerufsschule: Number(ia.berufsschule_tage) || 0,
    kmZumBetrieb: Number(ia.km_betrieb) || 0,
    kmZurUni: Number(ia.km_uni) || 0,
    kmZurBerufsschule: Number(ia.km_berufsschule) || 0
  } : null;
  const einkunftsarten = {
    lohnarbeit: ["arbeitnehmer", "beides", "student_dual", "student_trial", "azubi"].includes(beschaeftigung),
    minijob: !!ia.minijob,
    selbststaendig: ["selbststaendig", "beides"].includes(beschaeftigung),
    kapitalertraege: !!ia.kapitalertraege,
    vermietung: !!ia.vermieter,
    rente: beschaeftigung === "rente",
    sonstige: false
  };
  const abzugsfaehigePositionen = {};
  const ausgeschlossenePositionen = [];

  // Pendlerpauschale
  if (einkunftsarten.lohnarbeit || hatAusbildungsverhaeltnis) {
    abzugsfaehigePositionen.pendlerpauschale = true;
  } else if (einkunftsarten.selbststaendig && !einkunftsarten.lohnarbeit) {
    abzugsfaehigePositionen.pendlerpauschale = false;
    ausgeschlossenePositionen.push({
      id: "pendlerpauschale_selbst",
      titel: "Pendlerpauschale (§ 9 EStG)",
      grund: "Selbstständige setzen Fahrtkosten als Betriebsausgaben ab (§ 4 Abs. 4 EStG), nicht als Werbungskosten. Satz: 0,30 \u20ac/km."
    });
  } else {
    abzugsfaehigePositionen.pendlerpauschale = false;
  }

  // Homeoffice-Pauschale
  abzugsfaehigePositionen.homeoffice = ["arbeitnehmer", "beides", "student_dual", "student_trial"].includes(beschaeftigung);

  // WK-Pauschale
  abzugsfaehigePositionen.werbungskosten_single = einkunftsarten.lohnarbeit || hatAusbildungsverhaeltnis;

  // Betriebsausgaben
  abzugsfaehigePositionen.betriebsausgaben = einkunftsarten.selbststaendig;

  // Studienkosten: Erststudium \u2192 SA; Zweit/Weiterbildung \u2192 WK
  if (istStudent) {
    if (studiumTyp === "erst") {
      abzugsfaehigePositionen.studienkosten_sa = true;
      abzugsfaehigePositionen.studienkosten_wk = false;
      ausgeschlossenePositionen.push({
        id: "wk_studienkosten",
        titel: "Studienkosten als Werbungskosten",
        grund: "Erststudium: Studienkosten sind Sonderausgaben (max. 6.000 \u20ac), nicht Werbungskosten \u2014 kein Verlustvortrag m\u00f6glich. \u00a7 9 Abs. 6 i.V.m. \u00a7 10 Abs. 1 Nr. 7 EStG."
      });
    } else if (studiumTyp === "zweit" || studiumTyp === "weiterbildung") {
      abzugsfaehigePositionen.studienkosten_wk = true;
      abzugsfaehigePositionen.studienkosten_sa = false;
    } else {
      abzugsfaehigePositionen.studienkosten_wk = null;
      abzugsfaehigePositionen.studienkosten_sa = null;
    }
  } else {
    abzugsfaehigePositionen.studienkosten_wk = false;
    abzugsfaehigePositionen.studienkosten_sa = false;
  }

  // BAV
  abzugsfaehigePositionen.bav = einkunftsarten.lohnarbeit || hatAusbildungsverhaeltnis;

  // Rente: andere WK-Pauschale
  if (beschaeftigung === "rente") {
    abzugsfaehigePositionen.altersentlastungsbetrag = true;
    abzugsfaehigePositionen.werbungskosten_single = false;
    ausgeschlossenePositionen.push({
      id: "wk_pauschale_1230",
      titel: "WK-Pauschale 1.230 \u20ac (Arbeitnehmer)",
      grund: "Rentner erhalten nur die WK-Pauschale von 102 \u20ac (\u00a7 9a Satz 1 Nr. 3 EStG), nicht 1.230 \u20ac."
    });
  }
  return {
    beschaeftigung,
    studium,
    einkunftsarten,
    familienstand,
    kinder,
    kirchenmitglied,
    bundesland,
    brutto,
    bruttoGesamt: brutto + (Number(ia.brutto_nebeneinkunfte) || 0),
    steuerklasse,
    abzugsfaehigePositionen,
    ausgeschlossenePositionen,
    // NEU: Feature 2 — Vorsorge + Unterhalt
    kv_beitrag_jahres: Number(ia.kv_beitrag_jahres) || 0,
    riester_eigenanteil: Number(ia.riester_eigenanteil) || 0,
    bav_beitrag_jahres: Number(ia.bav_beitrag_jahres) || 0,
    unterhalt_betrag: Number(ia.unterhalt_betrag_jahres) || 0,
    // NEU: Feature 3 — Mehrjahres
    offene_steuerjahre: ia.offene_steuerjahre || "alle",
    _ia: ia,
    _tweaks: t
  };
}

// calcGrenzsteuersatz \u2014 echter marginaler Steuersatz via calcESt-Differenz.
function calcGrenzsteuersatz(zvE, year) {
  // BUGFIX: vorher est2 - est1 mit GERUNDETEM calcESt → Ergebnis war immer
  // 0 oder 1 (= 0 % oder 100 %). Jetzt: 100-€-Differenz auf ungerundetem Tarif.
  const z = Math.max(0, Number(zvE) || 0);
  return (_calcEStRaw(z + 100, year) - _calcEStRaw(z, year)) / 100;
}

// calcZumutbareEigenbelastung \u2014 \u00a7 33 Abs. 3 EStG (Staffelberechnung)
function calcZumutbareEigenbelastung(gesamteinkuenfte, familienstand, kinderAnzahl) {
  const STUFEN = [[15340, 0.05, 0.04, 0.02], [51130, 0.06, 0.05, 0.03], [Infinity, 0.07, 0.06, 0.04]];
  const mitKindern = (kinderAnzahl || 0) > 0;
  const verheiratet = familienstand === "verheiratet";
  let zumutbar = 0;
  let rest = gesamteinkuenfte;
  for (let i = 0; i < STUFEN.length; i++) {
    const [grenze, sLedig, sVerh, sKind] = STUFEN[i];
    const satz = mitKindern ? sKind : verheiratet ? sVerh : sLedig;
    const vorgrenze = i === 0 ? 0 : STUFEN[i - 1][0];
    const band = Math.min(rest, grenze - vorgrenze);
    if (band <= 0) break;
    zumutbar += band * satz;
    rest -= band;
    if (rest <= 0) break;
  }
  return Math.round(zumutbar);
}

// ════════════════════════════════════════════════════════════════════════
// NEU: Feature 4 — Config-Staleness-Prüfer + Banner
// ════════════════════════════════════════════════════════════════════════

function checkConfigStaleness(configRaw) {
  const letzteAktualisierung = configRaw?.meta?.letzte_aktualisierung;
  if (!letzteAktualisierung) return false;
  const age = (Date.now() - new Date(letzteAktualisierung).getTime()) / (1000 * 60 * 60 * 24);
  return age > 30;
}
function TaxConfigStatusBanner() {
  const {
    source: configSource,
    date: configDate
  } = useTaxConfig();
  const [dismissed, setDismissed] = React.useState(false);
  const [stale, setStale] = React.useState(false);
  React.useEffect(() => {
    if (configDate && configDate !== "?") {
      const age = (Date.now() - new Date(configDate).getTime()) / (1000 * 60 * 60 * 24);
      setStale(age > 30);
    }
  }, [configDate]);
  if (dismissed || !stale && configSource !== "inline-bootstrap") return null;
  const isOffline = configSource === "inline-bootstrap";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 14px",
      borderRadius: "8px",
      marginBottom: "12px",
      background: isOffline ? "oklch(0.97 0.04 80)" : "var(--surface-2)",
      border: "1px solid " + (isOffline ? "oklch(0.85 0.08 80)" : "var(--border)"),
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "12px",
      color: isOffline ? "oklch(0.45 0.12 80)" : "var(--text-faint)"
    }
  }, /*#__PURE__*/React.createElement("span", null, isOffline ? "⚠" : "ℹ"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, isOffline ? `Steuer-Werte: Offline-Fallback (Stand ${configDate}). Internetverbindung herstellen für aktuelle Sätze.` : stale ? `Steuer-Konfiguration ist älter als 30 Tage (Stand: ${configDate}). Lade die App neu für aktuelle Werte.` : `Steuer-Werte geladen (Stand: ${configDate})`), stale && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      localStorage.removeItem("tax_constants_raw");
      window.location.reload();
    },
    style: {
      fontSize: "11px",
      padding: "3px 8px",
      cursor: "pointer",
      background: "var(--surface-3, var(--surface-2))",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      color: "var(--text)",
      fontFamily: "inherit"
    }
  }, "Aktualisieren"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDismissed(true),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-faint)",
      fontSize: "14px",
      lineHeight: 1,
      fontFamily: "inherit"
    },
    "aria-label": "Schlie\xDFen"
  }, "\xD7"));
}

// ════════════════════════════════════════════════════════════════════════
// UI-Komponenten
// ════════════════════════════════════════════════════════════════════════

function BruttoNettoRechner({
  defaultBrutto = 0,
  defaultSteuerklasse = 1,
  defaultKst = false,
  defaultBundesland = "default"
}) {
  // Re-render bei Config-Update aus GitHub.
  useTaxConfig();
  const [brutto, setBrutto] = React.useState(defaultBrutto || 40000);
  const [sk, setSk] = React.useState(defaultSteuerklasse);
  const [kst, setKst] = React.useState(!!defaultKst);
  const [kinder, setKinder] = React.useState(false);
  const [year, setYear] = React.useState(2025);
  const r = React.useMemo(() => calcBruttoNetto({
    brutto,
    steuerklasse: sk,
    kirchensteuer: kst,
    bundesland: defaultBundesland,
    kinder,
    year
  }), [brutto, sk, kst, kinder, year, defaultBundesland]);
  const monat = v => fmtEUR(Math.round(v / 12));
  const rows = [["Lohnsteuer", r.lohnsteuer], ["Solidaritätszuschlag", r.soli], ["Kirchensteuer", r.kst], ["Krankenversicherung", r.kv], ["Rentenversicherung", r.rv], ["Arbeitslosenvers.", r.alv], ["Pflegeversicherung", r.pv]];
  return /*#__PURE__*/React.createElement("div", {
    className: "bn-rechner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bn-inputs"
  }, /*#__PURE__*/React.createElement("label", {
    className: "bn-field"
  }, /*#__PURE__*/React.createElement("span", null, "Jahresbrutto"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "500",
    min: "0",
    value: brutto,
    onChange: e => setBrutto(Number(e.target.value))
  })), /*#__PURE__*/React.createElement("label", {
    className: "bn-field"
  }, /*#__PURE__*/React.createElement("span", null, "Steuerklasse"), /*#__PURE__*/React.createElement("select", {
    value: sk,
    onChange: e => setSk(Number(e.target.value))
  }, [1, 2, 3, 4, 5, 6].map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, "Klasse ", n)))), /*#__PURE__*/React.createElement("label", {
    className: "bn-field"
  }, /*#__PURE__*/React.createElement("span", null, "Jahr"), /*#__PURE__*/React.createElement("select", {
    value: year,
    onChange: e => setYear(Number(e.target.value))
  }, Object.keys(STEUER_KONSTANTEN).filter(y => /^\d{4}$/.test(y)).sort().map(y => /*#__PURE__*/React.createElement("option", {
    key: y,
    value: Number(y)
  }, y))))), /*#__PURE__*/React.createElement("div", {
    className: "bn-checks"
  }, /*#__PURE__*/React.createElement("label", {
    className: "bn-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: kst,
    onChange: e => setKst(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, "Kirchensteuer")), /*#__PURE__*/React.createElement("label", {
    className: "bn-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: kinder,
    onChange: e => setKinder(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", null, "Mit Kindern (geringerer PV-Satz)"))), /*#__PURE__*/React.createElement("div", {
    className: "bn-rows"
  }, rows.map(([label, val]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: `bn-row ${val === 0 ? "muted" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "bn-row-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "bn-row-value"
  }, "\u2212 ", fmtEUR(val), /*#__PURE__*/React.createElement("span", {
    className: "bn-row-month"
  }, " / ", monat(val)))))), /*#__PURE__*/React.createElement("div", {
    className: "bn-result"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "bn-result-label"
  }, "Netto / Jahr"), /*#__PURE__*/React.createElement("div", {
    className: "bn-result-month"
  }, monat(r.netto), " / Monat")), /*#__PURE__*/React.createElement("div", {
    className: "bn-result-value"
  }, fmtEUR(r.netto))));
}
function KapEStCard({
  trades = [],
  year,
  tweaks = {}
}) {
  const r = calcKapESt({
    trades,
    year,
    verheiratet: tweaks.familienstand === "verheiratet",
    kirchensteuer: tweaks.kirchensteuer || false,
    bundesland: tweaks.bundesland || "default"
  });
  if (r.saldo <= 0 && r.verlust === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 320)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Kapitalertragsteuer ", year)), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: r.gesamt > 0 ? "var(--danger)" : "var(--text-faint)"
    }
  }, r.gesamt > 0 ? `− ${fmtEUR(r.gesamt)}` : "—")), /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Realisierte Gewinne"), /*#__PURE__*/React.createElement("span", {
    className: "num pos"
  }, "+ ", fmtEUR(r.gewinn))), r.verlust > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Realisierte Verluste"), /*#__PURE__*/React.createElement("span", {
    className: "num neg"
  }, "\u2212 ", fmtEUR(r.verlust))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Sparerpauschbetrag"), /*#__PURE__*/React.createElement("span", {
    className: "num muted"
  }, "\u2212 ", fmtEUR(r.freibetrag))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row strong"
  }, /*#__PURE__*/React.createElement("span", null, "Steuerpflichtig"), /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, fmtEUR(r.steuerpflichtig))), r.kapest > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "KapESt 25%"), /*#__PURE__*/React.createElement("span", {
    className: "num neg"
  }, "\u2212 ", fmtEUR(r.kapest))), r.soli > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Solidarit\xE4tszuschlag"), /*#__PURE__*/React.createElement("span", {
    className: "num neg"
  }, "\u2212 ", fmtEUR(r.soli))), r.kst > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Kirchensteuer"), /*#__PURE__*/React.createElement("span", {
    className: "num neg"
  }, "\u2212 ", fmtEUR(r.kst)))), r.guenstigerHinweis && /*#__PURE__*/React.createElement("div", {
    className: "tax-hint warning",
    style: {
      marginTop: 10
    }
  }, "G\xFCnstigerpr\xFCfung pr\xFCfen: Bei niedrigem Grenzsteuersatz (< 25%) kann Anlage KAP mit G\xFCnstigerpr\xFCfung g\xFCnstiger sein.")));
}

// ── Erkennt anhand des Namens, ob ein Arbeitsort steuerlich absetzbar ist ──
function classifyArbeitsort(name) {
  const n = (name || "").toLowerCase().trim();
  if (!n) return {
    typ: "unbekannt",
    label: "",
    deductible: null
  };

  // Privat / nicht absetzbar
  const privat = [/sport(halle|verein|platz|studio|club|park)?/, /fitnessstudio/, /\bgym\b/, /\bgymnasium\b(?!.*schule)/, /schwimmbad/, /freibad/, /fußball(platz|verein)?/, /tennisplatz/, /kino/, /theater/, /restaurant/, /café|cafe/, /\bbar\b/, /disco/, /club(?!.*haus)/, /shopping/, /zuhause/, /privat/, /\bhome\b/, /wohnung/, /eltern/];
  if (privat.some(r => r.test(n))) {
    return {
      typ: "privat",
      label: "Privat — nicht absetzbar",
      deductible: false,
      color: "#d64040"
    };
  }

  // Ausbildung / duales Studium → auch absetzbar (Auswärtstätigkeit § 9 EStG)
  const ausbildung = [/berufsschule/, /\bbbs\b/, /\bbsz\b/, /berufliche schule/, /berufskolleg/, /universität/, /\buni\b/, /hochschule/, /\bfh\b/, /fachhochschule/, /\bdhbw\b/, /\btu\b(?! berlin)/, /\brwth\b/, /\bkit\b/, /duale hochschule/, /akademie/, /campus/, /bildungszentrum/, /schulungszentrum/, /lernzentrum/, /ausbildungsbetrieth?/, /\bazubi\b/, /auszubildend/];
  if (ausbildung.some(r => r.test(n))) {
    return {
      typ: "ausbildung",
      label: "Studium/Ausbildung — absetzbar (§ 9 EStG)",
      deductible: true,
      color: "#1a7f4b",
      hint: "Auswärtstätigkeit gem. § 9 Abs. 4a EStG — Fahrtkosten voll abzugsfähig."
    };
  }

  // Betrieb / Arbeitsstätte → absetzbar als Pendlerpauschale
  const beruflich = [/büro/, /office/, /\bbetrieb\b/, /firma/, /unternehmen/, /\bgmbh\b/, /\bag\b/, /\bkg\b/, /\bohnebh\b/, /arbeit(s|geber|stätte|ort|platz)?/, /\bdienst\b/, /filiale/, /niederlassung/, /\bwerk\b/, /fabrik/, /lager/, /werkstatt/, /\bkunde\b/, /kundentermin/, /außendienst/, /dienstreise/, /hauptstandort/, /arbeitgeber/, /beschäftigungs/, /\babteilung\b/, /hauptsitz/, /\bstandort\b/];
  if (beruflich.some(r => r.test(n))) {
    return {
      typ: "beruflich",
      label: "Beruflich — Pendlerpauschale (§ 9 EStG)",
      deductible: true,
      color: "#1a7f4b",
      hint: "Erste oder weitere Tätigkeitsstätte — Pendlerpauschale ansetzbar."
    };
  }
  return {
    typ: "unbekannt",
    label: "Bitte prüfen",
    deductible: null,
    color: "var(--text-muted)"
  };
}
function PauschaleCard({
  receipts = [],
  year,
  tweaks = {}
}) {
  const _nextId = React.useRef(1);
  const mkId = () => _nextId.current++;
  const [standorte, setStandorte] = React.useState(() => [{
    id: mkId(),
    label: "Standort 1",
    km: tweaks.km_einweg || 0,
    arbeitstage: tweaks.arbeitstage || 220
  }]);
  const [hoTage, setHoTage] = React.useState(tweaks.homeoffice_tage || 0);
  const addStandort = () => setStandorte(prev => [...prev, {
    id: mkId(),
    label: `Standort ${prev.length + 1}`,
    km: 0,
    arbeitstage: 0
  }]);
  const removeStandort = id => setStandorte(prev => prev.filter(s => s.id !== id));
  const updateStandort = (id, patch) => setStandorte(prev => prev.map(s => s.id === id ? {
    ...s,
    ...patch
  } : s));
  const wk = React.useMemo(() => {
    const K = getK(year);
    const y = String(year);
    const belegSumme = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);

    // Nur steuerlich absetzbare Standorte (nicht "privat") einbeziehen
    const abzugsfaehig = standorte.filter(s => classifyArbeitsort(s.label).deductible !== false);
    const pendlerpauschale = abzugsfaehig.reduce((sum, s) => {
      const km = Number(s.km) || 0;
      const tage = Number(s.arbeitstage) || 0;
      let zone1, zone2;
      if (Number(year) >= 2026) {
        zone1 = km;
        zone2 = 0;
      } else {
        zone1 = Math.min(km, 20);
        zone2 = Math.max(0, km - 20);
      }
      return sum + Math.round(tage * (zone1 * K.entfernung_km_bis_20 + zone2 * K.entfernung_km_ab_21));
    }, 0);
    const ho_anrechenbar = Math.min(Number(hoTage) || 0, K.homeoffice_max_tage);
    const homeoffice_pauschale = Math.round(ho_anrechenbar * K.homeoffice_pro_tag);
    const wk_gesamt = Math.round(belegSumme + pendlerpauschale + homeoffice_pauschale);
    return {
      belegSumme: Math.round(belegSumme),
      pendlerpauschale,
      homeoffice_pauschale,
      wk_gesamt,
      pauschale: K.wk_pauschale,
      lohntSichEinzeln: wk_gesamt > K.wk_pauschale,
      vorteil: Math.max(0, wk_gesamt - K.wk_pauschale)
    };
  }, [receipts, year, standorte, hoTage]);
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 240)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Werbungskosten & Pauschalen ", year)), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: wk.lohntSichEinzeln ? "var(--accent)" : "var(--text-faint)"
    }
  }, fmtEUR(Math.max(wk.wk_gesamt, wk.pauschale)))), /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--text-muted)",
      marginBottom: 6
    }
  }, "Arbeitsweg / Standorte"), standorte.map((s, idx) => {
    const cls = classifyArbeitsort(s.label);
    const isPrivat = cls.deductible === false;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: {
        marginBottom: 10,
        background: "var(--surface-2)",
        borderRadius: 9,
        padding: "8px 10px",
        border: isPrivat ? "1.5px solid #d64040" : "1px solid var(--border)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        alignItems: "center",
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, idx === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, "Bezeichnung (z.B. B\xFCro, Berufsschule, Uni)"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      className: "bn-field",
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: "6px 8px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        fontSize: 13,
        color: "var(--text)"
      },
      value: s.label,
      onChange: e => updateStandort(s.id, {
        label: e.target.value
      }),
      placeholder: `z.B. Berufsschule, Büro, Betrieb…`
    })), standorte.length > 1 && /*#__PURE__*/React.createElement("button", {
      onClick: () => removeStandort(s.id),
      title: "Standort entfernen",
      style: {
        flexShrink: 0,
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 7,
        padding: "5px 8px",
        cursor: "pointer",
        color: "var(--danger)",
        fontSize: 14,
        lineHeight: 1,
        height: 34
      }
    }, "\xD7")), s.label.trim().length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: cls.color || "var(--text-muted)",
        marginBottom: 6,
        padding: "2px 8px",
        borderRadius: 999,
        background: isPrivat ? "oklch(0.96 0.04 20)" : cls.deductible ? "oklch(0.96 0.04 160)" : "var(--surface)",
        border: `1px solid ${cls.color || "var(--border)"}`,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("span", null, isPrivat ? "✗" : cls.deductible ? "✓" : "?"), /*#__PURE__*/React.createElement("span", null, cls.label)), cls.hint && s.label.trim().length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: "var(--text-faint)",
        marginBottom: 6,
        lineHeight: 1.4
      }
    }, cls.hint), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, "km (einfach)"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: "300",
      step: "1",
      className: "bn-field",
      style: {
        width: "100%",
        boxSizing: "border-box",
        opacity: isPrivat ? 0.4 : 1
      },
      value: s.km,
      disabled: isPrivat,
      onChange: e => updateStandort(s.id, {
        km: Number(e.target.value)
      })
    })), /*#__PURE__*/React.createElement("label", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 2
      }
    }, "Tage / Jahr"), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      max: "260",
      step: "1",
      className: "bn-field",
      style: {
        width: "100%",
        boxSizing: "border-box",
        opacity: isPrivat ? 0.4 : 1
      },
      value: s.arbeitstage,
      disabled: isPrivat,
      onChange: e => updateStandort(s.id, {
        arbeitstage: Number(e.target.value)
      })
    }))), isPrivat && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#d64040",
        marginTop: 5,
        fontWeight: 600
      }
    }, "Dieser Ort gilt als privat \u2014 wird nicht in der Pendlerpauschale ber\xFCcksichtigt."));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addStandort,
    style: {
      marginTop: 2,
      fontSize: 12,
      padding: "5px 12px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 7,
      cursor: "pointer",
      color: "var(--text-muted)",
      fontWeight: 600
    }
  }, "+ Standort hinzuf\xFCgen")), /*#__PURE__*/React.createElement("label", {
    className: "bn-field",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", null, "Homeoffice-Tage"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "210",
    step: "1",
    value: hoTage,
    onChange: e => setHoTage(Number(e.target.value))
  })), /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Belege (Werbungskosten)"), /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, fmtEUR(wk.belegSumme))), wk.pendlerpauschale > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Pendlerpauschale", standorte.length > 1 ? " (alle Standorte)" : ""), /*#__PURE__*/React.createElement("span", {
    className: "num pos"
  }, "+ ", fmtEUR(wk.pendlerpauschale))), wk.homeoffice_pauschale > 0 && /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Homeoffice-Pauschale"), /*#__PURE__*/React.createElement("span", {
    className: "num pos"
  }, "+ ", fmtEUR(wk.homeoffice_pauschale))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row strong"
  }, /*#__PURE__*/React.createElement("span", null, "WK gesamt"), /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, fmtEUR(wk.wk_gesamt))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "WK-Pauschale (automatisch)"), /*#__PURE__*/React.createElement("span", {
    className: "num muted"
  }, fmtEUR(wk.pauschale))), /*#__PURE__*/React.createElement("div", {
    className: `tax-hint ${wk.lohntSichEinzeln ? "success" : "warning"}`,
    style: {
      marginTop: 10
    }
  }, wk.lohntSichEinzeln ? `✓ Einzeln abrechnen lohnt sich: ${fmtEUR(wk.vorteil)} mehr als die Pauschale.` : `Pauschale reicht — deine WK (${fmtEUR(wk.wk_gesamt)}) liegen unter ${fmtEUR(wk.pauschale)}.`)));
}

// ── Sicherheits-Export: Funktionen als nicht-überschreibbar auf window setzen ──
// Verhindert, dass externe Skripte oder versehentliche Re-Assignments
// Steuerfunktionen ersetzen können (Object.defineProperty, writable: false).
// Getters (Live-Snapshots) bleiben veränderlich, da ihr Wert sich nach
// fetchLatestTaxConfig() aktualisiert.
(function _secureExport() {
  // Wert-Exports: einmalig gesetzt, danach nicht mehr überschreibbar
  const valueDefs = {
    buildUserProfile,
    calcGrenzsteuersatz,
    calcZumutbareEigenbelastung,
    checkConfigStaleness,
    getK,
    calcESt,
    calcBruttoNetto,
    calcKapESt,
    calcWK,
    BruttoNettoRechner,
    KapEStCard,
    PauschaleCard,
    TaxConfigStatusBanner,
    INLINE_BOOTSTRAP,
    normalizeTaxConfig,
    fetchLatestTaxConfig,
    useTaxConfig
  };
  for (const [k, v] of Object.entries(valueDefs)) {
    try {
      Object.defineProperty(window, k, {
        value: v,
        writable: false,
        configurable: false,
        enumerable: true
      });
    } catch {
      window[k] = v; /* Fallback falls Property bereits existiert */
    }
  }

  // Getter-Exports: Live-Werte die sich nach fetchLatestTaxConfig() ändern
  const getterDefs = {
    STEUER_KONSTANTEN: {
      get() {
        return STEUER_KONSTANTEN;
      }
    },
    TAX_CONFIG_RAW: {
      get() {
        return STEUER_KONSTANTEN.__raw;
      }
    },
    TAX_CONFIG_SOURCE: {
      get() {
        return LAST_CONFIG_SOURCE;
      }
    },
    TAX_CONFIG_DATE: {
      get() {
        return LAST_CONFIG_DATE;
      }
    }
  };
  for (const [k, desc] of Object.entries(getterDefs)) {
    try {
      Object.defineProperty(window, k, {
        ...desc,
        configurable: false,
        enumerable: true
      });
    } catch {/* bereits definiert */}
  }
})();
