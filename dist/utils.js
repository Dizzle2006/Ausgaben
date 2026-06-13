/* global React */

// ============ Helpers ============
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtEUR = n => {
  const value = Number(n) || 0;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};
const fmtEURsigned = n => {
  const v = Number(n) || 0;
  const sign = v > 0 ? "+ " : v < 0 ? "− " : "";
  return sign + fmtEUR(Math.abs(v));
};
const fmtDate = iso => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

// Lokales Datum (nicht UTC!) als YYYY-MM-DD — toISOString() würde nachts
// (zwischen 00:00 und 01:00/02:00 Uhr Lokalzeit) noch den Vortag liefern
// und neue Einträge dadurch dem falschen Tag im Tagesausgaben-Raster zuordnen.
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Liest die Budget-Perioden-Einstellung (Kalendermonat vs. eigener Zeitraum
// ab einem festen Starttag, z.B. Gehaltseingang am 11.) aus den persistierten
// Tweaks. Fallback: Kalendermonat.
const _getBudgetPeriod = () => {
  try {
    const t = JSON.parse(localStorage.getItem("ausgaben-tweaks") || "{}");
    const startDay = Number(t.budgetPeriodStartDay);
    if (t.budgetPeriodMode === "custom" && startDay >= 1 && startDay <= 28) {
      return {
        mode: "custom",
        startDay
      };
    }
  } catch {}
  return {
    mode: "calendar",
    startDay: 1
  };
};

// Effektiver Periodenstart für Monat (y, m): bei "custom" wird der konfigurierte
// Starttag genommen, fällt dieser aber auf Sa/So, rückt der Beginn auf den
// nächsten Werktag (Mo) vor — Gehalt kommt bei Wochenend-Stichtagen oft erst
// am folgenden Bankarbeitstag. Ein Rollover über das Monatsende hinaus (nur bei
// Starttag 28 in einem Februar mit Wochenende möglich) wird auf den letzten
// Tag des Monats begrenzt.
const _periodStartDate = (y, m, period) => {
  if (!period || period.mode !== "custom" || period.startDay <= 1) {
    return new Date(y, m - 1, 1);
  }
  const daysInM = new Date(y, m, 0).getDate();
  const day = Math.min(period.startDay, daysInM);
  const d = new Date(y, m - 1, day);
  const weekday = d.getDay(); // 0=So ... 6=Sa
  if (weekday === 6) d.setDate(d.getDate() + 2); // Sa -> Mo
  else if (weekday === 0) d.setDate(d.getDate() + 1); // So -> Mo
  if (d.getMonth() !== m - 1) return new Date(y, m - 1, daysInM);
  return d;
};

// Start- und Enddatum sowie Länge (in Tagen) des Budget-Zeitraums für ym.
// cfg optional: { mode: "calendar"|"custom", startDay }. Ohne cfg wird die
// persistierte Einstellung gelesen (für Aufrufer ohne React-State-Zugriff).
const getPeriodRange = (ym, cfg) => {
  const [y, m] = ym.split("-").map(Number);
  const period = cfg || _getBudgetPeriod();
  const start = _periodStartDate(y, m, period);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = _periodStartDate(nextY, nextM, period);
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  return {
    start,
    end,
    lengthDays
  };
};
const monthLabel = (ym, cfg) => {
  const [y, m] = ym.split("-").map(Number);
  const period = cfg || _getBudgetPeriod();
  if (period.mode === "custom" && period.startDay > 1) {
    const {
      start,
      end
    } = getPeriodRange(ym, period);
    const dayMonth = d => `${d.getDate()}. ${d.toLocaleDateString("de-DE", {
      month: "long"
    })}`;
    return `${dayMonth(start)} – ${dayMonth(end)} ${end.getFullYear()}`;
  }
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
};
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Liefert das YM des aktuell laufenden Budget-Zeitraums. Bei "custom" mit
// Starttag X läuft der Zeitraum vom X. (ggf. wochenend-korrigiert) bis zum
// entsprechenden Tag des Folgemonats — vor dem Periodenstart gehört "heute"
// also noch zum YM des Vormonats.
const currentYM = () => {
  const d = new Date();
  const period = _getBudgetPeriod();
  if (period.mode === "custom") {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const {
      start
    } = getPeriodRange(ym, period);
    if (d.getTime() < start.getTime()) {
      d.setMonth(d.getMonth() - 1);
    }
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ============ Icons ============
const Icon = {
  Trash: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
  })),
  Chevron: () => /*#__PURE__*/React.createElement("svg", {
    className: "row-chevron",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  Back: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  Left: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  Right: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  TrendUp: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "23 6 13.5 15.5 8.5 10.5 1 18"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 6 23 6 23 12"
  })),
  TrendDown: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "23 18 13.5 8.5 8.5 13.5 1 6"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 18 23 18 23 12"
  })),
  Settings: () => /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
  })),
  Close: () => /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })),
  Download: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })),
  Upload: () => /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 8 12 3 7 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "3",
    x2: "12",
    y2: "15"
  })),
  Camera: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "4"
  })),
  ScanFrame: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 7V5a2 2 0 0 1 2-2h2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 3h2a2 2 0 0 1 2 2v2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 17v2a2 2 0 0 1-2 2h-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 21H5a2 2 0 0 1-2-2v-2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "21",
    y2: "12"
  })),
  Receipt: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2l-1 2-3-2-3 2-3-2-3 2-3-2z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "9",
    x2: "16",
    y2: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "13",
    x2: "16",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "17",
    x2: "13",
    y2: "17"
  })),
  Repeat: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "17 1 21 5 17 9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 11V9a4 4 0 0 1 4-4h14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 23 3 19 7 15"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 13v2a4 4 0 0 1-4 4H3"
  })),
  FileText: () => /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "10 9 9 9 8 9"
  })),
  Mic: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 10v2a7 7 0 0 1-14 0v-2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "23"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "23",
    x2: "16",
    y2: "23"
  }))
};

