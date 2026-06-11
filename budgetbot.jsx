/* global React, Icon, fmtEUR, uid, monthLabel, shiftMonth, currentYM */
//
// ════════════════════════════════════════════════════════════════════════
// BudgetBot — Deterministischer Finanzcoach (kein KI, kein Datenleck)
// ════════════════════════════════════════════════════════════════════════
//
// • Modal, geöffnet über FAB im Budget-Tab.
// • Bedarfsanalyse: Netto-Einkommen, Sparziel, Notgroschen, Ziele.
// • Alert-Engine: regelbasiert, analysiert Monate-Historie lokal.
// • Backend: Ausschließlich deterministischer Fallback — kein Proxy,
//   kein Cloud-Dienst, keine externen APIs.
// • Alle Daten (Profil, Chats) mit AES-256-GCM verschlüsselt —
//   identisch zum Steuerbot (window.secureChatEncrypt / Decrypt).
// • Chat-Persistenz in separater IndexedDB.
//

// ════════════════════════════════════════════════════════════════════════
// Storage-Keys
// ════════════════════════════════════════════════════════════════════════
const BEDARFSANALYSE_KEY = "ausgaben-bedarfsanalyse";
const BUDGET_CHATS_DB    = "ausgaben-trocken-budget-chats";
const BUDGET_CHATS_VER   = 1;
const BUDGET_CHATS_STORE = "budget-chats";

// ════════════════════════════════════════════════════════════════════════
// Bedarfsanalyse — verschlüsselter Lese-/Schreibzugriff
// ════════════════════════════════════════════════════════════════════════
function _isBudgetEncryptedBlob(str) {
  if (!str) return false;
  try { const o = JSON.parse(str); return o && o._v === 1 && o.iv && o.ct; }
  catch { return false; }
}

async function loadBedarfsanalyse() {
  try {
    const raw = localStorage.getItem(BEDARFSANALYSE_KEY);
    if (!raw) return null;
    let json = raw;
    if (_isBudgetEncryptedBlob(raw) && typeof window.secureChatDecrypt === "function") {
      json = await window.secureChatDecrypt(raw);
    }
    return JSON.parse(json);
  } catch { return null; }
}

async function saveBedarfsanalyse(profil) {
  try {
    const json = JSON.stringify({ ...profil, aktualisiert: Date.now() });
    const blob = typeof window.secureChatEncrypt === "function"
      ? await window.secureChatEncrypt(json)
      : json;
    localStorage.setItem(BEDARFSANALYSE_KEY, blob);
    // Alert-Panel und BudgetView informieren, dass Profil aktualisiert wurde
    window.dispatchEvent(new CustomEvent("budget-profil-updated"));
  } catch {}
}

// ════════════════════════════════════════════════════════════════════════
// IndexedDB — Chat-Persistenz (verschlüsselt)
// ════════════════════════════════════════════════════════════════════════
let _budgetChatsDbPromise = null;
function _openBudgetChatsDb() {
  if (_budgetChatsDbPromise) return _budgetChatsDbPromise;
  _budgetChatsDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB n/a")); return; }
    const req = indexedDB.open(BUDGET_CHATS_DB, BUDGET_CHATS_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BUDGET_CHATS_STORE))
        db.createObjectStore(BUDGET_CHATS_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => { _budgetChatsDbPromise = null; reject(req.error); };
  });
  return _budgetChatsDbPromise;
}

async function budgetChatPut(chat) {
  let toStore = chat;
  if (typeof window.secureChatEncrypt === "function") {
    try {
      const plain = JSON.stringify(chat.messages);
      const enc   = await window.secureChatEncrypt(plain);
      const did   = enc !== plain;
      toStore = { ...chat, messages: enc, _msgEnc: did };
    } catch {}
  }
  const db = await _openBudgetChatsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(BUDGET_CHATS_STORE, "readwrite");
    const r  = tx.objectStore(BUDGET_CHATS_STORE).put(toStore);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

async function budgetChatDelete(id) {
  const db = await _openBudgetChatsDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(BUDGET_CHATS_STORE, "readwrite");
    const r  = tx.objectStore(BUDGET_CHATS_STORE).delete(id);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

async function budgetChatList() {
  try {
    const db  = await _openBudgetChatsDb();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(BUDGET_CHATS_STORE, "readonly");
      const r  = tx.objectStore(BUDGET_CHATS_STORE).getAll();
      r.onsuccess = () => {
        const items = r.result || [];
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        res(items);
      };
      r.onerror = () => rej(r.error);
    });
    for (const c of all) {
      if (c._msgEnc && typeof c.messages === "string" && typeof window.secureChatDecrypt === "function") {
        try   { c.messages = JSON.parse(await window.secureChatDecrypt(c.messages)); }
        catch { c.messages = []; }
      } else if (!Array.isArray(c.messages)) {
        try   { c.messages = JSON.parse(c.messages); } catch { c.messages = []; }
      }
    }
    return all;
  } catch { return []; }
}

// ════════════════════════════════════════════════════════════════════════
// ALERT ENGINE — rein deterministisch, kein KI
// ════════════════════════════════════════════════════════════════════════