// ============ Default data ============
const defaultMonthData = ym => ({
  income: [{
    id: uid(),
    label: "Netto-Einkommen",
    amount: 0
  }, {
    id: uid(),
    label: "Sonstige Einnahmen",
    amount: 0
  }],
  fixed: [{
    id: uid(),
    label: "HDI Lebensversicherung",
    amount: 0,
    date: `${ym}-01`,
    recurring: true
  }, {
    id: uid(),
    label: "Nürnberger Lebensversicherung",
    amount: 0,
    date: `${ym}-01`,
    recurring: true
  }, {
    id: uid(),
    label: "Streaming / Abos",
    amount: 0,
    date: `${ym}-05`,
    recurring: true
  }, {
    id: uid(),
    label: "Fitness Mitgliedschaft",
    amount: 0,
    date: `${ym}-05`,
    recurring: true
  }, {
    id: uid(),
    label: "Sonstige Fixkosten",
    amount: 0,
    date: `${ym}-15`,
    recurring: false
  }],
  savings: [{
    id: uid(),
    label: "Tagesgeld",
    amount: 0,
    date: `${ym}-01`
  }, {
    id: uid(),
    label: "ETF / Aktien Sparplan",
    amount: 0,
    date: `${ym}-01`
  }, {
    id: uid(),
    label: "Cominvest",
    amount: 0,
    date: `${ym}-01`
  }, {
    id: uid(),
    label: "Sonstige Investments",
    amount: 0,
    date: `${ym}-01`
  }],
  variable: [{
    id: uid(),
    label: "Lebensmittel",
    entries: []
  }, {
    id: uid(),
    label: "Restaurant",
    entries: []
  }, {
    id: uid(),
    label: "Drogerie",
    entries: []
  }, {
    id: uid(),
    label: "Kleidung",
    entries: []
  }, {
    id: uid(),
    label: "Freizeit",
    entries: []
  }, {
    id: uid(),
    label: "KFZ / Mobilität",
    entries: []
  }, {
    id: uid(),
    label: "Reisen / Urlaub",
    entries: []
  }, {
    id: uid(),
    label: "Sonstige Ausgaben",
    entries: []
  }]
});
const defaultInvestments = () => ({
  purchases: [],
  // { id, name, wkn, kurs, wert, date }
  trades: [],
  // { id, name, kurs, amount, date }  -- amount: + = Gewinn, - = Verlust
  snapshots: [] // { id, value, date } -- optional manual portfolio value snapshots
});
const defaultState = () => {
  const ym = currentYM();
  return {
    currentMonth: ym,
    view: "budget",
    // "budget" | "history" | "investments"
    months: {
      [ym]: defaultMonthData(ym)
    },
    investments: defaultInvestments(),
    receipts: [] // { id, haendler, datum, gesamtbetrag, mwst_19, mwst_7, rechnungsnummer, kategorie, month }
  };
};
const STORAGE_KEY = "ausgaben-trocken-v2";
const LEGACY_KEY = "ausgaben-trocken-v1";

// ── Synchroner Encrypt-Cache für beforeunload ────────────────────────────
// AES-GCM ist async — beforeunload wartet nicht auf Promises.
// Lösung: Cache wird nach jeder erfolgreichen Verschlüsselung sofort befüllt
// (über updateEncryptedCache, kein Debounce). Der beforeunload-Handler schreibt
// dann synchron mit localStorage.setItem aus dem Cache — zuverlässig und ohne
// Race-Condition.
let _encryptedStateCache = null;

// Prüft ob ein localStorage-Wert ein AES-GCM-Blob aus crypto.jsx ist.
// Identisch mit _isEncrypted() in crypto.jsx — hier dupliziert um keine window-Abhängigkeit.
function _isEncryptedBlob(str) {
  if (!str || str[0] !== "{") return false;
  try {
    const o = JSON.parse(str);
    return o && o._v === 1 && typeof o.iv === "string" && typeof o.ct === "string";
  } catch {
    return false;
  }
}

// Build a "skeleton" from previous month: keep labels & day-of-month for fixed/savings,
// reset all amounts to 0 and clear variable entries.
// If keepAmounts is true, fixed and savings amounts are carried over to the new month.
const skeletonFromMonth = (data, newYM, keepAmounts = false) => {
  const reYM = iso => {
    if (!iso) return `${newYM}-01`;
    const day = iso.slice(8, 10) || "01";
    return `${newYM}-${day}`;
  };
  return {
    income: data.income.map(x => ({
      id: uid(),
      label: x.label,
      amount: 0
    })),
    fixed: data.fixed.map(x => ({
      id: uid(),
      label: x.label,
      recurring: x.recurring !== false,
      amount: x.recurring !== false || keepAmounts ? Number(x.amount) || 0 : 0,
      date: reYM(x.date)
    })),
    savings: data.savings.map(x => ({
      id: uid(),
      label: x.label,
      amount: keepAmounts ? Number(x.amount) || 0 : 0,
      date: reYM(x.date)
    })),
    variable: data.variable.map(x => ({
      id: uid(),
      label: x.label,
      budget: Number(x.budget) || 0,
      entries: []
    }))
  };
};