function _getMonthTotals(monthData) {
  const income   = (monthData.income   || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const fixed    = (monthData.fixed    || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const savings  = (monthData.savings  || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const variable = (monthData.variable || []).reduce((s, cat) =>
    s + (cat.entries || []).reduce((cs, e) => cs + (Number(e.amount) || 0), 0), 0);
  return { income, fixed, savings, variable, total: fixed + savings + variable };
}

function _getCatSpent(monthData, catId) {
  const cat = (monthData.variable || []).find(c => c.id === catId);
  if (!cat) return 0;
  return (cat.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

function _getLast3Months(state) {
  const cur = state.currentMonth;
  if (!cur) return [];
  const result = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const ym = shiftMonth(cur, -i);
      if (ym && state.months?.[ym]) result.push(state.months[ym]);
    } catch { break; }
  }
  return result;
}

function computeBudgetAlerts(state, profil) {
  const alerts = [];
  const monthData = state.months?.[state.currentMonth];
  if (!monthData) return alerts;

  const { income, fixed, savings, variable, total } = _getMonthTotals(monthData);
  const remaining = income - total;

  // ─── PRIO 1: KRITISCH (rot) ───────────────────────────────────────────

  if (income > 0 && remaining < 0) {
    alerts.push({
      id: "budget_ueberschritten", prio: 1,
      farbe: "var(--negative, #e03)", icon: "🚨",
      text: `Budget ${fmtEUR(Math.abs(remaining))} überschritten – du gibst mehr aus als du einnimmst.`,
      aktion: "Was kann ich kürzen?",
    });
  }

  if (profil?.sparZielMonatlich > 0 && income > 0 && savings < profil.sparZielMonatlich * 0.5) {
    alerts.push({
      id: "sparziel_kritisch", prio: 1,
      farbe: "var(--negative, #e03)", icon: "⚠️",
      text: `Du sparst gerade ${fmtEUR(savings)} – dein Ziel ist ${fmtEUR(profil.sparZielMonatlich)}. ${savings === 0 ? "Noch nichts angespart." : `${Math.round(savings / profil.sparZielMonatlich * 100)}% des Ziels.`}`,
      aktion: "Wie erreiche ich mein Sparziel?",
    });
  }

  // ─── PRIO 2: WARNUNG (orange) ─────────────────────────────────────────

  for (const cat of monthData.variable || []) {
    const budget = Number(cat.budget) || 0;
    if (budget <= 0) continue;
    const spent = _getCatSpent(monthData, cat.id);
    const pct   = spent / budget;
    if (pct >= 1.1) {
      alerts.push({
        id: `kat_ueber_${cat.id}`, prio: 2,
        farbe: "var(--warning, #f80)", icon: "📊",
        text: `"${cat.label}" liegt ${Math.round((pct - 1) * 100)}% über Budget (${fmtEUR(spent)} von ${fmtEUR(budget)}).`,
        aktion: `Tipps für "${cat.label}"`,
      });
    }
  }

  if (income > 0 && fixed / income > 0.5) {
    alerts.push({
      id: "fixkosten_hoch", prio: 2,
      farbe: "var(--warning, #f80)", icon: "🔒",
      text: `Fixkosten sind ${Math.round(fixed / income * 100)}% deines Einkommens. Empfehlung: maximal 50%.`,
      aktion: "Wie reduziere ich Fixkosten?",
    });
  }

  if (profil?.sparZielMonatlich > 0 && income > 0) {
    const ziel = profil.sparZielMonatlich;
    if (savings >= ziel * 0.5 && savings < ziel) {
      alerts.push({
        id: "sparziel_knapp", prio: 2,
        farbe: "var(--warning, #f80)", icon: "💰",
        text: `Du sparst ${fmtEUR(savings)} – noch ${fmtEUR(ziel - savings)} bis zu deinem Monatsziel von ${fmtEUR(ziel)}.`,
        aktion: "Sparziel im Detail",
      });
    }
  }

  // Wiederholungsmuster
  const prevMonths = _getLast3Months(state).slice(0, 2);
  for (const cat of monthData.variable || []) {
    const budget = Number(cat.budget) || 0;
    if (budget <= 0) continue;
    const spent = _getCatSpent(monthData, cat.id);
    if (spent <= budget) continue;
    let overCount = 0;
    for (const prevData of prevMonths) {
      if (_getCatSpent(prevData, cat.id) > budget) overCount++;
    }
    if (overCount >= 2) {
      alerts.push({
        id: `muster_${cat.id}`, prio: 2,
        farbe: "var(--warning, #f80)", icon: "🔁",
        text: `"${cat.label}" überschreitet das Budget seit 3 Monaten – könnte ein Zeichen sein, das Budget anzupassen.`,
        aktion: `Budget für "${cat.label}" anpassen`,
      });
    }
  }

  // ─── PRIO 3: TIPPS (blau) ────────────────────────────────────────────

  for (const cat of monthData.variable || []) {
    const budget = Number(cat.budget) || 0;
    if (budget <= 0) continue;
    const spent = _getCatSpent(monthData, cat.id);
    const pct   = spent / budget;
    if (pct >= 0.8 && pct < 1.1) {
      alerts.push({
        id: `kat_nahe_${cat.id}`, prio: 3,
        farbe: "var(--accent)", icon: "📍",
        text: `"${cat.label}" zu ${Math.round(pct * 100)}% ausgeschöpft – noch ${fmtEUR(budget - spent)} übrig.`,
        aktion: null,
      });
    }
  }

  if (income === 0 && (fixed > 0 || variable > 0)) {
    alerts.push({
      id: "einkommen_fehlt", prio: 3,
      farbe: "var(--accent)", icon: "💡",
      text: "Kein Einkommen eingetragen – trage dein Nettoeinkommen ein für eine vollständige Budgetanalyse.",
      aktion: "Warum ist Einkommen wichtig?",
    });
  }

  if (income > 0 && savings === 0 && !profil?.sparZielMonatlich) {
    alerts.push({
      id: "kein_sparziel", prio: 3,
      farbe: "var(--accent)", icon: "🎯",
      text: "Du hast noch kein Sparziel. Schon 10–20% des Einkommens zu sparen kann langfristig viel bewirken.",
      aktion: "Sparziel einrichten",
    });
  }

  if (!profil && income > 0) {
    alerts.push({
      id: "kein_profil", prio: 3,
      farbe: "var(--accent)", icon: "",
      text: "Richte dein Finanzprofil ein – dann berechne ich dir ein persönliches Budget und erkenne Muster.",
      aktion: "Finanzprofil einrichten",
    });
  }

  const hasCritical = alerts.some(a => a.prio <= 2);
  if (!hasCritical && income > 0 && total <= income) {
    alerts.push({
      id: "alles_ok", prio: 4,
      farbe: "oklch(0.46 0.15 148)", icon: "✅",
      text: `Alles im grünen Bereich! ${fmtEUR(remaining)} übrig – weiter so.`,
      aktion: null,
    });
  }

  alerts.sort((a, b) => a.prio - b.prio);
  return alerts.slice(0, 5);
}

// ════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ════════════════════════════════════════════════════════════════════════
function buildBudgetContext(state, profil) {
  const monthData = state.months?.[state.currentMonth];
  if (!monthData) return { profil, monthData: null, totals: null, cats: [], history: [], currentMonth: state.currentMonth };

  const totals = _getMonthTotals(monthData);
  const cats = (monthData.variable || []).map(cat => {
    const spent  = _getCatSpent(monthData, cat.id);
    const budget = Number(cat.budget) || 0;
    return { id: cat.id, label: cat.label, spent, budget, pct: budget > 0 ? spent / budget : null };
  });

  const history = _getLast3Months(state).map(md => ({
    totals: _getMonthTotals(md),
    cats: (md.variable || []).map(c => ({
      id: c.id, label: c.label,
      spent: _getCatSpent(md, c.id),
      budget: Number(c.budget) || 0,
    })),
  }));

  return { profil, monthData, totals, cats, history, currentMonth: state.currentMonth };
}

// ════════════════════════════════════════════════════════════════════════
// INTENT-ERKENNUNG
// ════════════════════════════════════════════════════════════════════════
const _BUDGET_INTENTS = [
  { key: "hilfe",          re: /^(hilfe|help|\?+$|was kannst|themen|übersicht|wie funktioniert|womit kann|fangen wir an|los geht|starten|start|zeig.*optionen)/i },
  { key: "budget_check",   re: /budget.?(analyse|check|übersicht|status|wie\s+stehe|wie\s+lieg)|mein.*budget|budget.*monat|wie.*ausgaben|ausgaben.*überblick|was.*ausgegeben|monatsbilanz|monat.*analyse/i },
  { key: "sparziel",       re: /sparz(iel|rate|en)|wie\s+viel.*spar|spar.*ziel|spare.*monat|monat.*spar|rücklage.*spar|zurücklegen|spare.*zu\s+wenig|zu\s+wenig.*spar/i },
  { key: "fixkosten",      re: /fixkosten|fixe.*kosten|feste.*kosten|monatliche.*kosten|abo.*fix|miete.*fix|versicherung.*monat|fix.*senken|fix.*reduzier/i },
  { key: "kategorie",      re: /kategorie|rubrik|bereich|wofür.*geld|wo.*ausgib|wohin.*geld|welche.*kategorie|am\s+meisten.*ausgib|meiste.*geld/i },
  { key: "restaurant",     re: /restaurant|essen.*gehen|auswärts.*essen|gastronomie|food.*delivery|lieferando|uber\s*eats|takeaway|pizza\s+bestell/i },
  { key: "einkaufen",      re: /einkauf|supermarkt|lebensmittel|aldi|lidl|rewe|edeka|wocheneinkauf/i },
  { key: "abo",            re: /\babo(s)?\b|abonnement|subscription|netflix|spotify|amazon\s+prime|disney|streaming|wiederkehr/i },
  { key: "transport",      re: /transport|tanken|benzin|parkplatz|öpnv|fahrtkosten|auto.*kosten/i },
  { key: "freizeit",       re: /freizeit|hobby|sport|unterhaltung|kino|konzert|ausgehen|entertainment/i },
  { key: "notgroschen",    re: /notgroschen|notfallfonds|emergency.*fund|absicherung|sicherheit.*geld|puffer|sicherheitsnetz/i },
  { key: "50_30_20",       re: /50.?30.?20|budgetregel|budgetmethode|wie\s+teile.*ein|budget.*aufteilen|aufteilung.*budget/i },
  { key: "ziel_check",     re: /ziel.*status|wie\s+weit.*ziel|fortschritt.*ziel|ziel.*erreich|wann.*ziel|sparziel.*fortschritt/i },
  { key: "muster",         re: /muster|trend|entwicklung|immer.*zu\s+viel|regelmäßig.*überschreit|monat.*vergleich/i },
  { key: "optimierung",    re: /optimier|wo.*sparen|tipps?.*budget|budget.*tipp|was.*reduzier|kosten.*senken|einsparen|haushalt.*optimier/i },
  { key: "forecast",       re: /prognose|hochrechnung|bis\s+ende.*monat|monatsende|wie\s+viel.*noch|noch\s+wie\s+viel|forecast/i },
  { key: "bedarfsanalyse", re: /bedarfsanalyse|finanzprofil|profil.*einrichten|profil.*ändern|profil.*aktualisier|meine.*daten\s*ändern|einkommen.*ändern/i },
  { key: "ueberschuss",    re: /überschuss|übrig\s+bleibt|was\s+mach.*restl|restl.*geld|geld\s+übrig|was\s+tun.*plus/i },
  { key: "schulden",       re: /schulden|kredit|dispo|abzahlen|schulden.*tilgen|tilgung/i },
  { key: "versicherung",   re: /versicherung|haftpflicht|hausrat|kfz.*versicherung|versicherung.*lohnt/i },
];

const _BUDGET_KEYWORDS = {
  budget_check:   ["ausgaben","ausgegeben","budget","monat","zusammenfassung","status","überblick","bilanz"],
  sparziel:       ["sparen","spare","sparziel","rücklage","sparrate","gespart","sparbetrag"],
  fixkosten:      ["fix","fest","monatlich","miete","abo","abonnement","versicherung","strom","internet"],
  optimierung:    ["optimier","tipp","sparen","reduzier","senken","einsparen","günstiger","haushalt"],
  kategorie:      ["kategorie","rubrik","bereich","wofür","welche"],
  restaurant:     ["restaurant","essen","gastronomie","lieferung","pizza","sushi"],
  transport:      ["auto","bahn","bus","tank","benzin","fahrt","transport"],
  notgroschen:    ["notgroschen","rücklage","reserve","absicherung","sicherheit"],
  forecast:       ["prognose","bis","monatsende","hochrechnung","erwart"],
};

function detectBudgetIntent(input) {
  const lower = input.toLowerCase().trim();
  for (const { key, re } of _BUDGET_INTENTS) {
    if (re.test(lower)) return key;
  }
  let best = "hilfe", bestScore = 0;
  for (const [intent, keywords] of Object.entries(_BUDGET_KEYWORDS)) {
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = intent; }
  }
  if (bestScore >= 1) return best;
  return "hilfe";
}

// ════════════════════════════════════════════════════════════════════════
// OLLAMA BACKEND — System-Prompt + Konfiguration
// Wird von handleSend im BudgetBotModal verwendet.
// Konfiguration (URL + Modell) wird über window.getOllamaConfig / setOllamaConfig
// aus utils.jsx verwaltet (geteilt mit SteuerBot).
// ════════════════════════════════════════════════════════════════════════

// Eingabe-Längenlimit (~250 Wörter / 1500 Zeichen)
const BUDGET_MAX_INPUT_CHARS = 1500;

function buildBudgetSystemPrompt(ctx) {
  const { profil, totals, cats, currentMonth } = ctx;
  const monat = currentMonth ? currentMonth : "aktueller Monat";

  let profilSection = "Es liegt kein Finanzprofil vor.";
  if (profil) {
    profilSection = `Finanzprofil des Nutzers:
- Netto-Einkommen: ${profil.nettoEinkommen ? profil.nettoEinkommen + " €/Monat" : "unbekannt"}
- Monatliches Sparziel: ${profil.sparZielMonatlich ? profil.sparZielMonatlich + " €" : "unbekannt"}
- Notgroschen-Ziel: ${profil.notgroschenZiel ? profil.notgroschenZiel + " €" : "unbekannt"}
- Wohnkosten (Fixkosten): ${profil.fixkostenMiete ? profil.fixkostenMiete + " €/Monat" : "unbekannt"}
- Monatliche Abos/Abonnements: ${profil.fixkostenAbos ? profil.fixkostenAbos + " €/Monat" : "unbekannt"}
- Finanzielle Ziele: ${profil.finanzielleZiele?.join(", ") || "keine angegeben"}`;
  }

  let budgetSection = "Keine Ausgabedaten für diesen Monat verfügbar.";
  if (totals) {
    const catList = (cats || []).map(c =>
      `  • ${c.label}: ${c.spent.toFixed(2)} € ausgegeben (Budget: ${c.budget.toFixed(2)} €, ${c.budget > 0 ? ((c.spent/c.budget)*100).toFixed(0)+"%" : "–"})`
    ).join("\n");
    budgetSection = `Monat: ${monat}
Gesamteinnahmen: ${(totals.einnahmen || 0).toFixed(2)} €
Fixkosten gesamt: ${(totals.fixkostenGesamt || 0).toFixed(2)} €
Variable Ausgaben gesamt: ${(totals.varGesamt || 0).toFixed(2)} €
Sparquote dieser Monat: ${(totals.sparquote || 0).toFixed(1)} %
Kategorien (variable Ausgaben):\n${catList || "  (keine Kategorien)"}`;
  }

  return `Du bist BudgetBot — ein persönlicher, ehrlicher Finanzcoach für deutsche Privatpersonen.
Du hilfst beim Verstehen von Ausgaben, Budgets und Sparzielen. Du sprichst Deutsch, bist freundlich aber direkt.
Du gibst konkrete Zahlen und Empfehlungen — keine allgemeinen Floskeln.
Du analysierst ausschließlich die bereitgestellten lokalen Daten des Nutzers. Keine externen Quellen, keine Spekulationen.
Du weist darauf hin, wenn Daten fehlen, um eine fundierte Antwort zu geben.

${profilSection}

${budgetSection}

Regeln:
- Antworte präzise und auf Deutsch
- Verweise auf konkrete Zahlen aus den Daten
- Gib bei Überschreitungen sofort Handlungsempfehlungen
- Erkläre Fachbegriffe kurz wenn nötig
- Keine langen Begrüßungen, direkt zur Sache
- Keine Daten an externe Dienste weitergeben (du läufst lokal)`;
}

function detectBudgetBackend() {
  const cfg = (typeof window.getOllamaConfig === "function") ? window.getOllamaConfig() : {};
  if (cfg.model) return { type: "ollama", label: `Ollama (${cfg.model})` };
  return { type: "fallback", label: "Offline-Modus" };
}

// ════════════════════════════════════════════════════════════════════════
// DETERMINISTISCHER BUDGET-BERATER KERN
// ════════════════════════════════════════════════════════════════════════
function deterministicBudgetAntwort(input, ctx) {
  const intent = detectBudgetIntent(input);
  const { profil, totals, cats, history, currentMonth } = ctx;
  const monat  = currentMonth ? monthLabel(currentMonth) : "aktueller Monat";

  const noData = (what = "Budgetdaten") =>
    `Ich konnte keine ${what} für ${monat} finden. Trage zuerst Einkommen und Ausgaben ein, dann kann ich dir konkrete Analysen liefern.`;

  switch (intent) {

    case "hilfe": return `**BudgetBot – Dein Finanzcoach**

Ich bin rein deterministisch – kein KI, kein Internet, keine Datenweitergabe. Alles läuft lokal auf deinem Gerät.

**Was ich kann:**
- Budget-Check: Wie stehe ich diesen Monat da?
- Kategorie-Analyse: Wo gebe ich zu viel aus?
- Sparziels-Status: Erreiche ich mein Monatsziel?
- Optimierungstipps: Wo kann ich sparen?
- Fixkosten-Check: Sind meine Fixkosten zu hoch?
- Notgroschen: Wie viel Rücklage brauche ich?
- Prognose: Was bleibt bis Monatsende übrig?
- Bedarfsanalyse: Finanzprofil einrichten

**Probier z.B.:**
- "Wie sieht mein Budget aus?"
- "Wo kann ich sparen?"
- "Wie weit bin ich mit meinem Sparziel?"
- "Was mache ich mit dem Überschuss?"`;

    case "budget_check": {
      if (!totals) return noData();
      const { income, fixed, savings, variable, total } = totals;
      const remaining = income - total;
      const spentPct  = income > 0 ? Math.round(total / income * 100) : 0;

      const catLines = cats.length > 0
        ? cats.map(c => `  ${c.label}: ${fmtEUR(c.spent)}${c.budget > 0 ? ` / ${fmtEUR(c.budget)} (${c.pct ? Math.round(c.pct * 100) : 0}%)` : ""}`).join("\n")
        : "  (keine variablen Kategorien erfasst)";

      let bewertung = "";
      if (income === 0)         bewertung = "⚠️ Kein Einkommen erfasst – Bilanz unvollständig.";
      else if (remaining < 0)   bewertung = `🚨 Budget überschritten um ${fmtEUR(Math.abs(remaining))}.`;
      else if (spentPct > 90)   bewertung = `⚠️ Du hast ${spentPct}% deines Einkommens verplant – wenig Puffer.`;
      else if (spentPct < 70)   bewertung = `✅ Du bist gut dabei – ${spentPct}% verplant, ${fmtEUR(remaining)} frei.`;
      else                      bewertung = `👍 Solide: ${spentPct}% verplant, ${fmtEUR(remaining)} übrig.`;

      return `**Budget-Check – ${monat}**

${bewertung}

    Einnahmen:        ${fmtEUR(income)}
    − Fixkosten:      ${fmtEUR(fixed)}
    − Sparen:         ${fmtEUR(savings)}
    − Variable:       ${fmtEUR(variable)}
    = Übrig:          ${fmtEUR(remaining)}

**Variable Kategorien:**
${catLines}

${profil?.sparZielMonatlich ? `Dein Sparziel: ${fmtEUR(profil.sparZielMonatlich)} – du sparst gerade ${fmtEUR(savings)}.` : "Kein Sparziel hinterlegt."}`;
    }

    case "sparziel": {
      if (!totals) return noData();
      const { income, savings } = totals;
      const ziel = profil?.sparZielMonatlich || 0;

      if (!ziel) {
        const empfehlung = income > 0 ? Math.round(income * 0.2) : 0;
        return `Du hast noch kein Sparziel hinterlegt.

**Empfehlung nach der 50/30/20-Regel:**
Spare 20% deines Nettoeinkommens${income > 0 ? ` = ${fmtEUR(empfehlung)}/Monat` : ""}.

Aktuell sparst du ${fmtEUR(savings)}/Monat.
Richte dein Finanzprofil ein (über den "Profil einrichten"-Button), um gezielte Tipps zu bekommen.`;
      }

      const erreicht = savings >= ziel;
      const pct  = Math.round(savings / ziel * 100);
      const diff = ziel - savings;
      let tipp = "";
      if (!erreicht && totals.total < income) {
        const ueberschuss = income - totals.total;
        if (ueberschuss >= diff) {
          tipp = `\nGute Nachricht: Du hast noch ${fmtEUR(ueberschuss)} unverplant – davon ${fmtEUR(diff)} in dein Sparziel legen würde es erfüllen.`;
        } else {
          tipp = `\nFür die fehlenden ${fmtEUR(diff)} müsstest du variable Ausgaben reduzieren.`;
        }
      }

      return `**Sparziel-Status – ${monat}**

${erreicht ? `✅ Sparziel erreicht!` : `⏳ ${pct}% erreicht`}

    Ziel:      ${fmtEUR(ziel)}/Monat
    Aktuell:   ${fmtEUR(savings)}
    ${erreicht ? `Überschuss: +${fmtEUR(savings - ziel)}` : `Fehlend:   ${fmtEUR(diff)}`}
${tipp}
${income > 0 ? `\nSparrate: ${Math.round(savings / income * 100)}% des Einkommens.` : ""}`;
    }

    case "fixkosten": {
      if (!totals) return noData();
      const { income, fixed } = totals;
      const fixPct = income > 0 ? Math.round(fixed / income * 100) : 0;

      const bewertung = fixPct === 0 ? "Keine Fixkosten erfasst." :
        fixPct <= 35 ? `✅ Fixkosten niedrig (${fixPct}%) – guter Handlungsspielraum.` :
        fixPct <= 50 ? `👍 Fixkosten moderat (${fixPct}%) – noch im Rahmen.` :
        `⚠️ Fixkosten hoch (${fixPct}%) – über 50% gelten als kritisch.`;

      return `**Fixkosten-Analyse – ${monat}**

${bewertung}

    Fixkosten:   ${fmtEUR(fixed)}
    ${income > 0 ? `Einkommen:   ${fmtEUR(income)}\n    Anteil:      ${fixPct}%` : "(kein Einkommen erfasst)"}

**Wie Fixkosten senken?**
- Abonnements prüfen: Welche nutzt du wirklich?
- Versicherungen vergleichen (Haftpflicht, KFZ)
- Strom/Gas-Anbieter wechseln
- Mitgliedschaften kündigen, die kaum genutzt werden

${fixPct > 50 ? "⚠️ Mit über 50% Fixkostenanteil hast du wenig Flexibilität." : ""}`;
    }

    case "kategorie": {
      if (!cats.length) return noData("Kategoriedaten");
      const sorted = [...cats].sort((a, b) => b.spent - a.spent);
      const top3 = sorted.slice(0, 3);
      const lines = top3.map((c, i) => `${i + 1}. "${c.label}": ${fmtEUR(c.spent)}${c.budget > 0 ? ` (${Math.round(c.pct * 100)}% des Budgets)` : ""}`).join("\n");
      const overBudget = cats.filter(c => c.budget > 0 && c.pct >= 1);
      const overLines = overBudget.length > 0
        ? "\n**Kategorien über Budget:**\n" + overBudget.map(c => `- "${c.label}": ${fmtEUR(c.spent)} von ${fmtEUR(c.budget)} (${Math.round(c.pct * 100)}%)`).join("\n")
        : "\n✅ Alle Kategorien im Budget.";

      return `**Kategorie-Übersicht – ${monat}**

**Top-Ausgaben:**
${lines}
${overLines}

Frag mich gezielt, z.B. "Tipps für Restaurants" oder "Wie spare ich beim Einkaufen?"`;
    }

    case "restaurant": {
      const cat = cats.find(c => c.label?.toLowerCase().includes("restaurant") || c.label?.toLowerCase().includes("essen"));
      const spent = cat ? cat.spent : 0;
      const budget = cat ? cat.budget : 0;

      return `**Ausgaben Essen & Restaurant${monat ? ` – ${monat}` : ""}**

${spent > 0 ? `Du hast ${fmtEUR(spent)} für Restaurants/Essen ausgegeben${budget > 0 ? ` (${Math.round(spent / budget * 100)}% des Budgets)` : ""}.` : "Noch keine Restaurantausgaben erfasst."}

**Spar-Tipps:**
- Meal-Prep: Vorkochen spart bis zu 60% gegenüber täglich Essen gehen
- Mittagessen: Selbst mitbringen = ~200–300 €/Monat gespart
- Delivery-Apps: Lieferdienste kosten durch Gebühren 30–40% mehr als direkt abholen
- "No-Spend"-Tage: 2× pro Woche bewusst zuhause essen
- Budgetregel: Maximal 10–15% des Einkommens für Essen außer Haus

${budget > 0 && spent > budget ? `⚠️ Du hast dein Restaurant-Budget um ${fmtEUR(spent - budget)} überschritten.` : ""}`;
    }

    case "einkaufen": {
      const cat = cats.find(c => c.label?.toLowerCase().includes("einkauf") || c.label?.toLowerCase().includes("lebensmittel"));
      const spent = cat ? cat.spent : 0;

      return `**Einkaufen & Lebensmittel${monat ? ` – ${monat}` : ""}**

${spent > 0 ? `Erfasste Lebensmittelausgaben: ${fmtEUR(spent)}` : "Noch keine Einkaufsausgaben erfasst."}

**Tipps für weniger Ausgaben:**
- Einkaufsliste führen – verhindert Spontankäufe
- Nicht hungrig einkaufen
- Eigenmarken: Qualitativ meist gleich, 20–40% günstiger
- Wocheneinkauf statt täglich – weniger Spontankäufe
- Meal-Plan: Woche planen → weniger Wegwerfen → weniger Nachkaufen
- Saisonales Gemüse und Obst ist oft günstiger

**Faustregel:** Pro Person ca. 200–300 €/Monat für Lebensmittel.`;
    }

    case "abo": return `**Abonnements & wiederkehrende Kosten**

Abos sind die häufigste Quelle "unsichtbarer" Ausgaben.

**Typische Abo-Kostenfallen:**
- Streaming (Netflix, Disney+, Amazon): 8–18 €/Monat je Dienst
- Musikstreaming (Spotify, Apple Music): 10–12 €/Monat
- Cloud-Speicher (iCloud, Google One): 3–10 €/Monat
- Fitnessstudio: 20–80 €/Monat
- Software-Abos: Adobe, MS365 etc.

**Abo-Audit – so geht's:**
1. Kontoauszug der letzten 3 Monate prüfen
2. Alle monatlichen Abzüge auflisten
3. Für jedes Abo fragen: "Benutze ich das wirklich regelmäßig?"
4. Ungenutzte sofort kündigen
5. Streaming-Abos rotieren statt alle gleichzeitig halten

Eine Reduktion um 2–3 Abos spart oft 20–40 €/Monat = 240–480 €/Jahr.`;

    case "transport": {
      const cat = cats.find(c => c.label?.toLowerCase().includes("transport") || c.label?.toLowerCase().includes("auto"));
      const spent = cat ? cat.spent : 0;

      return `**Transport & Mobilität${monat ? ` – ${monat}` : ""}**

${spent > 0 ? `Erfasste Transportkosten: ${fmtEUR(spent)}` : "Noch keine Transportkosten erfasst."}

**Durchschnittliche PKW-Vollkosten:** 400–700 €/Monat (inkl. Abschreibung, Versicherung, Sprit, Wartung).

**Sparmöglichkeiten:**
- Deutschlandticket (49 €/Monat) wenn öffentliche Verkehrsmittel möglich
- Carsharing für gelegentliche Fahrten
- KFZ-Versicherung jährlich vergleichen – bis 200 €/Jahr Unterschied
- Fahrrad für kurze Strecken – gesund und kostenlos

**Faustregel:** Transportkosten unter 15% des Nettoeinkommens.`;
    }

    case "freizeit": return `**Freizeit & Unterhaltung**

Freizeitausgaben sind die flexibelste Kategorie – hier liegt das größte Einsparpotenzial.

**Günstige Alternativen:**
- Bibliotheken: kostenlose Bücher, Hörbücher, oft auch Filme
- Stadtparks, Wanderungen, Radtouren statt teurer Aktivitäten
- Freunde einladen statt Ausgehen (1 Restaurant = 5× Heimkochen)
- Kostenlose Museen (viele haben freie Tage)

**Budgetregel:** Nach 50/30/20 gehört Freizeit in den "Wünsche"-Block (30%). Bei 2.000 € Netto = 600 € für alles Nicht-Notwendige.

Das heißt nicht verzichten – sondern bewusst wählen, was wirklich wichtig ist.`;

    case "notgroschen": {
      const monatsausgaben = totals ? totals.total : 0;
      const empf3 = monatsausgaben * 3;
      const empf6 = monatsausgaben * 6;

      return `**Notgroschen – Dein finanzielles Sicherheitsnetz**

**Empfehlung:** 3–6 Nettomonatsgehälter als Rücklage.

${monatsausgaben > 0 ? `Bei deinen monatlichen Ausgaben von ${fmtEUR(monatsausgaben)}:\n    3 Monate: ${fmtEUR(empf3)}\n    6 Monate: ${fmtEUR(empf6)}` : "Trage deine Ausgaben ein für eine konkrete Empfehlung."}

**Warum 3–6 Monate?**
- Jobverlust: Durchschnittliche Jobsuche dauert 3–6 Monate
- Unerwartete Reparaturen (Auto, Wohnung): 500–5.000 €
- Krankheit / Arbeitsunfähigkeit

**Aufbau-Strategie:**
1. Ziel setzen (z.B. 3 Monatsausgaben)
2. Automatische monatliche Überweisung einrichten
3. Separates Konto – nicht das Girokonto!
4. Tagesgeld (aktuell 2–4% p.a.) statt Sparkonto

Der Notgroschen ist keine Geldanlage – er ist Sicherheit. Erst wenn er steht, lohnt sich Investieren.`;
    }

    case "50_30_20": {
      const inc = totals?.income || 0;
      const n50 = inc ? Math.round(inc * 0.5) : 0;
      const n30 = inc ? Math.round(inc * 0.3) : 0;
      const n20 = inc ? Math.round(inc * 0.2) : 0;

      return `**Die 50/30/20-Budgetregel**

Eine einfache, bewährte Methode:

    50% → Bedürfnisse  ${inc ? `= ${fmtEUR(n50)}/Monat` : ""}
    30% → Wünsche      ${inc ? `= ${fmtEUR(n30)}/Monat` : ""}
    20% → Sparen       ${inc ? `= ${fmtEUR(n20)}/Monat` : ""}

**Was gehört wohin?**
- **Bedürfnisse (50%):** Miete, Strom, Lebensmittel, Versicherungen, Transport
- **Wünsche (30%):** Restaurants, Kleidung, Urlaub, Unterhaltung, Hobbys
- **Sparen (20%):** Notgroschen, Altersvorsorge, Ziele, Investitionen

**Anpassung:** Wer hohe Fixkosten hat (z.B. teure Miete), kann 60/20/20 verwenden. Wichtig ist, dass Sparen einen festen Platz bekommt.

${inc > 0 ? "Richte dein Finanzprofil ein, um diese Aufteilung auf deine Kategorien anzuwenden." : "Trage dein Einkommen ein für eine konkrete Berechnung."}`;
    }

    case "ziel_check": {
      const ziele = profil?.finanzielleZiele || [];
      if (ziele.length === 0) {
        return `Du hast noch keine konkreten Sparziele hinterlegt.

**Beispiele:**
- Urlaubsbudget: 2.000 € bis August
- Notgroschen: 6.000 € aufbauen
- Neues Smartphone: 800 € bis Dezember

Richte dein Finanzprofil ein, um Ziele zu hinterlegen – dann berechne ich dir die monatliche Rate.`;
      }

      const now = new Date();
      const lines = ziele.map(z => {
        if (!z.label) return null;
        const bis = z.bisDatum ? new Date(z.bisDatum) : null;
        const monate = bis ? Math.max(1, Math.round((bis - now) / (1000 * 60 * 60 * 24 * 30))) : null;
        const proMonat = (monate && z.betrag) ? Math.ceil(z.betrag / monate) : null;
        return `- **${z.label}**: ${z.betrag ? fmtEUR(z.betrag) : "Betrag nicht gesetzt"}${bis ? ` bis ${bis.toLocaleDateString("de-DE")}` : ""}${proMonat ? ` → ${fmtEUR(proMonat)}/Monat nötig` : ""}`;
      }).filter(Boolean).join("\n");

      return `**Deine Sparziele:**\n\n${lines}\n\n${totals?.income > 0 ? `Bei ${fmtEUR(totals.income)} Nettoeinkommen – prüfe ob die monatlichen Beträge realistisch in dein Budget passen.` : ""}`;
    }

    case "muster": {
      if (!history.length) return "Noch nicht genug Monate erfasst für eine Musteranalyse. Monatsdaten über 2–3 Monate aufbauen.";

      const lines = [];
      for (const cat of cats) {
        const prevValues = history.map(h => {
          const hcat = h.cats.find(c => c.id === cat.id);
          return hcat ? hcat.spent : null;
        }).filter(v => v !== null);
        if (prevValues.length === 0) continue;
        const avg  = prevValues.reduce((s, v) => s + v, 0) / prevValues.length;
        if (avg === 0) continue;
        const diff = cat.spent - avg;
        const pct  = Math.round(Math.abs(diff) / avg * 100);
        if (pct >= 20) {
          lines.push(`- "${cat.label}": ${diff > 0 ? `↑ +${pct}%` : `↓ −${pct}%`} gegenüber Durchschnitt (Ø ${fmtEUR(avg)} → jetzt ${fmtEUR(cat.spent)})`);
        }
      }

      if (lines.length === 0) {
        return `**Musteranalyse – ${monat}**\n\n✅ Keine auffälligen Abweichungen vom Durchschnitt der letzten ${history.length} Monate.`;
      }

      return `**Musteranalyse – ${monat}**

Abweichungen gegenüber deinem Durchschnitt:

${lines.join("\n")}

Große Ausschläge können saisonale Gründe haben (Urlaub, Geschenke) – oder ein Signal, etwas zu ändern.`;
    }

    case "optimierung": {
      if (!totals) return noData();
      const { income, total } = totals;
      const remaining = income - total;

      const potenziale = [];
      const sorted = [...cats].sort((a, b) => b.spent - a.spent);
      if (sorted.length > 0 && sorted[0].spent > 0) {
        potenziale.push(`**${sorted[0].label}** ist deine größte variable Ausgabe (${fmtEUR(sorted[0].spent)}) – lohnt sich, hier anzusetzen.`);
      }
      const over = cats.filter(c => c.budget > 0 && c.pct >= 1);
      if (over.length > 0) {
        potenziale.push(`**Kategorien über Budget:** ${over.map(c => `"${c.label}" (+${Math.round((c.pct - 1) * 100)}%)`).join(", ")}`);
      }
      if (income > 0 && totals.fixed / income > 0.4) {
        potenziale.push(`**Fixkosten** (${Math.round(totals.fixed / income * 100)}% des Einkommens) – Abonnements prüfen, Versicherungen vergleichen.`);
      }

      return `**Optimierungspotenzial – ${monat}**

${potenziale.length > 0 ? potenziale.join("\n\n") : "✅ Auf den ersten Blick keine offensichtlichen Einsparmöglichkeiten."}

**Allgemeine Tipps:**
1. **Pay yourself first:** Sparbetrag direkt nach Gehaltseingang überweisen
2. **Abo-Audit:** Einmal im Quartal alle Abbuchungen prüfen
3. **48h-Regel:** Bei Käufen über 50 € erst 2 Tage warten
4. **Kategorienbudgets setzen:** Ohne Budget kein Kontrollpunkt
5. **Wochentipp:** Einmal pro Woche 5 Minuten Ausgaben-Check

${remaining < 0 ? `⚠️ Du hast ${fmtEUR(Math.abs(remaining))} Defizit – hier ist Handeln dringend.` : remaining > 0 ? `Du hast ${fmtEUR(remaining)} unverplant – überlege, ob du mehr sparen oder gezielt investieren möchtest.` : ""}`;
    }

    case "forecast": {
      if (!totals) return noData();
      const { income, total } = totals;
      // Prognose nur für aktuellen Monat sinnvoll
      const nowYM = new Date().toISOString().slice(0, 7);
      if (currentMonth && currentMonth !== nowYM) {
        return `Prognosen sind nur für den aktuellen Monat verfügbar. Du schaust gerade auf **${monat}**.

Wechsle zum aktuellen Monat für eine Hochrechnung.`;
      }
      const today    = new Date();
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysLeft   = Math.max(0, Math.round((monthEnd - today) / (1000 * 60 * 60 * 24)));
      const daysPassed = today.getDate();
      const daysTotal  = monthEnd.getDate();
      const tagessatz  = daysPassed > 0 ? total / daysPassed : 0;
      const forecast   = Math.round(tagessatz * daysTotal);
      const diff       = income - forecast;

      return `**Monats-Prognose – ${monat}**

Bisher vergangen: ${daysPassed} von ${daysTotal} Tagen.
Bisherige Ausgaben: ${fmtEUR(total)} / Tagesrate: ${fmtEUR(tagessatz)}/Tag

    Prognostizierte Ausgaben:  ${fmtEUR(forecast)}
    Einkommen:                 ${fmtEUR(income)}
    Prognostiziertes Ergebnis: ${fmtEUR(diff)}

${diff < 0 ? `🚨 Auf Kurs, Budget um ${fmtEUR(Math.abs(diff))} zu überschreiten.` :
  diff < income * 0.1 ? `⚠️ Knapper Puffer – wenig Spielraum für unerwartete Ausgaben.` :
  `✅ Prognostiziertes Plus von ${fmtEUR(diff)} – du liegst gut im Plan.`}

${daysLeft > 0 ? `Noch ${daysLeft} Tage – Tageslimit für Budget-Einhaltung: ${fmtEUR(Math.max(0, (income - total) / daysLeft))}/Tag.` : ""}`;
    }

    case "bedarfsanalyse": return profil
      ? `**Dein Finanzprofil**

    Nettoeinkommen:    ${profil.nettoEinkommen ? fmtEUR(profil.nettoEinkommen) : "nicht erfasst"}
    Sparziel/Monat:    ${profil.sparZielMonatlich ? fmtEUR(profil.sparZielMonatlich) : "nicht gesetzt"}
    Notgroschen-Ziel:  ${profil.notgroschenZiel ? fmtEUR(profil.notgroschenZiel) : "nicht gesetzt"}
    Budgetmethode:     ${profil.methode === "50_30_20" ? "50/30/20-Regel" : "Manuell"}
    Letzte Änderung:   ${profil.aktualisiert ? new Date(profil.aktualisiert).toLocaleDateString("de-DE") : "—"}

Klicke auf "Profil bearbeiten" oben im Chat, um dein Profil anzupassen.`
      : `Du hast noch kein Finanzprofil. Klicke oben auf **"Finanzprofil einrichten"** und gib Einkommen, Sparziel und Ziele ein.`;

    case "ueberschuss": {
      if (!totals) return noData();
      const { income, total } = totals;
      const ueberschuss = income - total;
      if (ueberschuss <= 0) return `Du hast diesen Monat keinen Überschuss – tatsächlich ${fmtEUR(Math.abs(ueberschuss))} im Minus. Schau, wo du Ausgaben reduzieren kannst.`;

      return `**Was tun mit ${fmtEUR(ueberschuss)} Überschuss?**

**Empfohlene Prioritätsreihenfolge:**

1. **Notgroschen auffüllen** (Prio 1) – Ziel: ${profil?.notgroschenZiel ? fmtEUR(profil.notgroschenZiel) : "3–6 Monatsgehälter"}
2. **Sparziele bedienen** – z.B. Urlaub, größere Anschaffungen
3. **Altersvorsorge** – ETF-Sparplan, Riester, bAV
4. **Schulden tilgen** – wenn vorhanden, vor Investieren
5. **Frei verfügbar** – für kurzfristige Wünsche

Faustregel: Mindestens 50% des Überschusses sparen/investieren, 50% genießen.`;
    }

    case "schulden": return `**Schulden abbauen – Strategie**

**Zwei bewährte Methoden:**

**Avalanche (mathematisch optimal):**
Höchsten Zinssatz zuerst abzahlen → spart am meisten Geld.
1. Alle Schulden nach Zinssatz sortieren
2. Nur Minimum bei allen außer der teuersten zahlen
3. Alle Extra-Mittel auf die teuerste Schuld

**Snowball (psychologisch motivierend):**
Kleinste Summe zuerst abzahlen → schnelle Erfolgserlebnisse.

**Dispo ist teuer:** Überziehungszinsen liegen oft bei 12–15% p.a. – so schnell wie möglich ausgleichen.
**Kreditkarten-Schulden:** Zinsen oft 18–24% p.a. – Prio 1.`;

    case "versicherung": return `**Versicherungen – was ist sinnvoll?**

**Unbedingt empfohlen:**
- ✅ **Privathaftpflicht** (5–10 €/Monat) – wichtigste Versicherung überhaupt
- ✅ **Berufsunfähigkeitsversicherung** – besonders für Berufseinsteiger
- ✅ **Krankenversicherung** – gesetzlich verpflichtend

**Je nach Situation:**
- 🏠 Hausratversicherung (bei eigenem Hausrat)
- 🚗 KFZ-Vollkasko (bei neuem/teurem Auto)

**Häufig überflüssig:**
- ❌ Reisegepäckversicherung
- ❌ Smartphone-Versicherung
- ❌ Brillenversicherung

**Tipp:** Versicherungsvergleich jährlich – besonders für KFZ lohnt sich Wechseln.`;

    default: return `Ich habe deine Frage nicht ganz verstanden. Tippe **"Hilfe"** für eine Übersicht meiner Themen, oder formuliere deine Frage neu.`;
  }
}

// ════════════════════════════════════════════════════════════════════════
// MARKDOWN-RENDERER
// ════════════════════════════════════════════════════════════════════════
function _renderBudgetMd(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  function inlineRender(str) {
    const parts = [];
    const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[2]) parts.push(React.createElement("strong", { key: m.index }, m[2]));
      else if (m[3]) parts.push(React.createElement("code", {
        key: m.index, style: { background: "var(--surface-2)", borderRadius: 4, padding: "1px 5px", fontSize: "0.88em", fontFamily: "monospace" }
      }, m[3]));
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("    ") && line.trim() !== "") {
      const block = [];
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) { block.push(lines[i]); i++; }
      elements.push(React.createElement("pre", {
        key: `pre-${i}`, style: { background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px", fontSize: "12.5px", overflowX: "auto", margin: "6px 0", fontFamily: "monospace", lineHeight: 1.6, color: "var(--text)" }
      }, block.join("\n").replace(/^    /gm, "")));
      continue;
    }
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      elements.push(React.createElement("ul", { key: `ul-${i}`, style: { margin: "4px 0 4px 18px", padding: 0, lineHeight: 1.6, fontSize: "13.5px" } },
        items.map((item, ii) => React.createElement("li", { key: ii, style: { marginBottom: 2 } }, inlineRender(item)))));
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      elements.push(React.createElement("ol", { key: `ol-${i}`, style: { margin: "4px 0 4px 18px", padding: 0, lineHeight: 1.6, fontSize: "13.5px" } },
        items.map((item, ii) => React.createElement("li", { key: ii, style: { marginBottom: 2 } }, inlineRender(item)))));
      continue;
    }
    if (line.trim() === "") { elements.push(React.createElement("div", { key: `sp-${i}`, style: { height: 5 } })); i++; continue; }
    if (/^---+$/.test(line.trim())) { elements.push(React.createElement("hr", { key: `hr-${i}`, style: { border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" } })); i++; continue; }
    elements.push(React.createElement("p", { key: `p-${i}`, style: { margin: "2px 0", lineHeight: 1.6, fontSize: "13.5px" } }, inlineRender(line)));
    i++;
  }
  return elements;
}

// ════════════════════════════════════════════════════════════════════════
// UI: Chat-Komponenten
// ════════════════════════════════════════════════════════════════════════
function BudgetMsgBubble({ role, content }) {
  const isBot = role === "assistant";
  return (
    <div className={`bot-msg bot-msg-${role}`}>
      <div className="bot-msg-bubble">{isBot ? _renderBudgetMd(content) : content}</div>
    </div>
  );
}

function BudgetTypingIndicator() {
  return (
    <div className="bot-msg bot-msg-assistant">
      <div className="bot-msg-bubble bot-msg-typing"><span /><span /><span /></div>
    </div>
  );
}

function BudgetSuggestions({ onPick }) {
  const chips = [
    "Wie sieht mein Budget aus?",
    "Wo kann ich sparen?",
    "Wie weit bin ich mit meinem Sparziel?",
    "Was mache ich mit dem Überschuss?",
    "Sind meine Fixkosten zu hoch?",
  ];
  return (
    <div className="bot-suggestions">
      <div className="bot-suggestions-label">Frag mich zum Beispiel:</div>
      <div className="bot-suggestions-chips">
        {chips.map(s => (
          <button key={s} className="bot-suggestion-chip" onClick={() => onPick(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BEDARFSANALYSE-WIZARD (4 Schritte)
// ════════════════════════════════════════════════════════════════════════
function BedarfsanalyseWizard({ profilInit, onSave, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState({
    nettoEinkommen:    profilInit?.nettoEinkommen    || 0,
    sparZielMonatlich: profilInit?.sparZielMonatlich || 0,
    sparZielTyp:       profilInit?.sparZielTyp       || "betrag",
    sparZielProzent:   profilInit?.sparZielProzent   || 20,
    notgroschenZiel:   profilInit?.notgroschenZiel   || 0,
    methode:           profilInit?.methode           || "50_30_20",
    finanzielleZiele:  profilInit?.finanzielleZiele  || [],
  });
  const [neuesZiel, setNeuesZiel] = React.useState({ label: "", betrag: "", bisDatum: "" });
  const [saving, setSaving] = React.useState(false);

  const patch = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const sparZielAbsolut = form.sparZielTyp === "prozent"
    ? Math.round(form.nettoEinkommen * form.sparZielProzent / 100)
    : form.sparZielMonatlich;

  const SCHRITTE = [
    { titel: "Einkommen", icon: "💶" },
    { titel: "Sparziel",  icon: "🎯" },
    { titel: "Ziele",     icon: "🏦" },
    { titel: "Methode",   icon: "📐" },
  ];

  const _wizardMounted = React.useRef(true);
  React.useEffect(() => {
    _wizardMounted.current = true;
    return () => { _wizardMounted.current = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const profil = {
      ...form,
      sparZielMonatlich: sparZielAbsolut,
      erstellt: profilInit?.erstellt || Date.now(),
    };
    await saveBedarfsanalyse(profil);
    if (!_wizardMounted.current) return;
    setSaving(false);
    onSave(profil);
  };

  const addZiel = () => {
    if (!neuesZiel.label) return;
    patch("finanzielleZiele", [...form.finanzielleZiele, {
      id: String(Date.now()), label: neuesZiel.label,
      betrag: Number(neuesZiel.betrag) || 0, bisDatum: neuesZiel.bisDatum || null,
    }]);
    setNeuesZiel({ label: "", betrag: "", bisDatum: "" });
  };

  const removeZiel = (id) => patch("finanzielleZiele", form.finanzielleZiele.filter(z => z.id !== id));

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 12,
    border: "1.5px solid var(--border)", background: "var(--surface)",
    color: "var(--text)", fontSize: 15, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, color: "var(--text-muted)", marginBottom: 6, display: "block" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="bot-header">
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 8px", borderRadius: 8, fontFamily: "inherit", fontSize: 13 }}>
          ✕ Abbrechen
        </button>
        <div className="bot-header-title">
          <div className="bot-header-title-main">Finanzprofil</div>
          <div className="bot-header-title-sub">Schritt {step + 1} von {SCHRITTE.length}</div>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ height: 3, background: "var(--border)", position: "relative" }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${((step + 1) / SCHRITTE.length) * 100}%`, transition: "width 0.3s" }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 16px" }}>
        {/* Schritt-Navigation */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {SCHRITTE.map((s, idx) => (
            <div key={idx} onClick={() => idx < step && setStep(idx)} style={{
              flex: 1, textAlign: "center", padding: "6px 4px", borderRadius: 10,
              background: idx === step ? "var(--accent)" : idx < step ? "var(--surface-2)" : "transparent",
              color: idx === step ? "#fff" : idx < step ? "var(--text-muted)" : "var(--text-faint)",
              fontSize: 11, fontWeight: idx === step ? 700 : 400, transition: "all 0.2s",
              cursor: idx < step ? "pointer" : "default",
            }}>
              {s.icon}<br/><span style={{ fontSize: 10 }}>{s.titel}</span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>💶</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Dein Netto-Einkommen</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
              Dein monatliches Nettogehalt nach Steuern und Abzügen – die Grundlage aller Berechnungen.
            </div>
            <label style={labelStyle}>Monatliches Nettoeinkommen (€)</label>
            <input type="number" min="0" step="50"
              value={form.nettoEinkommen || ""}
              onChange={e => patch("nettoEinkommen", Number(e.target.value))}
              placeholder="z.B. 2800" style={inputStyle} />
            {form.nettoEinkommen > 0 && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Nach 50/30/20: Bedürfnisse {fmtEUR(form.nettoEinkommen * 0.5)} · Wünsche {fmtEUR(form.nettoEinkommen * 0.3)} · Sparen {fmtEUR(form.nettoEinkommen * 0.2)}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🎯</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Dein Sparziel</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
              Wie viel möchtest du jeden Monat auf die Seite legen?
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["betrag", "Fester Betrag (€)"], ["prozent", "Prozentsatz (%)"]].map(([val, lab]) => (
                <button key={val} onClick={() => patch("sparZielTyp", val)} style={{
                  flex: 1, padding: "9px", borderRadius: 10,
                  border: `1.5px solid ${form.sparZielTyp === val ? "var(--accent)" : "var(--border)"}`,
                  background: form.sparZielTyp === val ? "var(--accent)" : "var(--surface)",
                  color: form.sparZielTyp === val ? "#fff" : "var(--text-muted)",
                  fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: form.sparZielTyp === val ? 700 : 400,
                }}>{lab}</button>
              ))}
            </div>
            {form.sparZielTyp === "betrag" ? (
              <>
                <label style={labelStyle}>Monatlicher Sparbetrag (€)</label>
                <input type="number" min="0" step="25"
                  value={form.sparZielMonatlich || ""}
                  onChange={e => patch("sparZielMonatlich", Number(e.target.value))}
                  placeholder="z.B. 300" style={inputStyle} />
              </>
            ) : (
              <>
                <label style={labelStyle}>Prozentsatz des Einkommens (%)</label>
                <input type="number" min="1" max="80" step="1"
                  value={form.sparZielProzent || ""}
                  onChange={e => patch("sparZielProzent", Number(e.target.value))}
                  placeholder="z.B. 20" style={inputStyle} />
              </>
            )}
            {sparZielAbsolut > 0 && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)" }}>
                Sparziel: <strong style={{ color: "var(--accent)" }}>{fmtEUR(sparZielAbsolut)}/Monat</strong>
                {form.nettoEinkommen > 0 && ` = ${Math.round(sparZielAbsolut / form.nettoEinkommen * 100)}% deines Einkommens`}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🏦</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Rücklage & Sparziele</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
              Optional – du kannst diese jederzeit ergänzen.
            </div>
            <label style={labelStyle}>Notgroschen-Ziel (€) – empfohlen: 3–6 Monatsausgaben</label>
            <input type="number" min="0" step="500"
              value={form.notgroschenZiel || ""}
              onChange={e => patch("notgroschenZiel", Number(e.target.value))}
              placeholder="z.B. 5000" style={{ ...inputStyle, marginBottom: 20 }} />

            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Konkrete Sparziele (optional)</div>
            {form.finanzielleZiele.map(z => (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 10 }}>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <strong>{z.label}</strong>
                  {z.betrag > 0 && <span style={{ color: "var(--text-muted)" }}> · {fmtEUR(z.betrag)}</span>}
                  {z.bisDatum && <span style={{ color: "var(--text-faint)", fontSize: 11 }}> · bis {new Date(z.bisDatum).toLocaleDateString("de-DE")}</span>}
                </div>
                <button onClick={() => removeZiel(z.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 16, padding: 4 }}>×</button>
              </div>
            ))}
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <input type="text" value={neuesZiel.label} onChange={e => setNeuesZiel(z => ({ ...z, label: e.target.value }))}
                placeholder="Zielname (z.B. Urlaub)" style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" min="0" value={neuesZiel.betrag} onChange={e => setNeuesZiel(z => ({ ...z, betrag: e.target.value }))}
                  placeholder="Betrag (€)" style={{ ...inputStyle, flex: 1 }} />
                <input type="date" value={neuesZiel.bisDatum} onChange={e => setNeuesZiel(z => ({ ...z, bisDatum: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }} />
              </div>
              <button onClick={addZiel} disabled={!neuesZiel.label} style={{
                padding: "9px", borderRadius: 10, border: "1.5px dashed var(--border)", background: "transparent",
                color: neuesZiel.label ? "var(--accent)" : "var(--text-faint)",
                fontSize: 13, cursor: neuesZiel.label ? "pointer" : "default", fontFamily: "inherit",
              }}>+ Ziel hinzufügen</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📐</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Budgetmethode</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.5 }}>
              Wie soll BudgetBot deine Kategorien bewerten?
            </div>
            {[
              { key: "50_30_20", titel: "50/30/20 Regel", empfohlen: true, beschreibung: `50% Bedürfnisse · 30% Wünsche · 20% Sparen${form.nettoEinkommen > 0 ? `\n→ ${fmtEUR(form.nettoEinkommen * 0.5)} / ${fmtEUR(form.nettoEinkommen * 0.3)} / ${fmtEUR(sparZielAbsolut || form.nettoEinkommen * 0.2)}` : ""}` },
              { key: "manuell",  titel: "Manuell",        empfohlen: false, beschreibung: "Du setzt Budgets pro Kategorie selbst – BudgetBot überwacht sie." },
            ].map(opt => (
              <div key={opt.key} onClick={() => patch("methode", opt.key)} style={{
                padding: "14px 16px", borderRadius: 14, marginBottom: 10, cursor: "pointer",
                border: `2px solid ${form.methode === opt.key ? "var(--accent)" : "var(--border)"}`,
                background: form.methode === opt.key ? "oklch(from var(--accent) l c h / 0.07)" : "var(--surface)",
                transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: form.methode === opt.key ? "var(--accent)" : "var(--text)" }}>{opt.titel}</strong>
                  {opt.empfohlen && <span style={{ fontSize: 10, background: "var(--accent)", color: "#fff", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Empfohlen</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{opt.beschreibung}</div>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--surface-2)", borderRadius: 12, fontSize: 13, lineHeight: 1.6 }}>
              <strong>Zusammenfassung:</strong><br/>
              Einkommen: {form.nettoEinkommen ? fmtEUR(form.nettoEinkommen) : "nicht gesetzt"}<br/>
              Sparziel: {sparZielAbsolut ? fmtEUR(sparZielAbsolut) + "/Monat" : "nicht gesetzt"}<br/>
              Notgroschen: {form.notgroschenZiel ? fmtEUR(form.notgroschenZiel) : "nicht gesetzt"}<br/>
              Ziele: {form.finanzielleZiele.length > 0 ? form.finanzielleZiele.map(z => z.label).join(", ") : "keine"}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 18px 18px", display: "flex", gap: 10, borderTop: "1px solid var(--border)" }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, padding: "11px", borderRadius: 12, border: "1.5px solid var(--border)",
            background: "var(--surface)", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>← Zurück</button>
        )}
        {step < SCHRITTE.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} style={{
            flex: 2, padding: "11px", borderRadius: 12, background: "var(--accent)", color: "#fff",
            border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>Weiter →</button>
        ) : (
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: "11px", borderRadius: 12, background: "var(--accent)", color: "#fff",
            border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            opacity: saving ? 0.7 : 1,
          }}>{saving ? "Speichern…" : "✓ Profil speichern"}</button>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BUDGET ALERT PANEL — eingebettet in BudgetView
// ════════════════════════════════════════════════════════════════════════
function BudgetAlertPanel({ state, profil, onOpenBot, onAlertAktion }) {
  const alerts = React.useMemo(() => computeBudgetAlerts(state, profil), [state, profil]);
  const visible = alerts.filter(a => a.prio <= 2).slice(0, 2);
  if (!visible.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {visible.map(alert => (
        <div key={alert.id}
          role="button" tabIndex={0}
          onClick={() => { if (alert.aktion && onAlertAktion) onAlertAktion(alert); else if (onOpenBot) onOpenBot(); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (alert.aktion && onAlertAktion) onAlertAktion(alert); else if (onOpenBot) onOpenBot(); } }}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            borderRadius: 10, background: "var(--surface-2)", borderLeft: `3px solid ${alert.farbe}`, cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 18 }}>{alert.icon}</span>
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4, color: "var(--text-secondary, var(--text-muted))" }}>
            {alert.text}
          </div>
          {alert.aktion && (
            <span style={{ fontSize: 11, color: alert.farbe, flexShrink: 0, fontWeight: 600 }}>{alert.aktion} →</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BUDGET BOT SETTINGS PANEL
// ════════════════════════════════════════════════════════════════════════
function BudgetBotSettingsPanel({ onClose }) {
  const cfg0 = (typeof window.getOllamaConfig === "function") ? window.getOllamaConfig() : {};
  const [ollamaUrl,   setOllamaUrl]   = React.useState(() => cfg0.url   || "http://localhost:11434");
  const [ollamaModel, setOllamaModel] = React.useState(() => cfg0.model || "");
  const [testStatus,  setTestStatus]  = React.useState(null);
  const [testing,     setTesting]     = React.useState(false);
  const [guideOpen,   setGuideOpen]   = React.useState(false);

  const save = () => {
    if (typeof window.setOllamaConfig === "function") {
      window.setOllamaConfig({ url: ollamaUrl.trim() || "http://localhost:11434", model: ollamaModel.trim() });
    }
    onClose();
  };

  const testOllama = async () => {
    setTesting(true);
    setTestStatus(null);
    const url   = ollamaUrl.trim()   || "http://localhost:11434";
    const model = ollamaModel.trim() || "llama3.1:8b";
    if (typeof window.ollamaTest === "function") {
      const ok = await window.ollamaTest(url, model);
      setTestStatus(ok
        ? { ok: true,  msg: `✓ Ollama antwortet (${url}, Modell: ${model})` }
        : { ok: false, msg: `Ollama nicht erreichbar — läuft "ollama serve"? Modell "${model}" geladen?` });
    } else {
      setTestStatus({ ok: false, msg: "ollamaTest nicht verfügbar — utils.jsx laden?" });
    }
    setTesting(false);
  };

  const RECOMMENDED = [
    { id: "llama3.1:8b",  label: "llama3.1:8b",  badge: "⭐ Empfohlen",    desc: "Beste Balance auf M5 · Deutsch + Englisch · ~5 GB" },
    { id: "mistral:7b",   label: "mistral:7b",   badge: "⚡ Schnell",      desc: "Sehr schnelle Antworten · gutes Deutsch · ~4 GB" },
    { id: "gemma3:12b",   label: "gemma3:12b",   badge: "🧠 Präzise",     desc: "Beste Qualität · langsamer · ~8 GB RAM nötig" },
    { id: "qwen2.5:7b",   label: "qwen2.5:7b",   badge: "🌐 Mehrsprachig", desc: "Sehr gutes Deutsch · Finanzthemen stark · ~4 GB" },
  ];

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 10,
      background: "var(--bg)", borderRadius: "inherit",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div className="bot-header">
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-muted)", padding: "4px 8px", borderRadius: 8,
          fontFamily: "inherit", fontSize: 13,
        }}>← Zurück</button>
        <div className="bot-header-title">
          <div className="bot-header-title-main">KI-Backend</div>
          <div className="bot-header-title-sub">BudgetBot konfigurieren</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 28px" }}>

        {/* ── Ollama Sektion ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            Ollama{" "}
            <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-faint)" }}>
              · kostenlos · lokal · kein API-Key
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, marginTop: 10 }}>
            Ollama-URL <span style={{ color: "var(--text-faint)" }}>(Standard: http://localhost:11434)</span>
          </div>
          <input
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 10, boxSizing: "border-box",
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text)", fontSize: 13, fontFamily: "inherit", marginBottom: 6,
            }}
          />
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 12, lineHeight: 1.5 }}>
            📱 iPhone im Heimnetz:{" "}
            <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
              http://192.168.x.x:11434
            </code>
            {" "}— Ollama mit{" "}
            <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
              OLLAMA_HOST=0.0.0.0 ollama serve
            </code>{" "}starten.
          </div>

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Modell-Name</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="z.B. llama3.1:8b"
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--text)", fontSize: 13, fontFamily: "inherit",
              }}
            />
            <button onClick={testOllama} disabled={testing} style={{
              padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--text-muted)",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>
              {testing ? "…" : "Test"}
            </button>
          </div>
          {testStatus && (
            <div style={{
              marginBottom: 10, fontSize: 12, padding: "6px 10px", borderRadius: 8,
              background: testStatus.ok ? "oklch(0.95 0.05 145)" : "oklch(0.95 0.05 25)",
              color: testStatus.ok ? "oklch(0.34 0.13 145)" : "oklch(0.45 0.16 25)",
            }}>
              {testStatus.msg}
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>
            Empfohlen für MacBook Air M5:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {RECOMMENDED.map((m) => (
              <button
                key={m.id}
                onClick={() => setOllamaModel(m.id)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                  border: ollamaModel === m.id ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                  background: ollamaModel === m.id ? "oklch(0.96 0.03 250)" : "var(--surface)",
                  color: "var(--text)", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.4 }}>{m.desc}</div>
                </div>
                <span style={{
                  marginLeft: "auto", fontSize: 10, whiteSpace: "nowrap",
                  color: "var(--accent)", fontWeight: 600, paddingTop: 2,
                }}>{m.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Install-Guide ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 20, borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
          <button
            onClick={() => setGuideOpen((v) => !v)}
            style={{
              width: "100%", padding: "10px 14px", background: "var(--surface-2)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, color: "var(--text)", fontWeight: 600,
            }}
          >
            <span>📖 Ollama installieren (Anleitung)</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{guideOpen ? "▲" : "▼"}</span>
          </button>
          {guideOpen && (
            <div style={{ padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "var(--text-muted)" }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>Mac (M5):</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Besuche <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>ollama.ai</a> → Download → macOS .dmg installieren</li>
                <li>Terminal: <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>ollama pull llama3.1:8b</code></li>
                <li>Ollama läuft automatisch. URL: <code>http://localhost:11434</code></li>
              </ol>
              <div style={{ fontWeight: 700, margin: "10px 0 4px", color: "var(--text)" }}>iPhone (Heimnetz):</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Mac-IP: <code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>ifconfig | grep "inet 192"</code></li>
                <li><code style={{ background: "var(--surface)", padding: "2px 6px", borderRadius: 4 }}>OLLAMA_HOST=0.0.0.0 ollama serve</code></li>
                <li>URL oben: <code>http://192.168.x.x:11434</code> · gleiches WLAN nötig</li>
              </ol>
            </div>
          )}
        </div>

        {/* ── Offline-Status ────────────────────────────────────────── */}
        <div style={{
          padding: "12px 14px", borderRadius: 12, marginBottom: 20,
          background: "oklch(0.95 0.03 145)", border: "1px solid oklch(0.82 0.07 145)",
          fontSize: 13, color: "oklch(0.34 0.10 145)", lineHeight: 1.55,
        }}>
          <strong>⚡ Offline-Modus immer aktiv</strong><br/>
          Wenn Ollama nicht erreichbar ist, antwortet BudgetBot aus der lokalen Analyse-Engine —
          20 Budgetthemen, echte Berechnung aus deinen Daten, kein Backend nötig.
        </div>

        <button onClick={save} style={{
          width: "100%", padding: "11px",
          borderRadius: 12, background: "var(--text)", color: "var(--bg)",
          border: "none", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          Speichern
        </button>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.5 }}>
          Keine Daten verlassen das Gerät. Kein API-Key, kein Proxy, kein Cloud-Dienst.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// BUDGET BOT MODAL
// ════════════════════════════════════════════════════════════════════════
function BudgetBotModal({ open, onClose, state, pendingMessage, onPendingMessageSent }) {
  const [profil, setProfil]             = React.useState(null);
  const [profilLoaded, setProfilLoaded] = React.useState(false);
  const [wizardOpen, setWizardOpen]     = React.useState(false);
  const [chats, setChats]               = React.useState([]);
  const [activeId, setActiveId]         = React.useState(null);
  const activeIdRef = React.useRef(null);
  const _setActiveId = (id) => { activeIdRef.current = id; _setActiveId(id); };
  const [messages, setMessages]         = React.useState([]);
  const [draft, setDraft]               = React.useState("");
  const [busy, setBusy]                 = React.useState(false);
  const [sidebarOpen, setSidebarOpen]   = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend]           = React.useState(detectBudgetBackend);
  const scrollRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    loadBedarfsanalyse().then(p => { setProfil(p); setProfilLoaded(true); });
  }, [open]);

  // pendingMessage via Ref stabil halten (kein stale-closure Problem)
  const pendingMsgRef = React.useRef(null);
  React.useEffect(() => { pendingMsgRef.current = pendingMessage; }, [pendingMessage]);
  const handleSendRef = React.useRef(null);

  // Pending-Message (aus Alert-Klick) nach Öffnen automatisch absenden
  React.useEffect(() => {
    if (!open || !pendingMsgRef.current) return;
    const msg = pendingMsgRef.current;
    const timer = setTimeout(() => {
      if (handleSendRef.current) handleSendRef.current(msg);
      if (typeof onPendingMessageSent === "function") onPendingMessageSent();
      pendingMsgRef.current = null;
    }, 450);
    return () => clearTimeout(timer);
  }, [open, pendingMessage]);

  React.useEffect(() => {
    if (!open) return;
    budgetChatList().then(list => {
      setChats(list);
      if (list.length === 0) _newChat();
      else { _setActiveId(list[0].id); setMessages(list[0].messages || []); }
    });
  }, [open]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  React.useEffect(() => {
    if (open && !wizardOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, wizardOpen]);

  const _newChat = () => {
    const id   = "bc-" + Date.now();
    const chat = { id, title: "Neues Gespräch", messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    _setActiveId(id); setMessages([]);
    budgetChatPut(chat);
    setChats(prev => [chat, ...prev]);
  };

  const _persistMessages = async (id, msgs) => {
    if (!id) return;
    const existing  = chats.find(c => c.id === id);
    const firstUser = msgs.find(m => m.role === "user");
    const title     = firstUser ? firstUser.content.slice(0, 40) : "Gespräch";
    const updated   = { ...(existing || { id }), id, title, messages: msgs, updatedAt: Date.now() };
    await budgetChatPut(updated);
    setChats(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [updated, ...prev];
    });
  };

  const handleSend = async (text) => {
    const txt = (text || draft).trim();
    if (!txt || busy) return;
    if (txt.length > BUDGET_MAX_INPUT_CHARS) {
      return handleSend(txt.slice(0, BUDGET_MAX_INPUT_CHARS));
    }
    // Ref aktuell halten für pendingMessage-Mechanismus
    handleSendRef.current = handleSend;
    setDraft("");
    const userMsg = { role: "user", content: txt, ts: Date.now() };
    const after   = [...messages, userMsg];
    setMessages(after);
    setBusy(true);

    // Platzhalter sofort einfügen (für Streaming-Updates)
    const botTs  = Date.now();
    const botPlaceholder = { role: "assistant", content: "…", ts: botTs, streaming: true };
    setMessages([...after, botPlaceholder]);

    const ctx  = buildBudgetContext(state, profil);
    let antwort = "";

    // ── Ollama Streaming (wenn konfiguriert) ─────────────────────────
    const cfg = (typeof window.getOllamaConfig === "function") ? window.getOllamaConfig() : {};
    if (cfg.model && typeof window.ollamaStream === "function") {
      const system = buildBudgetSystemPrompt(ctx);
      const apiMessages = after.map(m => ({ role: m.role, content: m.content }));
      try {
        antwort = await window.ollamaStream(
          cfg.url,
          cfg.model,
          system,
          apiMessages,
          (token) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.streaming) {
                const current = last.content === "…" ? "" : last.content;
                copy[copy.length - 1] = { ...last, content: current + token };
              }
              return copy;
            });
          },
          90000
        );
      } catch (ollamaErr) {
        console.warn("[BudgetBot] Ollama Streaming-Fehler:", ollamaErr?.message);
        // Fallback auf deterministischen Kern
        antwort = deterministicBudgetAntwort(txt, ctx);
      }
    } else {
      // ── Deterministischer Fallback (immer verfügbar) ─────────────────
      antwort = deterministicBudgetAntwort(txt, ctx);
      // Kurze Pause damit der Platzhalter sichtbar bleibt (UX)
      await new Promise(r => setTimeout(r, 180));
    }

    const botMsg = { role: "assistant", content: antwort || "(leere Antwort)", ts: botTs };
    const final  = [...after, botMsg];
    setMessages(final);
    setBusy(false);
    await _persistMessages(activeIdRef.current || activeId, final);
  };

  const handleAlertAktion = (alert) => { if (alert.aktion) handleSend(alert.aktion); };
  const handleProfilSaved = (newProfil) => { setProfil(newProfil); setWizardOpen(false); };

  if (!open) return null;

  if (wizardOpen) {
    return (
      <div className="bot-backdrop" onClick={e => e.target === e.currentTarget && setWizardOpen(false)}>
        <div className="bot-modal">
          <BedarfsanalyseWizard profilInit={profil} onSave={handleProfilSaved} onCancel={() => setWizardOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="bot-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bot-modal">

        <div className="bot-header">
          <button onClick={() => setSidebarOpen(s => !s)} className="bot-header-menu" title="Gespräche" aria-label="Gespräche">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="bot-header-title">
            <div className="bot-header-title-main">BudgetBot</div>
            <div className="bot-header-title-sub" style={{ cursor: "pointer" }} onClick={() => setSettingsOpen(true)} title="KI-Backend konfigurieren">
              {profil ? `Profil: ${fmtEUR(profil.nettoEinkommen || 0)}/Monat` : "Kein Profil"}{" · "}
              <span style={{ color: backend.type === "ollama" ? "var(--accent)" : "var(--text-faint)" }}>
                {backend.label}
              </span>
            </div>
          </div>
          <button onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="KI-Backend" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: "6px", borderRadius: 8, lineHeight: 1,
            fontSize: 16,
          }}>⚙</button>
          <button onClick={onClose} className="bot-header-close" aria-label="Schließen">✕</button>
        </div>

        {/* Profil-Banner */}
        {profilLoaded && !profil ? (
          <div onClick={() => setWizardOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
            background: "oklch(from var(--accent) l c h / 0.08)",
            borderBottom: "1px solid var(--border)", cursor: "pointer",
          }}>
            <div style={{ flex: 1, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
              <strong style={{ color: "var(--accent)" }}>Finanzprofil einrichten</strong> – für personalisierte Budgetanalyse.
            </div>
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Einrichten →</span>
          </div>
        ) : profilLoaded && profil ? (
          <div onClick={() => setWizardOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
            background: "var(--surface-2)", borderBottom: "1px solid var(--border)", cursor: "pointer",
          }}>
            <div style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
              Netto {fmtEUR(profil.nettoEinkommen || 0)} · Sparziel {fmtEUR(profil.sparZielMonatlich || 0)}/Monat
              {profil.finanzielleZiele?.length > 0 && ` · ${profil.finanzielleZiele.length} Ziel(e)`}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Profil bearbeiten</span>
          </div>
        ) : null}

        {/* Settings Panel Overlay */}
        {settingsOpen && (
          <BudgetBotSettingsPanel
            onClose={() => { setSettingsOpen(false); setBackend(detectBudgetBackend()); }}
          />
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 9 }} />
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: "72%", maxWidth: 280,
              background: "var(--bg)", zIndex: 10, display: "flex", flexDirection: "column",
              borderRight: "1px solid var(--border)", boxShadow: "4px 0 20px rgba(0,0,0,0.15)",
            }}>
              <div style={{ padding: "16px 14px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Gespräche</span>
                <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-faint)" }}>✕</button>
              </div>
              <button onClick={() => { _newChat(); setSidebarOpen(false); }} style={{
                margin: "10px 12px", padding: "9px 14px", borderRadius: 10,
                background: "var(--accent)", color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>+ Neues Gespräch</button>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {chats.map(c => (
                  <div key={c.id} onClick={() => { _setActiveId(c.id); setMessages(c.messages || []); setSidebarOpen(false); }} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer",
                    background: c.id === activeId ? "var(--surface-2)" : "transparent", borderBottom: "1px solid var(--border)",
                  }}>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <button onClick={async e => {
                      e.stopPropagation();
                      await budgetChatDelete(c.id);
                      setChats(prev => {
                        const next = prev.filter(x => x.id !== c.id);
                        if (c.id === activeIdRef.current) {
                          if (next.length > 0) {
                            _setActiveId(next[0].id);
                            setMessages(next[0].messages || []);
                          } else {
                            setTimeout(() => _newChat(), 50);
                          }
                        }
                        return next;
                      });
                    }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 14, flexShrink: 0, padding: 2 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="bot-msgs" ref={scrollRef}>
          {messages.length === 0 && !busy && <BudgetSuggestions onPick={s => handleSend(s)} />}
          {messages.map((m, i) => <BudgetMsgBubble key={i} role={m.role} content={m.content} />)}
          {busy && <BudgetTypingIndicator />}
        </div>

        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <textarea
            ref={inputRef}
            className="bot-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Frage zum Budget eingeben…"
            rows={1}
            disabled={busy}
            style={{ resize: "none", flex: 1 }}
          />
          <button onClick={() => handleSend()} disabled={!draft.trim() || busy} style={{
            padding: "0 16px", borderRadius: 12, background: "var(--accent)", color: "#fff",
            border: "none", fontSize: 18, cursor: "pointer",
            opacity: (!draft.trim() || busy) ? 0.45 : 1, transition: "opacity 0.15s",
            alignSelf: "flex-end", height: 42, flexShrink: 0,
          }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════
(function _secureExport() {
  const _defs = { BudgetBotModal, BudgetAlertPanel, computeBudgetAlerts, loadBedarfsanalyse, saveBedarfsanalyse, BedarfsanalyseWizard };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