// Get-or-create month data
const ensureMonth = (state, ym) => {
  if (state.months[ym]) return state;
  // Find closest previous month with data; fallback to most recent
  const keys = Object.keys(state.months).sort();
  const before = keys.filter(k => k < ym).pop();
  const reference = before || keys[keys.length - 1];
  // tweaks.keepFixedAmounts wird aus localStorage gelesen falls vorhanden
  let keepAmounts = false;
  try {
    const tweakRaw = localStorage.getItem("ausgaben-tweaks");
    if (tweakRaw) {
      const tweakParsed = JSON.parse(tweakRaw);
      keepAmounts = !!tweakParsed.keepFixedAmounts;
    }
  } catch {}
  const newData = reference ? skeletonFromMonth(state.months[reference], ym, keepAmounts) : defaultMonthData(ym);
  return {
    ...state,
    months: {
      ...state.months,
      [ym]: newData
    }
  };
};
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Verschlüsselter Blob → PIN noch nicht eingegeben. Leeren State zurückgeben;
      // loadStateAsync() wird nach "ausgaben-pin-unlocked" aufgerufen.
      if (_isEncryptedBlob(raw)) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const merged = {
        ...base,
        ...parsed,
        months: {
          ...base.months,
          ...(parsed.months || {})
        },
        investments: {
          ...defaultInvestments(),
          ...(parsed.investments || {})
        },
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : []
      };
      // FIX #4: currentMonth auf aktuellen Monat vorrücken wenn veraltet
      const now = currentYM();
      const savedMonth = merged.currentMonth || now;
      const targetMonth = savedMonth < now ? now : savedMonth;
      return ensureMonth({
        ...merged,
        currentMonth: targetMonth
      }, targetMonth);
    }
    // Migrate from v1 (single month state)
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const v1 = JSON.parse(legacy);
      const ym = v1.month || currentYM();
      return {
        currentMonth: ym,
        view: "budget",
        months: {
          [ym]: {
            income: v1.income || defaultMonthData(ym).income,
            fixed: v1.fixed || defaultMonthData(ym).fixed,
            savings: v1.savings || defaultMonthData(ym).savings,
            variable: v1.variable || defaultMonthData(ym).variable
          }
        },
        investments: defaultInvestments()
      };
    }
    return defaultState();
  } catch {
    return defaultState();
  }
};
const saveState = async s => {
  // ── Autosave-Guard: verschlüsselten Blob niemals mit Klartext überschreiben ──
  // Fix: Wenn ein PIN konfiguriert ist (Verify-Key vorhanden) aber der Schlüssel noch
  // nicht im RAM aktiv ist, wird saveState komplett übersprungen.
  const _VERIFY_KEY_LS = "ausgaben-pin-verify";
  const pinConfigured = !!localStorage.getItem(_VERIFY_KEY_LS);
  const pinUnlocked = typeof window.secureIsUnlocked === "function" && window.secureIsUnlocked();
  if (pinConfigured && !pinUnlocked) return false;
  try {
    const json = JSON.stringify(s);
    const toStore = typeof window.secureChatEncrypt === "function" ? await window.secureChatEncrypt(json) : json;
    localStorage.setItem(STORAGE_KEY, toStore);
    _encryptedStateCache = toStore; // Cache für synchronen beforeunload-Flush aktualisieren
    return true;
  } catch (err) {
    if (err.name === "QuotaExceededError") {
      console.error("[Storage] Quota überschritten:", err);
      window.dispatchEvent(new CustomEvent("storage-quota-exceeded", {
        detail: {
          size: JSON.stringify(s).length
        }
      }));
    }
    return false;
  }
};

// ── Cache sofort aktualisieren (kein Debounce) ─────────────────────────────
// Wird bei jedem State-Change aufgerufen, damit der Cache immer den neuesten
// Stand hat. Schreibt NICHT in localStorage — nur in _encryptedStateCache.
// Das verhindert Datenverlust beim Neuladen, selbst wenn der 500ms-Debounce
// noch nicht gefeuert hat.
const updateEncryptedCache = async s => {
  const _VERIFY_KEY_LS = "ausgaben-pin-verify";
  const pinConfigured = !!localStorage.getItem(_VERIFY_KEY_LS);
  const pinUnlocked = typeof window.secureIsUnlocked === "function" && window.secureIsUnlocked();
  if (pinConfigured && !pinUnlocked) return;
  try {
    const json = JSON.stringify(s);
    _encryptedStateCache = typeof window.secureChatEncrypt === "function" ? await window.secureChatEncrypt(json) : json;
  } catch {/* bei Fehler: Cache bleibt alt, kein Datenverlust */}
};

// ── Synchroner Flush für beforeunload ──────────────────────────────────────
// localStorage.setItem ist synchron — funktioniert zuverlässig im beforeunload-Event.
// Async-Funktionen (wie saveState direkt) werden vom Browser nicht abgewartet.
const saveStateCached = () => {
  if (_encryptedStateCache !== null) {
    try {
      localStorage.setItem(STORAGE_KEY, _encryptedStateCache);
    } catch {}
  }
};

// Asynchrone Variante: entschlüsselt nach PIN-Unlock und gibt den vollen State zurück.
// Wird über das "ausgaben-pin-unlocked"-Event ausgelöst.
const loadStateAsync = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const json = _isEncryptedBlob(raw) && typeof window.secureChatDecrypt === "function" ? await window.secureChatDecrypt(raw) : raw;
    const parsed = JSON.parse(json);
    const base = defaultState();
    const merged = {
      ...base,
      ...parsed,
      months: {
        ...base.months,
        ...(parsed.months || {})
      },
      investments: {
        ...defaultInvestments(),
        ...(parsed.investments || {})
      },
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : []
    };
    const now = currentYM();
    const savedMonth = merged.currentMonth || now;
    const targetMonth = savedMonth < now ? now : savedMonth;
    return ensureMonth({
      ...merged,
      currentMonth: targetMonth
    }, targetMonth);
  } catch {
    return null;
  }
};

// ============ Stock Icon (initials + hash-color) ============
const STOCK_HUES = [25, 60, 100, 155, 200, 240, 280, 320];
const hashStr = s => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
  return Math.abs(h);
};
const stockIconInfo = name => {
  const n = (name || "").trim();
  if (!n) return {
    initials: "—",
    bg: "oklch(0.85 0.01 80)",
    fg: "var(--text-faint)"
  };
  // initials: first letters of up to 2 tokens, fallback first 2 chars
  const tokens = n.split(/[\s\/\-]+/).filter(Boolean);
  let initials;
  if (tokens.length >= 2) initials = (tokens[0][0] + tokens[1][0]).toUpperCase();else initials = n.slice(0, 2).toUpperCase();
  const hue = STOCK_HUES[hashStr(n.toUpperCase()) % STOCK_HUES.length];
  return {
    initials,
    bg: `oklch(0.62 0.13 ${hue})`,
    fg: "#fff"
  };
};
function StockIcon({
  name,
  size = 28
}) {
  const {
    initials,
    bg,
    fg
  } = stockIconInfo(name);
  return /*#__PURE__*/React.createElement("div", {
    className: "stock-icon",
    style: {
      width: size,
      height: size,
      background: bg,
      color: fg,
      fontSize: size * 0.42
    },
    "aria-hidden": "true"
  }, initials);
}

// ============ Amount Input ============
function AmountInput({
  value,
  onChange,
  readOnly = false,
  className = "",
  placeholder
}) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const display = focused ? draft : (Number(value) || 0) === 0 ? placeholder || "—" : fmtEUR(value);
  return /*#__PURE__*/React.createElement("input", {
    className: `row-amount ${className}`,
    type: "text",
    inputMode: "decimal",
    value: display,
    readOnly: readOnly,
    onFocus: e => {
      if (readOnly) return;
      setFocused(true);
      setDraft(Number(value) ? String(value).replace(".", ",") : "");
      setTimeout(() => e.target.select(), 0);
    },
    onChange: e => {
      const v = e.target.value.replace(/[^0-9,.\-]/g, "");
      setDraft(v);
    },
    onBlur: () => {
      setFocused(false);
      const normalized = draft.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(normalized);
      onChange(isNaN(num) ? 0 : num);
    },
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    }
  });
}

// ============ Signed Amount Input (for trades) ============
function SignedAmountInput({
  value,
  onChange,
  className = ""
}) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const v = Number(value) || 0;
  const display = focused ? draft : v === 0 ? "± —" : (v > 0 ? "+ " : "− ") + fmtEUR(Math.abs(v));
  const color = v > 0 ? "var(--accent)" : v < 0 ? "var(--danger)" : "var(--text)";
  return /*#__PURE__*/React.createElement("input", {
    className: `row-amount ${className}`,
    type: "text",
    inputMode: "decimal",
    value: display,
    style: {
      color,
      fontWeight: 700
    },
    onFocus: e => {
      setFocused(true);
      setDraft(v ? String(v).replace(".", ",") : "");
      setTimeout(() => e.target.select(), 0);
    },
    onChange: e => {
      const x = e.target.value.replace(/[^0-9,.\-]/g, "");
      setDraft(x);
    },
    onBlur: () => {
      setFocused(false);
      const normalized = draft.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(normalized);
      onChange(isNaN(num) ? 0 : num);
    },
    onKeyDown: e => {
      if (e.key === "Enter") e.target.blur();
    }
  });
}

// ============ Steuer-Kategorien (DE, Privatpersonen) ============
const STEUER_KATEGORIEN = [{
  id: "werbungskosten",
  label: "Werbungskosten",
  kurz: "WK",
  beschreibung: "Arbeitsmittel, Fahrtkosten zur Arbeit, Fachliteratur, Berufskleidung",
  farbe: "oklch(0.62 0.13 240)",
  bg: "oklch(0.95 0.04 240)"
}, {
  id: "sonderausgaben",
  label: "Sonderausgaben",
  kurz: "SA",
  beschreibung: "Krankenversicherung, Spenden, Kirchensteuer, Haftpflicht- & Unfallversicherung",
  farbe: "var(--accent)",
  bg: "var(--accent-soft)"
}, {
  id: "aussergewoehnlich",
  label: "Außergew. Belastungen",
  kurz: "AB",
  beschreibung: "Arztkosten, Apotheke, Medikamente, Zahnarzt, Brillen, Therapie",
  farbe: "oklch(0.62 0.13 25)",
  bg: "oklch(0.95 0.04 25)"
}, {
  id: "haushaltsnahe",
  label: "Haushaltsnahe DL",
  kurz: "HDL",
  beschreibung: "Reinigung, Gärtner, Haushaltshilfe — Lohnkosten §35a Abs.2 (max. 4.000 €/Jahr Ermäßigung)",
  farbe: "var(--warning)",
  bg: "oklch(0.95 0.04 75)"
}, {
  id: "handwerker",
  label: "Handwerkerleistungen",
  kurz: "HWK",
  beschreibung: "Renovierung, Reparatur, Modernisierung — Lohnkosten §35a Abs.3 (max. 1.200 €/Jahr Ermäßigung)",
  farbe: "oklch(0.62 0.13 45)",
  bg: "oklch(0.95 0.04 45)"
}, {
  id: "privat",
  label: "Privat",
  kurz: "P",
  beschreibung: "Lebensmittel, Restaurant, Kleidung, Freizeit — nicht steuerrelevant",
  farbe: "var(--text-faint)",
  bg: "var(--surface-2)"
}];

// Mapping vom API-Vorschlag auf interne IDs
const STEUERKAT_MAP = {
  "Werbungskosten": "werbungskosten",
  "Sonderausgaben": "sonderausgaben",
  "Außergewöhnliche Belastungen": "aussergewoehnlich",
  "Haushaltsnahe Dienstleistungen": "haushaltsnahe",
  "Haushaltsnahe DL": "haushaltsnahe",
  "Handwerkerleistungen": "handwerker",
  "Handwerker": "handwerker",
  "Handwerker §35a": "handwerker",
  "Privat": "privat"
};

// ============ Export / Import ============
const exportState = async state => {
  // Bilder aus IndexedDB einsammeln und ins Export-JSON einbetten
  let images = {};
  try {
    if (typeof window.idbAllImages === "function") {
      const map = await window.idbAllImages();
      for (const [id, val] of map.entries()) {
        images[id] = {
          dataUrl: val.dataUrl,
          mediaType: val.mediaType
        };
      }
    }
  } catch {}
  const payload = {
    ...state,
    _receiptImages: images,
    _exportVersion: 2
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = todayISO();
  a.href = url;
  a.download = `ausgaben-export-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Feature 4 — CSV-Export der Belege
const exportReceiptsCSV = (receipts, year) => {
  const filtered = (receipts || []).filter(r => (r.datum || r.date || r.month || "").startsWith(String(year)));
  if (filtered.length === 0) {
    alert("Keine Belege für " + year + " vorhanden.");
    return;
  }
  const STEUER_LABELS = {
    werbungskosten: "Werbungskosten (Anlage N)",
    sonderausgaben: "Sonderausgaben",
    aussergewoehnlich: "Außergewöhnliche Belastungen",
    haushaltsnahe: "Haushaltsnahe Leistungen §35a Abs.2",
    handwerker: "Handwerkerleistungen §35a Abs.3",
    privat: "Privat (nicht steuerrelevant)"
  };
  const header = ["Datum", "Händler", "Betrag (€)", "Steuerkategorie", "Budget-Kategorie"];
  const rows = filtered.map(r => [r.datum || r.date || r.month || "", (r.haendler || r.name || "").replace(/,/g, ";"), (Number(r.gesamtbetrag || r.amount) || 0).toFixed(2).replace(".", ","), STEUER_LABELS[r.steuerkat] || r.steuerkat || "", (r.categoryLabel || r.categoryId || "").replace(/,/g, ";")]);
  const csv = [header, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  const BOM = "﻿";
  const blob = new Blob([BOM + csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `belege-${year}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
const importState = (onSuccess, onError) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.months || !parsed.currentMonth) {
          throw new Error("Ungültige Datei – kein gültiger Ausgaben-Export.");
        }
        const base = defaultState();

        // FIX #7: Bilder zurück nach IDB schreiben — vorhandene überspringen
        const images = parsed._receiptImages || {};
        let imgImported = 0,
          imgSkipped = 0;
        try {
          if (typeof window.idbPutImage === "function" && typeof window.idbHasImage === "function") {
            for (const [id, val] of Object.entries(images)) {
              if (!val?.dataUrl) continue;
              const exists = await window.idbHasImage(id);
              if (exists) {
                imgSkipped++;
                continue;
              }
              await window.idbPutImage(id, val.dataUrl, val.mediaType || "image/jpeg");
              imgImported++;
            }
          }
        } catch (e) {
          console.warn("Bild-Import in IDB teilweise fehlgeschlagen:", e);
        }

        // Belege: falls noch Inline-Images im Export sind (alt), auch nach IDB übernehmen
        const receipts = (parsed.receipts || []).map(r => {
          if (r.image && typeof window.idbPutImage === "function") {
            try {
              window.idbPutImage(r.id, r.image, r.imageType || "image/jpeg");
            } catch {}
            const {
              image,
              ...rest
            } = r;
            return {
              ...rest,
              hasImage: true
            };
          }
          return r;
        });
        const merged = {
          ...base,
          ...parsed,
          months: {
            ...base.months,
            ...(parsed.months || {})
          },
          investments: {
            ...defaultInvestments(),
            ...(parsed.investments || {})
          },
          receipts
        };
        // Service-Meta nicht in den State übernehmen
        delete merged._receiptImages;
        delete merged._exportVersion;
        onSuccess(merged, {
          imported: imgImported,
          skipped: imgSkipped
        });
      } catch (err) {
        onError(err.message || "Fehler beim Lesen der Datei.");
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
};

// ════════════════════════════════════════════════════════════════════════
// SHARED OLLAMA CLIENT
// Gemeinsam genutzt von SteuerBot und BudgetBot.
// Konfiguration (URL + Modell) über eine einzige Einstellung, sichtbar
// in beiden Bot-Settings-Panels.
//
// localStorage-Keys:
//   ausgaben-ollama-url   — Basis-URL (default: http://localhost:11434)
//   ausgaben-ollama-model — Modellname (z.B. "llama3.1:8b")
//
// Empfohlene Modelle für MacBook Air M-Chips (16 GB RAM):
//   llama3.1:8b     — Beste Wahl: sehr gutes Deutsch, ~5 GB, schnell
//   mistral:7b      — Alternativ: sehr schnell, gutes Deutsch, ~4 GB
//   gemma3:12b      — Premium: stärker bei Fachthemen, ~8 GB
//   llama3.2:3b     — Mini: sehr schnell, weniger Tiefe, ~2 GB
//
// Empfohlene Modelle für schwächere Hardware (8 GB RAM):
//   llama3.2:3b     — Schnell und stabil
//   mistral:7b      — Gut auf 4-bit-Quant
// ════════════════════════════════════════════════════════════════════════

const OLLAMA_URL_KEY = "ausgaben-ollama-url";
const OLLAMA_MODEL_KEY = "ausgaben-ollama-model";
// Legacy-Key aus alter Steuerbot-Version — wird beim Lesen migriert
const _OLLAMA_LEGACY_MODEL_KEY = "steuerbot-ollama-model";
function getOllamaConfig() {
  let model = localStorage.getItem(OLLAMA_MODEL_KEY) || "";
  // Migration: alter Key aus Steuerbot
  if (!model) {
    const legacy = localStorage.getItem(_OLLAMA_LEGACY_MODEL_KEY) || "";
    if (legacy) {
      localStorage.setItem(OLLAMA_MODEL_KEY, legacy);
      localStorage.removeItem(_OLLAMA_LEGACY_MODEL_KEY);
      model = legacy;
    }
  }
  const url = (localStorage.getItem(OLLAMA_URL_KEY) || "http://localhost:11434").replace(/\/$/, "");
  return {
    url,
    model
  };
}
function setOllamaConfig({
  url,
  model
}) {
  if (url !== undefined) localStorage.setItem(OLLAMA_URL_KEY, url);
  if (model !== undefined) {
    if (model) {
      localStorage.setItem(OLLAMA_MODEL_KEY, model);
    } else {
      localStorage.removeItem(OLLAMA_MODEL_KEY);
    }
  }
}

/**
 * ollamaStream — Sendet eine Anfrage an Ollama und ruft onToken für jeden
 * empfangenen Token auf. Gibt den vollständigen Text zurück wenn fertig.
 *
 * @param {string}   url        — Basis-URL (z.B. http://localhost:11434)
 * @param {string}   model      — Modellname
 * @param {string}   system     — System-Prompt
 * @param {Array}    messages   — [{role, content}] Gesprächshistorie
 * @param {Function} onToken    — Callback(partialText) — wird mit dem
 *                                bisher akkumulierten Text aufgerufen
 * @param {number}   [timeoutMs=90000] — Timeout in ms
 * @returns {Promise<string>}   — Vollständiger Antworttext
 */
async function ollamaStream(url, model, system, messages, onToken, timeoutMs = 90000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "system",
        content: system
      }, ...messages],
      stream: true
    }),
    signal: ctrl.signal
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  // requestAnimationFrame-Batching: UI-Update maximal 1× pro Frame
  let rafId = null;
  const flush = () => {
    const snap = accumulated;
    onToken && onToken(snap);
    rafId = null;
  };
  try {
    while (true) {
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {
        stream: true
      });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // unvollständige letzte Zeile aufheben

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            accumulated += token;
            if (!rafId) rafId = requestAnimationFrame(flush);
          }
        } catch {/* ungültiges JSON-Fragment — überspringen */}
      }
    }
  } finally {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    reader.releaseLock();
  }

  // Letztes Update garantieren
  if (onToken) onToken(accumulated);
  return accumulated;
}

/**
 * ollamaTest — Kurztest ob Ollama erreichbar ist und das Modell antwortet.
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
async function ollamaTest(url, model) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "llama3.1:8b",
        messages: [{
          role: "user",
          content: "Antworte nur: OK"
        }],
        stream: false,
        max_tokens: 5
      }),
      signal: ctrl.signal
    });
    if (!res.ok) return {
      ok: false,
      msg: `HTTP ${res.status} — Modell "${model}" geladen?`
    };
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "";
    return {
      ok: true,
      msg: `✓ Ollama antwortet: "${reply.slice(0, 30)}"`
    };
  } catch (e) {
    if (e?.name === "AbortError") return {
      ok: false,
      msg: "Timeout — läuft ollama serve?"
    };
    return {
      ok: false,
      msg: `Nicht erreichbar: ${e?.message || e}`
    };
  }
}
(function _secureExport() {
  const _defs = {
    uid,
    fmtEUR,
    fmtEURsigned,
    fmtDate,
    todayISO,
    monthLabel,
    getPeriodRange,
    shiftMonth,
    currentYM,
    Icon,
    defaultState,
    defaultMonthData,
    defaultInvestments,
    skeletonFromMonth,
    ensureMonth,
    loadState,
    loadStateAsync,
    saveState,
    updateEncryptedCache,
    saveStateCached,
    STORAGE_KEY,
    AmountInput,
    SignedAmountInput,
    stockIconInfo,
    StockIcon,
    exportState,
    importState,
    exportReceiptsCSV,
    STEUER_KATEGORIEN,
    STEUERKAT_MAP,
    getOllamaConfig,
    setOllamaConfig,
    ollamaStream,
    ollamaTest,
    OLLAMA_URL_KEY,
    OLLAMA_MODEL_KEY
  };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v,
        writable: false,
        configurable: false,
        enumerable: true
      });
    } catch {
      window[k] = v;
    }
  }
})();
