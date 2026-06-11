/* global React, Icon, fmtEUR, STEUER_KATEGORIEN, getK */
//
// ════════════════════════════════════════════════════════════════════════
// SteuerBot — In-App Chat-Assistent für deutsche Steuerfragen
// ════════════════════════════════════════════════════════════════════════
//
// • Modal, geöffnet über den FAB im Steuer-Tab.
// • Backends (Priorität):
//     1. Ollama (localhost:11434) — lokales Modell, kein API-Key, kein Datenleck
//     2. Deterministischer Fallback v3 — 28 Themen + NLU (Slots, Dialog-Gedächtnis, Fuzzy, Szenarien)
//   → Kein Proxy, kein Cloud-Dienst, keine externen APIs.
// • Chats werden in IndexedDB persistiert.
// • Vor jeder Antwort wird ein <user_kontext>-Block mit echten App-Daten
//   + den aktuellen Steuerwerten aus tax-config.json injiziert.
//
// Single Source of Truth für die Persona: prompts/steuerbot-system.md
//

// ────────────────────────────────────────────────────────────────────────
// System-Prompt (1:1-Kopie aus prompts/steuerbot-system.md, ohne
// Markdown-Rahmen)
// ────────────────────────────────────────────────────────────────────────
const STEUERBOT_SYSTEM_PROMPT = `<role>
Du bist SteuerBot DE — ein präziser, freundlicher Assistent für deutsche Einkommensteuer und private Abgaben. Du kombinierst das Fachwissen eines erfahrenen Steuerberaters mit der Verständlichkeit eines guten Lehrers. Du ersetzt keinen Steuerberater, aber du hilfst Nutzern, ihre steuerliche Situation zu verstehen, Fehler zu vermeiden und Optimierungspotenzial zu erkennen.
</role>

<steuerwerte>
Du hast KEINE Web-Suchfunktion. Verwende stattdessen ausschließlich:
1. Die Werte aus dem <user_kontext> (aktuelle App-Daten des Nutzers)
2. Den <aktuelle_steuerwerte>-Block (verifizierte Werte aus der App-Konfiguration,
   täglich von GitHub aktualisiert — zuverlässiger als eine Web-Suche)
3. Dein Trainingswissen für Konzepte und Paragraphen

WENN du dir bei einem konkreten Wert nicht sicher bist: Sage es klar und weise
auf offizielle Quellen hin (BMF, ELSTER.de, Finanztip.de).
</steuerwerte>

<scope>
Du beantwortest ausschließlich Fragen zu:
- Einkommensteuer (§§ 1–55 EStG): Arbeitslohn, Kapitalerträge, Vermietung, Selbstständigkeit
- Lohnsteuer und Steuerklassen (I–VI)
- Solidaritätszuschlag und Kirchensteuer
- Werbungskosten (§ 9 EStG): Homeoffice-Pauschale, Pendlerpauschale, Arbeitsmittel
- Sonderausgaben (§ 10 EStG): Vorsorgeaufwendungen, Spenden, Ausbildungskosten
- Außergewöhnliche Belastungen (§§ 33–33b EStG)
- Steuerliche Behandlung von Kapitalerträgen, ETF, Dividenden, Freistellungsauftrag
- Steuererklärung: Fristen, Formulare, ELSTER, Belege
- Grundfreibetrag, Steuerfreibeträge, Pauschbeträge (aktuell 2024/2025/2026)
- Steuerliche Absetzbarkeit von Versicherungen, Altersvorsorge (Riester, Rürup)

Nicht erlaubt:
- Rechtsberatung (Familienrecht, Erbrecht, Vertragsrecht)
- Unternehmenssteuer, GmbH, Körperschaftsteuer, Gewerbesteuer
- Steuerrecht anderer Länder
- Konkrete Erstellung von Steuererklärungen (nur Erklärung der Methodik)
- Prognosen zu zukünftigen Steueränderungen als Fakten

Falls eine Frage außerhalb des Scopes liegt: Klar benennen, warum, und auf einen Steuerberater oder das zuständige Finanzamt verweisen.
</scope>

<behavior>
Antwortstil:
- Immer auf Deutsch
- Präzise, aber verständlich — kein unnötiges Juristendeutsch
- Paragraphen zitieren wenn relevant (z.B. "laut § 9 Abs. 1 EStG"), aber danach sofort erklären was das bedeutet
- Konkrete Zahlen aus dem User-Kontext bevorzugen vor generischen Werten
- Berechnungen schrittweise zeigen wenn der Nutzer es wünscht oder die Frage numerisch ist
- Am Ende jeder komplexen Antwort: kurze Zusammenfassung in 2–3 Sätzen

Hinweis-Pflicht: Bei Fragen mit erheblichen steuerlichen Konsequenzen (Immobilienkauf, Schenkung, Betriebsaufgabe, hohe Kapitalerträge >10.000 €) immer abschließend empfehlen, einen Steuerberater zu konsultieren. Formulierung: "Für deinen konkreten Fall empfehle ich, das mit einem Steuerberater zu verifizieren — die individuellen Umstände können hier entscheidend sein."

Nie: Absolute Garantien geben ("Du sparst definitiv X €"), falsche Sicherheit vermitteln oder Haftung übernehmen.
</behavior>

<response_format>
Kurze Frage: direkte Antwort in 2–4 Sätzen, keine Überschriften.
Mittlere Frage: kurze Einleitung, Bullet Points, Beispielrechnung, Belege-Hinweis.
Komplexe Frage: Situationseinschätzung, Gliederung mit Zwischenüberschriften, Prioritäten, Beispiel, Steuerberater-Hinweis, Zusammenfassung.

Berechnungen IMMER als ausgerichteter Block mit Monospace-tauglicher Tabulierung, z.B.:

    Bruttolohn:           55.000 €
    − Werbungskosten:      1.260 €
    − Pendlerpauschale:      912 €
    = zvE:                52.828 €
</response_format>

<user_kontext>
Vor jeder Konversation bekommst du einen <user_kontext>-Block mit den echten Daten des aktuellen Nutzers (Steuer-Profil, Belege, Kategorien, laufendes Jahr). Bevorzuge IMMER diese Werte vor generischen Beispielzahlen. Wenn der Block sagt "Belege Werbungskosten 1.842 €", rechne damit — nicht mit einer erfundenen Zahl. Wenn die Info bereits im Kontext steht, nicht nochmal fragen.
</user_kontext>

<aktuelle_steuerwerte_hinweis>
Der <aktuelle_steuerwerte>-Block im <user_kontext> enthält alle relevanten
Freibeträge, Pauschalen und Grenzen für das aktuelle Jahr — direkt aus der
verifizierten App-Konfiguration (Stand: täglich von GitHub aktualisiert).
Verwende IMMER diese Werte, wenn nach konkreten Beträgen gefragt wird.
</aktuelle_steuerwerte_hinweis>

<guardrails>
- Wenn der Nutzer nach einer konkreten Zahl fragt ohne genug Angaben UND der user_kontext liefert sie auch nicht: nachfragen.
- Wenn im <user_kontext> das Bundesland fehlt (steht als "nicht angegeben")
  UND die Frage kirchensteuerrelevant ist: Frage SOFORT nach dem Bundesland
  bevor du antwortest. Formulierung: "Für die Kirchensteuerberechnung brauche
  ich noch dein Bundesland — wo wohnst du?"
- Wenn im <user_kontext> kein Bruttoeinkommen steht (oder 0 €) UND der Nutzer
  nach konkreten Steuerersparnissen fragt: Frage nach Bruttoeinkommen und
  Steuerklasse bevor du Zahlen nennst. Formulierung: "Um konkrete Beträge zu
  berechnen, brauche ich kurz: Bruttojahresgehalt und Steuerklasse?"
- Wenn im <user_kontext> Homeoffice-Tage fehlen UND nach Homeoffice gefragt wird:
  Frage nach den genauen Homeoffice-Tagen im Jahr.
- Bei allen anderen fehlenden Feldern: maximal EINE Nachfrage pro Antwort.
  Priorität: Bundesland > Brutto > Homeoffice-Tage > Rest.
  Nicht mehrere fehlende Felder gleichzeitig abfragen.
- Wenn die Frage unklar ist: einmal kurz nachfragen, nicht raten.
- Keine Empfehlung zu konkreten Steuerberatern, Kanzleien oder Software-Produkten.
- Keine politischen Aussagen zu Steuerpolitik.
- Wenn der Nutzer sagt "du hast gesagt X" aber X falsch ist: korrigieren, nicht bestätigen.
</guardrails>`;

// ════════════════════════════════════════════════════════════════════════
// IndexedDB für Chat-Persistenz (separater DB-Name, eigener Store)
// ════════════════════════════════════════════════════════════════════════
const CHATS_DB_NAME = "ausgaben-trocken-chats";
const CHATS_DB_VERSION = 1;
const CHATS_STORE = "chats";

let _chatsDbPromise = null;
function _openChatsDb() {
  if (_chatsDbPromise) return _chatsDbPromise;
  _chatsDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nicht verfügbar."));
      return;
    }
    const req = indexedDB.open(CHATS_DB_NAME, CHATS_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CHATS_STORE)) {
        db.createObjectStore(CHATS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Chat-DB open failed"));
  });
  return _chatsDbPromise;
}

async function chatPut(chat) {
  // Prio-1: Nachrichten verschlüsseln wenn PIN-Schlüssel aktiv
  let toStore = chat;
  if (typeof window.secureChatEncrypt === "function") {
    try {
      const plainJson  = JSON.stringify(chat.messages);
      const encJson    = await window.secureChatEncrypt(plainJson);
      const didEncrypt = encJson !== plainJson;
      toStore = { ...chat, messages: encJson, _msgEnc: didEncrypt };
    } catch { /* Fallback: unverschlüsselt speichern */ }
  }
  const db = await _openChatsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readwrite");
    const r  = tx.objectStore(CHATS_STORE).put(toStore);
    r.onsuccess = () => resolve();
    r.onerror   = () => reject(r.error);
  });
}

async function chatDelete(id) {
  const db = await _openChatsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHATS_STORE, "readwrite");
    const r = tx.objectStore(CHATS_STORE).delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function chatList() {
  try {
    const db = await _openChatsDb();
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(CHATS_STORE, "readonly");
      const r  = tx.objectStore(CHATS_STORE).getAll();
      r.onsuccess = () => {
        const items = r.result || [];
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(items);
      };
      r.onerror = () => reject(r.error);
    });
    // Prio-1: Nachrichten entschlüsseln wenn _msgEnc gesetzt
    for (const c of all) {
      if (c._msgEnc && typeof c.messages === "string" && typeof window.secureChatDecrypt === "function") {
        try {
          const plain = await window.secureChatDecrypt(c.messages);
          c.messages = JSON.parse(plain);
        } catch { c.messages = []; }
      } else if (!Array.isArray(c.messages)) {
        // Altdaten-Fallback: wenn messages kein Array ist (Klartext-String ohne _msgEnc)
        try { c.messages = JSON.parse(c.messages); } catch { c.messages = []; }
      }
    }
    return all;
  } catch {
    return [];
  }
}

// NEU: Feature B — User-Kontext-Block mit Interview-Antworten und Grenzsteuersatz
function buildUserContext({ tweaks = {}, state = {}, investments = {}, interviewAnswers = {} } = {}) {
  const year    = new Date().getFullYear();
  const yearStr = String(year);
  const ia      = interviewAnswers || {};

  // ── Basis-Profil ──
  const sk        = tweaks.steuerklasse || ia.steuerklasse || 1;
  const fam       = tweaks.familienstand || ia.familienstand || "ledig";
  const bundesland = ia.bundesland || tweaks.bundesland || null;
  const kst       = ia.kirchenmitglied ?? tweaks.kirchensteuer ?? false;
  const berufstyp = ia.berufstyp || tweaks.berufstyp || "arbeitnehmer";

  // Kirchensteuer-Satz aus Config ableiten
  const _kstCfg  = (typeof getK === "function" && getK(year)) ? getK(year).kirchensteuer_satz : {};
  const _kistDez = bundesland ? (_kstCfg[bundesland] ?? _kstCfg.default ?? 0.09) : 0.09;
  const kistSatz = Math.round(_kistDez * 100);  // als Prozentzahl für Anzeige
  const blLabel   = {
    BY: "Bayern", BW: "Baden-Württemberg", BE: "Berlin", NW: "Nordrhein-Westfalen",
    HH: "Hamburg", HE: "Hessen", NI: "Niedersachsen", SN: "Sachsen",
  }[bundesland] || bundesland || "nicht angegeben";

  // ── Einkommens-Daten ──
  const brutto   = Number(ia.jahresbrutto) || Number(ia.brutto) || 0;
  const kinder   = ia.kinder === true ? 1 : 0;

  // Grenzsteuersatz berechnen wenn Brutto bekannt
  // Nutzt _calcPreciseGST mit vollständigem SV-Abzug (RV, KV, ALV, PV) anstatt brutto*0.80-Näherung
  let grenzsteuersatz = null;
  if (brutto > 0) {
    if (typeof _calcPreciseGST === "function") {
      grenzsteuersatz = Math.round(_calcPreciseGST({ brutto, _ia: ia }, year) * 100);
    } else if (typeof calcGrenzsteuersatz === "function" && typeof getK === "function") {
      // Fallback: vereinfachte SV-Abzüge (nur falls _calcPreciseGST nicht verfügbar)
      const Kfb = getK(year);
      // Kfb kommt von getK() — alle SV-Felder immer vorhanden
      const bbgKv = Kfb.bbg_kv_monatlich * 12;
      const bbgRv = Kfb.bbg_rv_monatlich * 12;
      const sv = Math.round(
        Math.min(brutto, bbgKv) * Kfb.sv_kv +
        Math.min(brutto, bbgRv) * (Kfb.sv_rv + Kfb.sv_alv) +
        Math.min(brutto, bbgKv) * Kfb.sv_pv
      );
      const zvE = Math.max(0, brutto - sv - Kfb.wk_pauschale);
      grenzsteuersatz = Math.round(calcGrenzsteuersatz(zvE, yearStr) * 100);
    }
  }

  // ── Arbeitssituation ──
  const homeoffice_tage  = Number(ia.homeoffice_tage) || 0;
  const buerotage        = Number(ia.buerotage) || Number(ia.arbeitstage) || 0;
  const pendler_km       = Number(ia.arbeitsweg_km) || Number(ia.entfernung_km) || 0;
  const pendler2_km      = ia.zweiter_standort === true ? (Number(ia.zweiter_standort_km) || 0) : 0;
  const pendler2_tage    = ia.zweiter_standort === true ? (Number(ia.zweiter_standort_tage) || 0) : 0;

  // ── Vorsorge ──
  const kv_beitrag        = Number(ia.kv_beitrag_jahres) || 0;
  const riester_eigen     = Number(ia.riester_eigenanteil) || 0;
  const bav_beitrag       = Number(ia.bav_beitrag_jahres) || 0;
  const unterhalt_betrag  = Number(ia.unterhalt_betrag_jahres) || 0;

  // ── Belege ──
  const allReceipts  = state.receipts || [];
  const yearReceipts = allReceipts.filter(r => (r.datum || "").startsWith(yearStr));
  const katSums      = {};
  for (const r of yearReceipts) {
    const k = r.steuerkat || "privat";
    katSums[k] = (katSums[k] || 0) + (Number(r.gesamtbetrag) || 0);
  }

  // ── Kapitalerträge ──
  const trades    = (investments?.trades || []).filter(t => (t.date || "").startsWith(yearStr));
  const kapGewinn = trades.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const kapVerlust= trades.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  // ── Steuer-Konstanten ──
  const K = typeof getK === "function" ? getK(year) : null;

  // ─────────────────────────────────────────────────────────────
  // Kontext zusammenbauen
  // ─────────────────────────────────────────────────────────────
  const lines = [
    `<user_kontext>`,
    `Steuerjahr: ${year}`,
    ``,
    `=== PERSÖNLICHES STEUER-PROFIL ===`,
    `Steuerklasse: ${sk}`,
    `Familienstand: ${fam}`,
    `Bundesland: ${blLabel}${bundesland ? ` (${bundesland})` : ""}`,
    `Kirchensteuerpflichtig: ${kst ? `ja (${kistSatz} %)` : "nein"}`,
    `Beschäftigung: ${berufstyp}`,
    `Kinder: ${kinder > 0 ? kinder : "keine"}`,
    ``,
  ];

  if (brutto > 0) {
    lines.push(`=== EINNAHMEN ===`);
    lines.push(`Jahresbrutto: ${fmtEUR(brutto)}`);
    if (grenzsteuersatz !== null) {
      lines.push(`Grenzsteuersatz (geschätzt): ca. ${grenzsteuersatz} %`);
      lines.push(`→ Jeder zusätzlich abgesetzte Euro spart ca. ${grenzsteuersatz} Cent Steuern`);
    }
    lines.push(``);
  }

  // Build location list for context
  const stCtxRaw = (tweaks.arbeitsstaetten || []).filter(s => Number(s.km) > 0);
  let ctxLocs;
  if (stCtxRaw.length > 0) {
    ctxLocs = stCtxRaw.map((s, idx) => ({
      name: s.name || ("Standort " + (idx + 1)),
      km: Number(s.km),
      tage: idx === 0 ? Math.max(0, Number(s.tage) - homeoffice_tage) : (Number(s.tage) || 0)
    }));
  } else {
    const p1tage = Math.max(0, buerotage - homeoffice_tage);
    ctxLocs = [];
    if (pendler_km > 0) ctxLocs.push({ name: "Hauptstandort", km: pendler_km, tage: p1tage });
    if (pendler2_km > 0) ctxLocs.push({ name: "Zweiter Standort", km: pendler2_km, tage: pendler2_tage });
  }
  function _ctx_pendler(km, tage) {
    if (km <= 0 || tage <= 0) return 0;
    if (year >= 2026) return Math.round(tage * km * (K ? K.entfernung_km_ab_21 : 0.38));
    const z1 = Math.min(km, 20), z2 = Math.max(0, km - 20);
    return Math.round(tage * (z1 * (K ? K.entfernung_km_bis_20 : 0.30) + z2 * (K ? K.entfernung_km_ab_21 : 0.38)));
  }
  const ctxPendlBetr = ctxLocs.map(s => _ctx_pendler(s.km, s.tage));
  const ctxPendlGes = ctxPendlBetr.reduce((a, b) => a + b, 0);

  if (homeoffice_tage > 0 || buerotage > 0 || ctxLocs.length > 0) {
    lines.push(`=== ARBEITSSITUATION ===`);
    if (buerotage > 0)       lines.push(`Arbeitstage/Jahr gesamt: ${buerotage}`);
    if (homeoffice_tage > 0) lines.push(`Homeoffice-Tage/Jahr: ${homeoffice_tage}`);
    ctxLocs.forEach((s, i) => {
      lines.push(`${s.name}: ${s.km} km einfach · ${s.tage} Fahrtage · Pauschale ${fmtEUR(ctxPendlBetr[i])}`);
    });
    if (ctxPendlGes > 0) lines.push(`Pendlerpauschale gesamt: ${fmtEUR(ctxPendlGes)}`);
    lines.push(``);
  }

  if (kv_beitrag > 0 || riester_eigen > 0 || bav_beitrag > 0 || unterhalt_betrag > 0) {
    lines.push(`=== VORSORGE & SONDERAUSGABEN ===`);
    if (kv_beitrag > 0)       lines.push(`KV-Beitrag/Jahr: ${fmtEUR(kv_beitrag)}`);
    if (riester_eigen > 0)    lines.push(`Riester-Eigenanteil/Jahr: ${fmtEUR(riester_eigen)}`);
    if (bav_beitrag > 0)      lines.push(`bAV-Eigenbeitrag/Jahr: ${fmtEUR(bav_beitrag)}`);
    if (unterhalt_betrag > 0) lines.push(`Unterhaltszahlungen/Jahr: ${fmtEUR(unterhalt_betrag)}`);
    lines.push(``);
  }

  const steuerBelege = Object.entries(katSums).filter(([k]) => k !== "privat" && katSums[k] > 0);
  if (steuerBelege.length > 0) {
    lines.push(`=== ERFASSTE BELEGE ${year} (STEUERRELEVANT) ===`);
    const katLabels = {
      werbungskosten:    "Werbungskosten (Anlage N)",
      sonderausgaben:    "Sonderausgaben",
      haushaltsnahe:     "Haushaltsnahe Leistungen §35a",
      aussergewoehnlich: "Außergewöhnliche Belastungen §33",
    };
    for (const [k, v] of steuerBelege) {
      lines.push(`  ${katLabels[k] || k}: ${fmtEUR(v)}`);
    }
    lines.push(``);
  } else {
    lines.push(`Belege ${year}: noch keine steuerrelevanten Belege erfasst.`);
    lines.push(``);
  }

  // ── Investment-Portfolio-Übersicht ──
  const allPurchases = investments?.purchases || [];
  const kapitalInvestiert = allPurchases.reduce((s, p) => s + (Number(p.wert) || 0), 0);
  const offenePositionen = allPurchases.filter(p => !((investments?.trades || []).some(t => t.purchaseId === p.id))).length;
  const verh = (ia.familienstand === "verheiratet" || tweaks.familienstand === "verheiratet");
  const sparerPausch = K ? (verh ? (K.sparerpauschbetrag_verheiratet || 2000) : (K.sparerpauschbetrag_single || 1000)) : 1000;

  if (trades.length > 0 || kapitalInvestiert > 0) {
    lines.push(`=== KAPITALERTRÄGE & PORTFOLIO ${year} ===`);
    if (kapitalInvestiert > 0) lines.push(`Investiertes Kapital gesamt: ${fmtEUR(kapitalInvestiert)}`);
    if (allPurchases.length > 0) lines.push(`Positionen im Depot: ${allPurchases.length} (davon ${offenePositionen} offen)`);
    if (trades.length > 0) {
      lines.push(`Realisierte Gewinne ${year}: ${fmtEUR(kapGewinn)}`);
      lines.push(`Realisierte Verluste ${year}: ${fmtEUR(kapVerlust)}`);
      lines.push(`Saldo ${year}: ${fmtEUR(kapGewinn - kapVerlust)}`);
      lines.push(`Sparerpauschbetrag: ${fmtEUR(sparerPausch)} ${verh ? "(verheiratet)" : "(Single)"}`);
      const steuerpflichtig = Math.max(0, (kapGewinn - kapVerlust) - sparerPausch);
      if (steuerpflichtig > 0) {
        lines.push(`→ Steuerpflichtig: ${fmtEUR(steuerpflichtig)} → KapESt ca. ${fmtEUR(Math.round(steuerpflichtig * 0.26375))}`);
      } else {
        lines.push(`→ Sparerpauschbetrag reicht aus — keine KapESt fällig`);
        lines.push(`→ Noch ${fmtEUR(sparerPausch - Math.max(0, kapGewinn - kapVerlust))} Freigrenze verfügbar`);
      }
    }
    lines.push(``);
  }

  if (K) {
    lines.push(`=== GELTENDE STEUERWERTE ${year} ===`);
    lines.push(`Grundfreibetrag: ${fmtEUR(K.grundfreibetrag)}`);
    lines.push(`WK-Pauschale: ${fmtEUR(K.wk_pauschale)}`);
    lines.push(`Homeoffice-Pauschale: ${K.homeoffice_pro_tag}€/Tag, max ${K.homeoffice_max_tage} Tage = max ${fmtEUR(K.homeoffice_pro_tag * K.homeoffice_max_tage)}/Jahr`);
    lines.push(`Pendlerpauschale: ${K.entfernung_km_ab_21.toFixed(2).replace(".", ",")}€/km (ab 2026: alle km)`);
    lines.push(`Sparerpauschbetrag: ${fmtEUR(K.sparerpauschbetrag_single)} (Single) / ${fmtEUR(K.sparerpauschbetrag_verheiratet)} (Verh.)`);
    lines.push(``);
  }

  // Aktuelle Steuerwerte aus tax-config.json (verifiziert, täglich von GitHub)
  if (K) {
    const raw = window.TAX_CONFIG_RAW || {};
    lines.push(`=== AKTUELLE STEUERWERTE ${year} (VERIFIZIERT) ===`);
    lines.push(`Grundfreibetrag: ${fmtEUR(K.grundfreibetrag)}`);
    lines.push(`WK-Pauschale (AN): ${fmtEUR(K.wk_pauschale)}`);
    lines.push(`Homeoffice-Pauschale: ${K.homeoffice_pro_tag}€/Tag · max ${K.homeoffice_max_tage} Tage = max ${fmtEUR(K.homeoffice_pro_tag * K.homeoffice_max_tage)}/Jahr`);
    lines.push(`Pendlerpauschale: ${Number(year) >= 2026 ? "0,38€/km ab km 1 (vereinheitlicht ab 2026)" : "0,30€/km bis 20 km · 0,38€/km ab km 21"}`);
    lines.push(`Sparerpauschbetrag: ${fmtEUR(K.sparerpauschbetrag_single)} (Single) / ${fmtEUR(K.sparerpauschbetrag_verheiratet)} (verheiratet)`);
    lines.push(`Kapitalertragsteuer: 25 % + Soli`);
    lines.push(`§35a Abs.2 (Haushaltsnahe DL): max. 4.000 €/Jahr Ermäßigung (20% von max. 20.000 € Aufwendungen)`);
    lines.push(`§35a Abs.3 (Handwerker): max. 1.200 €/Jahr Ermäßigung (20% von max. 6.000 € Arbeitskosten)`);
    if (raw.minijob_grenze_monatlich?.[String(year)]) {
      lines.push(`Minijob-Grenze: ${fmtEUR(raw.minijob_grenze_monatlich[String(year)])}/Monat`);
    }
    if (raw.homeoffice) {
      lines.push(`Konfigurationsstand: ${raw.meta?.letzte_aktualisierung || "unbekannt"}`);
    }
    lines.push(``);
  }

  lines.push(`</user_kontext>`);
  return lines.join("\n");
}

// ════════════════════════════════════════════════════════════════════════
// UI-Komponenten
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// BACKEND — Nur Ollama (lokal, kein Datenleck)
// Fallback: deterministischer Steuerberater-Kern (immer aktiv, kein KI nötig)
// Proxy + window.claude + externe Dienste wurden bewusst entfernt.
// Ollama-Konfiguration (URL + Modell) wird über getOllamaConfig/setOllamaConfig
// aus utils.jsx verwaltet (gemeinsam mit BudgetBot).
// ════════════════════════════════════════════════════════════════════════

// Sicherheit: Eingabe-Längenlimit (~250 Wörter / 1500 Zeichen)
const MAX_INPUT_CHARS = 1500;

// detectBackend — liest die gemeinsame Ollama-Config aus utils.jsx
function detectBackend() {
  const cfg = (typeof window.getOllamaConfig === "function") ? window.getOllamaConfig() : {};
  if (cfg.model) return { type: "ollama", label: `Ollama (${cfg.model})` };
  return { type: "fallback", label: "Offline-Modus" };
}

// ════════════════════════════════════════════════════════════════════════
// DETERMINISTISCHER STEUERBERATER-KERN
// Antwortet ohne KI direkt aus der Tax-Engine.
// 28 Themenbereiche — jeder mit Paragraphenangabe, Berechnung, Handlungsempfehlung.
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// INTENT-ERKENNUNG — Zweistufig
//
// Stufe 1: Regex-Matching (schnell, exakt, erweitertes Vokabular)
//   Jeder Intent hat breite Patterns für natürliche Sprache + Fachbegriffe
//   + Umschreibungen + häufige Tippfehler.
//
// Stufe 2: Semantisches Keyword-Scoring (Fallback)
//   Wenn kein Regex greift, wird der Text gegen gewichtete Keyword-Listen
//   aller Intents gescort. Der Intent mit dem höchsten Score gewinnt.
//   Schwelle: mindestens 2 Punkte. So werden Umschreibungen erkannt, die
//   kein einzelnes Keyword direkt nennen.
// ════════════════════════════════════════════════════════════════════════
const _INTENTS = [
  { key: "hilfe", re: /^(hilfe|help|\?+$|was kannst|befehle|übersicht|themen|wie funktioniert\s+(das|der\s+(steuerbot|bot|assistent)|diese?\s*app|hier)?$|was weißt|was beantwort|zeig.*funktionen|was kann der|womit kann|wobei hilfst|wie benutz|anleitung|tutorial|startseite|los geht|fangen wir an)/ },

  { key: "profil", re: /mein\s*(steuer)?profil|meine\s*(steuer)?\s*daten|zeig.*mein(e)?|profil.*zusammenfassung|zusammenfassung.*profil|meine\s*situation|mein\s*stand|überblick.*steuer|steuer.*überblick|wie\s*stehe\s*ich|meine\s*zahlen|was\s*hast\s*du\s*(von\s*mir|über\s*mich)|meine\s*angaben|mein\s*steuerbild/ },


  { key: "homeoffice", re: /homeoffice|home.?office|heimbüro|zu\s*hause\s*(arbeiten|gearbeitet|tätig)|von\s*zu\s*hause\s*(aus\s*)?(arbeiten|arbeit(en)?|tätig|angestellt)|zuhause.*arbeit|arbeit.*zuhause|remote.*arbeit|arbeit.*remote|im\s*home\s*office|homeoffice.?pauschale|homeoffice.?(tage|kosten|absetzen|steuer)|pauschale.*homeoffice|arbeit\s+von\s+daheim|daheim\s+arbeiten|wohnzimmer\s+büro|schreibtisch\s+zu\s+hause|büro\s+(in\s+der\s+)?(wohnung|daheim)|arbeitszimmer\s+daheim|mobiles\s+arbeiten|telearbeit|home\s*office\s*(tag|tage|stunden|monat)|wie\s+viele\s+tage\s+homeoffice|rechne\s+mein.*homeoffice|homeoffice.*berechnen|wie\s+viel\s+(bringt|spart)\s+homeoffice|homeoffice.*was\s+krieg\s+ich/ },

  { key: "pendler", re: /pendler|pendelpauschale|pendlerpauschale|fahrtkosten\s*(zur\s*arbeit|ins\s*büro)?|arbeitsweg|entfernung.*arbeit|km.*arbeit|km.*büro|täglich.*pendel|pendle[nt]|km.*zur\s*arbeit|ins\s*büro\s*fahren|zur\s*arbeit\s*fahren|arbeit.*fahren|büro.*fahren|mit\s*(dem|der)\s*(bahn|auto|bus|rad|fahrrad)\s*(zur\s*arbeit|ins\s*büro)|weg\s*(zur\s*arbeit|ins\s*büro)|kilometer.*arbeit|km.*täglich|täglich.*km|wie\s+viel\s+(bekomm|krieg)\s+ich\s+für.*fahren|fahrtweg|fahrtstrecke|einfache\s+strecke|hin-\s*und\s*rückfahrt|einpendeln|ich\s+fahre\s+(täglich|jeden\s+tag)|jeden\s+tag\s+(ins\s*büro|zur\s*arbeit|zum\s*arbeitsplatz)|zur\s*arbeit\s*(pendeln|pendel)|das\s+fahren\s+zur\s+arbeit|meinen\s+arbeitsweg\s+absetzen|entfernungspauschale|entfernung\s+(von|bis)\s+arbeit/ },

  { key: "werbungskosten", re: /werbungskosten|anlage\s*n|wk.?pauschale|wk\s*pauschale|beruflich.*abset|einzelnachweis|berufliche\s*(ausgaben|kosten|aufwendungen)|berufskosten|berufsbedingter?\s*(aufwand|kosten|ausgaben)|was\s+kann\s+ich\s+beruflich\s+absetzen|kosten\s+(für\s+die\s+)?(arbeit|beruf)|arbeitsbezogene\s+kosten|dienstlich.*kosten|arbeit.*kosten.*absetzen|kosten\s+vom\s+arbeitgeber\s+nicht\s+erstattet|nicht\s+erstattete\s+(kosten|ausgaben)|eigene\s+kosten\s+für\s+(die\s+)?arbeit|selbst\s+bezahlte\s+(berufliche\s+)?kosten|belege\s+(für\s+die\s+)?arbeit|wk\s+über\s+pauschale|1\.230|1230\s*euro|mehr\s+als\s+pauschbetrag|übersteigt.*pauschale/ },

  { key: "bruttoNetto", re: /netto.*gehalt|gehalt.*netto|brutto.*netto|netto.*lohn|lohn.*netto|was\s+bleibt\s+(mir\s+)?(netto|übrig|übrig\s+bleiben|nach\s+steuern)|abzüge.*gehalt|wie\s+viel\s+netto|\bnetto\s+(von|bei|für|aus)\s+\d|netto\s+bei|gehalt.*rechner|lohn.*rechner|brutto.?netto.?rechner|was\s+(bekomm|krieg)\s+ich\s+(raus|ausgezahlt|überwiesen)|ausgezahlt\s+bekommen|auszahlung\s+bei|was\s+bleibt\s+(auf\s+dem\s+konto|übrig)|monatliches\s+netto|jahres.?netto|nach\s+(abzug\s+von\s+)?(steuern|sv|sozialversicherung)|steuer.*abzug.*gehalt|wie\s+hoch\s+ist\s+mein\s+netto|abgaben\s+auf\s+mein\s+gehalt|monatsgehalt\s+nach\s+steuern|netto.?rechnung|ich\s+verdiene\s+\d|bei\s+\d+\s*(€|euro|k)\s+(brutto|gehalt)|(mein\s+)?(brutto\s+ist|verdienst\s+beträgt|gehalt\s+beträgt)/ },

  { key: "steuerklasse", re: /steuerklasse|sk\s*[1-6]|klasse\s*[1-6]|wechsel.*steuerklasse|steuerklasse.*wechseln|welche\s+steuerklasse|in\s+welche\s+klasse|steuerklasse\s+(für\s+)?(verheiratete|alleinerziehende|single|ledige)|klasse\s+(3|iii|drei|4|iv|vier|5|v|fünf)|faktorverfahren|faktor.?methode|iii\s*\/\s*v|iv\s*\/\s*iv|steuerklasse\s+ändern|steuerklassen\s+(kombinieren|optimieren|vergleichen)|mit\s+(partner|ehemann|ehefrau|gattin|gatten).*steuerklasse|was\s+ist\s+besser.*klasse|klasse\s+3\s+oder\s+4|klasse\s+iii\s+oder\s+iv|klasse\s+wechseln|steuerklassenwechsel|antrag.*steuerklasse|lohnsteuerabzug.*klasse/ },

  { key: "grundfreibetrag", re: /grundfreibetrag|steuerfrei.*betrag|bis\s+wann\s+(ist|bin|bleibe)\s+ich\s+steuerfrei|ab\s+wann\s+(muss|zahle|fängt)\s+man|freibetrag|steuer.?frei\s+(bis|unter|ab)\s+\d|null\s+steuern|wann\s+(zahle|bin\s+ich|muss\s+ich)\s+(keine\s+)?steuern|kein(e)?\s+steuern\s+(zahlen|ab)\s+bis|grenze.*steuerpflicht|steuer.*freibetrag|wie\s+viel\s+darf\s+ich\s+(verdienen|einnehmen).*steuerfrei|mindest.?betrag.*steuer|einkommensteuer\s+ab\s+wann|steuerpflichtig\s+ab\s+wann|steuerfrei\s+bis\s+wann|wie\s+hoch\s+ist\s+der\s+grundfreibetrag|\d\d\.\d\d\d\s*€\s*steuerfrei|steuerpflicht\s+(beginnt|erst\s+ab)|pauschbeträge?\s+überblick/ },

  { key: "sonderausgaben", re: /sonderausgaben|vorsorgeaufwendungen|private\s*kv.*steuer|krankenversicherung.*abset|krankenversicherungsbeitrag.*steuer|kv.?beitrag.*steuer|krankenversicherung.*steuererklärung|versicherung.*absetzen|was\s+(kann\s+ich\s+von\s+)?versicherung(sbeiträge?).*absetzen|private\s+krankenversicherung\s+(steuer|absetzen)|gesetzliche\s+krankenversicherung\s+(absetzen|steuer)|spenden.*steuererklärung|spenden\s+absetzen|kirchensteuer.*sonderausgaben|berufsausbildung.*absetzen|weiterbildung.*absetzen|fortbildung.*sonderausgaben|schulgeld.*absetzen|studiengebühren.*absetzen|§\s*10\s*estg|sonderausgaben.?pauschale/ },

  { key: "haushaltsnahe", re: /\bputzfrau\b|\bputzmann\b|\bputzkraft\b|haushaltsnahe|§\s*35\s*a|\b35a\b|handwerker.*abset|putzhilfe.*steuer|reinigungskraft.*steuer|haushaltshilfe.*steuer|putzhilfe|putzfrau.*steuer|reinigung.*absetzen|gartenpflege.*steuer|gärtner.*absetzen|haushalt.*absetzen|fensterputzen.*steuer|hausmeister.*absetzen|nebenkostenabrechnung.*steuer|haushaltsdienst|pflegekraft.*absetzen|pflege.*zu\s*hause.*steuer|babysitter.*steuer|kinderfrau.*steuer|fenster\s+(putzen|reinigen).*absetzen|renovierung.*steuer|handwerker\s+(rechnung|kosten|absetzen|steuer)|sanitär.*steuer|elektriker.*absetzen|maler.*absetzen|fliesenleger.*absetzen|reparatur\s+in\s+der\s+wohnung|wohnungsrenovierung.*steuer|§35a.*erklärung|steuerermäßigung.*haushalt/ },

  { key: "kapital", re: /kapitalertrag|kapitalertragsteuer|aktien.*steuer|etf.*steuer|\bkapest\b|abgeltungsteuer|dividende.*steuer|freistellungsauftrag|sparerpauschbetrag|kapitalgewinne|aktie.*verkauft|etf.*verkauft|wertpapier.*steuer|fonds.*steuer|depot.*steuer|gewinne\s+(aus|von|bei|mit)\s+(aktien|etf|wertpapier|fonds|depot)|börsengewinne|kursgewinne|anlagegewinne|ich\s+habe\s+(aktien|etf|fonds|wertpapiere)\s+(verkauft|veräußert)|zinsen.*steuer|tagesgeld.*steuer|sparbuch.*steuer|festgeld.*steuer|ausschüttung.*steuer|thesaurierend.*steuer|broker.*steuer|comdirect.*steuer|trade\s+republic.*steuer|1\s*\.000\s*euro\s*(frei|freistellung)|freistellungsauftrag\s+(stellen|einrichten|vergessen)|steuerfrei.*kapital|depotgewinne\s+versteuern/ },

  { key: "guenstiger", re: /günstigerprüfung|günstigerwahlrecht|§\s*32d|kapital.*persönlich.*steuersatz|anlage\s*kap.*antrag|persönlicher\s+steuersatz.*kapital|niedrigerer\s+steuersatz.*kapital|kapital\s+mit\s+persönlichem\s+satz|25\s*%.*zu\s+viel|kapitalerträge.*einkommensteuertarif/ },

  { key: "soli", re: /\bsoli\b|solidaritätszuschlag|soli\s+(zahlen|fällig|frei|abschaffen|weggefallen)|solidaritäts.?zuschlag|soli\s+noch\s+(zahlen|fällig)|soli\s+(ab\s+)?wann|wer\s+(zahlt|muss).*soli|soli\s+freigrenze|muss\s+ich\s+(noch\s+)?soli\s+zahlen|soli\s+(auf\s+)?kapital|soli\s+2024|soli\s+2025|soli\s+2026/ },

  { key: "kirchensteuer", re: /kirchensteuer|kirchenbeitrag|kirchenmitglied.*steuer|kirche.*abset|kirchenaustritt|aus\s+der\s+kirche\s+(austreten|ausgetreten|ausgetreten)|kirchensteuerpflicht|bin\s+ich\s+kirchensteuerpflichtig|kirchensteuer.*wie\s+viel|satz.*kirchensteuer|kirchensteuer.*satz|konfessionslos.*steuer|ohne\s+kirchensteuer|kirchensteuer\s+sparen|kirchensteuer\s+(kath|ev|evangelisch|katholisch)|evangelisch.*steuer|katholisch.*steuer|kirchensteuer\s+(absetzen|als\s+sonderausgabe)/ },

  { key: "fristen", re: /frist|deadline|bis\s*wann|abgabe.*datum|termin.*steuer|steuererklärung.*wann|wann.*abgeben|wann\s+muss\s+ich|wann\s+(ist|war)\s+(die\s+)?(abgabe|frist)|abgabefrist|steuerfrist|wann\s+(läuft|endet|expire).*frist|noch\s+wie\s+lange|wie\s+lange\s+habe\s+ich\s+noch|frist\s+(verlängern|verlängert)|verlängerung.*steuerfrist|steuerberater.*frist|mit\s+steuerberater.*wann|31\.(07|7)\.|bis\s+zum\s+31|wann\s+ist\s+die\s+steuererklärung\s+fällig|muss\s+ich\s+die\s+steuererklärung\s+abgeben|bin\s+ich\s+(zur\s+)?(abgabe\s+)?(der\s+steuererklärung\s+)?verpflichtet/ },

  { key: "minijob", re: /minijob|mini.?job|\b538\b|\b556\b|\b603\b|geringfügig.*beschäftigung|450.*euro.*job|520.*euro.*job|nebenjob.*steuer|nebeneinnahmen.*steuer|geringfügige\s+(beschäftigung|arbeit|tätigkeit)|jobben\s+neben|zusätzliche\s+(arbeit|job|einnahmen).*steuer|nebentätigkeit.*steuer|zweitjob|zweiter\s+job|neben\s+(meiner\s+)?(arbeit|stelle|anstellung)|auf\s+450|auf\s+520|auf\s+mini.?job\s+basis|selbstständig\s+nebenher|nebenher\s+verdienen|darf\s+ich\s+nebenbei\s+arbeiten|midijob|midi.?job|übergangsbereich\s*sg|mini\s+job\s+steuer/ },

  { key: "riester", re: /\briester\b|riester.?rente|riester.?vertrag|riester.?förderung|riester.?zulagen?|riester.?beitrag|beitrag.*riester|in\s+riester\s+einzahlen|riester\s+(sparen|anlegen|abschließen|lohnt)|lohnt\s+(sich\s+)?riester|riester\s+und\s+steuer|zulagen\s+(riester|altersvorsorge)|grundzulage|kinderzulage.*altersvorsorge|§\s*10a\s*estg|anlage\s*av/ },

  { key: "ruerup", re: /rürup|ruerup|basisrente|rürup.?rente|rürup.?vertrag|rürup.?beitrag|rürup\s+lohnt|lohnt\s+(sich\s+)?rürup|selbstständig.*altersvorsorge|freiberufler.*altersvorsorge|keine\s+gesetzliche\s+rente|§\s*10\s*abs.*nr.*2|anlage\s+vorsorge.*rürup/ },

  { key: "bav", re: /\bbav\b|betriebliche\s*altersvorsorge|direktversicherung|entgeltumwandlung|arbeitgeber.*altersvorsorge|betriebsrente|arbeitgeber.*rente|rente\s+über\s+arbeitgeber|bav\s+(lohnt|beitrag|steuer|einzahlen)|§\s*3\s*nr\s*63|steuerfreie\s+einzahlung.*arbeitgeber|brutto\s+in\s+(rente|vorsorge)|umwandlung\s+bruttolohn|lohnumwandlung|arbeitgeberzuschuss.*altersvorsorge|15\s*%\s*arbeitgeber.*bav|betriebliche\s+vorsorge/ },

  { key: "aussergewoehnlich", re: /außergewöhnlich|§\s*33\b|außergew|krankheitskosten.*abset|zumutbare\s*eigenbelastung|behindert.*pauschbetrag|pflegepauschbetrag|arztkosten.*absetzen|zahnarzt.*steuer|medikamente.*absetzen|medizinische\s+kosten.*steuer|heilbehandlung.*steuer|kur.*steuer|rollstuhl.*steuer|hilfsmittel.*steuer|krankenhauskosten.*steuer|pflege.*zu\s*hause.*steuer|angehörige.*pflegen.*steuer|ich\s+pflege\s+(meine|meinen)|eltern\s+(pflegen|pflege).*steuer|krankheitsbedingt|behinderungsgrad|schwerbehinderung.*steuer|gdb\s*\d|behinderten.*ausweis.*steuer|pflegestufe.*steuer|außerordentliche\s+belastungen|ungewöhnlich\s+hohe\s+kosten.*steuer|hohe\s+(arzt|krankenhaus|pflege)kosten/ },

  { key: "studenten", re: /\bstudier|\bstudent|studium|erststudium|zweitstudium|bafög.*steuer|studienkosten|hochschule.*steuer|uni.*steuer|studium.*absetzen|bachelorarbeit.*steuer|masterarbeit.*steuer|duales\s+studium.*steuer|azubi.*steuer|auszubildende.*steuer|ausbildungskosten|ausbildung.*steuer|berufsausbildung.*steuer|lernmittel.*steuer|studentenjob.*steuer|werkstudent.*steuer|immatrikulation|semesterbeitrag.*steuer|fahrtkosten\s+zur\s+uni|uni.?fahrtkosten|studiengebühren|studienbeitrag|promotion.*steuer|doktorand.*steuer|verlustvortrag.*studium|noch\s+keine\s+einnahmen.*steuer/ },

  { key: "verlust", re: /verlustvortrag|verlustverrechnung|negativer\s*(zve|einkommen)|verluste\s*vortragen|verlustabzug|ich\s+habe\s+(verluste|verlust|minus\s+gemacht)|verluste\s+(mit|aus|bei)\s+(aktien|etf|fonds|depot|kapital)|verluste\s+von\s+vorjahren|verluste\s+übertragen|verluste\s+mit\s+gewinnen\s+verrechnen|verrechnung.*verluste|aktien.*verlust.*steuer|verlustbescheinigung|verlustverrechnung.*depot|15\.\s*dezember.*verlust|verlust\s+(rücktragen|vortragen)|§\s*10d|steuerlicher\s+verlust|negatives\s+einkommen|verluste\s+aus\s+(früheren|vergangenen)\s+jahren/ },

  { key: "arbeitsmittel", re: /arbeitsmittel|\bgwg\b|geringwert|bürostuhl.*steuer|laptop.*steuer|computer.*steuer|sofortabschreibung|arbeitszimmer|laptop\s+(absetzen|als\s+werbungskosten)|notebook.*absetzen|pc.*absetzen|monitor.*absetzen|tastatur.*absetzen|büroausstattung.*absetzen|schreibtisch.*absetzen|drucker.*absetzen|headset.*absetzen|fachliteratur.*absetzen|bücher.*beruflich.*absetzen|handy.*beruflich.*absetzen|smartphone.*beruflich.*absetzen|beruflich\s+(genutzter?|verwendeter?|eingesetzter?)\s+(laptop|computer|pc|handy|tablet|stuhl|schreibtisch)|800\s*euro.*absetzen|gwg\s*grenze|sofort.*abschreiben|ich\s+habe\s+(einen\s+)?(laptop|computer|stuhl)\s+(für\s+die\s+arbeit\s+)?(gekauft|angeschafft)/ },

  { key: "doppelteHH", re: /doppelte.*haushalt|zweitwohnung.*arbeit|doppelter\s*haushalt|zweiter\s*wohnsitz.*arbeit|berufsbedingte\s*zweitwohnung|ich\s+(wohne|lebe)\s+(in\s+)?(einer\s+anderen\s+stadt|woanders|weit\s+weg)\s+(als\s+)?(mein(e?)\s+)?büro|arbeit\s+weit\s+weg\s+von\s+zu\s+hause|auswärts\s+wohnen\s+wegen\s+arbeit|zweite\s+wohnung.*beruf|wochenendpendler|wochenend.?pendler|ich\s+pendel\s+nur\s+am\s+wochenende|montags.*heimfahrt|wöchentliche.*heimfahrt|unterkunft\s+am\s+arbeitsort|miete\s+am\s+arbeitsort.*steuer|zwei\s+wohnungen.*steuer|hauptwohnsitz.*arbeit|zweitwohnsitzsteuer/ },

  { key: "unterhalt", re: /unterhaltsleistung|unterhalt.*abset|unterhalt.*steuer|§\s*33a.*unterhalt|unterhalt\s+(zahlen|bezahlen|überweisen).*steuer|ich\s+zahle\s+unterhalt|unterhalt\s+an\s+(ex|kinder|kind|ex-frau|ex-mann|eltern)|realsplitting|anlage\s+u\b|ex.?(partner|frau|mann).*unterhalt|getrennt.*unterhalt|scheidung.*unterhalt|trennungsunterhalt|kindesunterhalt.*steuer|§\s*10\s*abs.*1a/ },

  { key: "kinder", re: /\bkinder\b|\bkind\b|kindergeld|kinderfreibetrag|kinderbetreuung.*steuer|kosten\s+(für\s+mein(e?)\s+kind|fürs\s+kind)|\bkita\b|krippe.*steuer|tagesmutter.*steuer|hort.*steuer|schule.*steuer|schulkosten\s+absetzen|kind.*absetzen|ich\s+habe\s+(ein\s+kind|kinder|einen\s+sohn|eine\s+tochter)|(sohn|tochter).*steuer|unterhalt.*kind|elterngeld.*steuer|elternteil.*steuer|alleinerziehend.*steuer|kindergartengebühren|betreuungskosten|kind\s+unter\s+\d\d.*steuer|kinderbetreuungskosten/ },

  { key: "rueckwirkend", re: /\b20\d\d\b.*steuererklärung|steuererklärung.*\b20\d\d\b|keine\s+(steuererklärung|steuer\s+erklärun)|noch\s+nie.*steuer|rückwirkend|nachträglich.*steuer|steuer.*nachholen|vergangene.*jahre|alte.*steuererklärung|steuer.*für\s+20\d\d\s+(noch|abgeben)|steuerjahr.*\b(20\d\d)\b.*noch|noch\s+(nicht|keine|nie).*steuererklärung|steuern\s+für\s+letztes\s+jahr|für\s+(letztes|vergangenes|vorletztes)\s+jahr.*steuern|ich\s+habe\s+(noch\s+)?nie\s+(eine\s+)?steuererklärung|seit\s+(Jahren|langem).*keine\s+steuererklärung|mehrere\s+jahre\s+nachreichen|4.jahres.frist|vier.jahres.frist|noch\s+einreichen\s+(für\s+)?20\d\d|freiwillige\s+steuererklärung|es\s+lohnt\s+sich\s+noch|nachholen\s+(für\s+20\d\d|vergangene)|was\s+kann\s+ich\s+noch\s+einreichen/ },

  { key: "elster", re: /\belster\b|finanzamt.*online|steuererklärung.*einreichen.*wie|wie.*einreichen|online.*steuererklärung|steuererklärung.*digital|digital.*steuererklärung|elster.*registrieren|mein\s*elster|elster.*konto|elster.*formular|wie\s+reiche\s+ich.*ein|wie\s+(funktioniert|benutze\s+ich)\s+(die\s+)?steuererklärung|formulare.*finanzamt|anlage\s+(n|kap|so|kind|vorsorge)(\b|\s)|wo\s+(trage\s+ich.*ein|fülle\s+ich.*aus)|steuererklärung\s+(ausfüllen|einreichen|abschicken|abgeben|online)/ },
  { key: "optimieren", re: /optimier|schlupfloch|steuertipp|was\s+kann\s+ich\s+(alles\s+)?(absetzen|sparen|optimieren|abzug|geltend\s+machen)|mehr\s+geld\s+(vom|zurück)|steuern\s+sparen|erstattung\s+(bekommen|holen|maximieren)|zurückbekommen|geld\s+vom\s+finanzamt|finanzamt.*zurück|tipps?\s+(für\s+)?(die\s+)?steuer|wie\s+spare\s+ich\s+(am\s+meisten\s+)?steuern|steuer.*reduzier|steuer.*mindern|steuer.*senken|steuerlast.*senken|mehr\s+netto\s+rausholen|alles\s+ausschöpfen|was\s+lohnt\s+sich|welche\s+abzüge|was\s+darf\s+ich\s+absetzen|steuerlich\s+optimieren|was\s+bringt\s+mir\s+(steuerlich|beim\s+finanzamt)|steuer.*potenzial|steuer.*möglichkeit|steuer.*chance|wie\s+bekomme\s+ich\s+geld\s+zurück|erstattung\s+maximieren|was\s+kann\s+(man|ich)\s+steuerlich|geld\s+zurück\s+von.*finanzamt|steuererklärung\s+(lohnt|rechnet\s+sich)|welche\s+(kosten|ausgaben|posten)\s+(kann|darf|lässt\s+sich)\s+(ich\s+)?(absetzen|abziehen|eintragen)/ },

];

// ── Semantisches Keyword-Scoring (Stufe 2 — Fallback nach Regex-Fail) ────
// Wenn kein Regex-Pattern greift, wird der normalisierte Text gegen
// gewichtete Keyword-Listen gescort. Score ≥ 2 → Intent erkannt.
const _SEMANTIC = {
  homeoffice:       { w: 3, kw: ["zuhause","daheim","home","remote","wohnung","wohnzimmer","schreibtisch"] },
  pendler:          { w: 2, kw: ["fahren","fahrweg","strecke","bus","bahn","auto","fahrrad","rad","km","kilometer","büro","weg"] },
  bruttoNetto:      { w: 2, kw: ["gehalt","lohn","verdienen","verdienst","ausgezahlt","netto","brutto","abzug","abzüge","monat"] },
  kapital:          { w: 3, kw: ["aktien","etf","depot","fonds","dividende","zinsen","gewinn","verlust","broker","börse","wertpapier","anlage"] },
  kinder:           { w: 3, kw: ["kind","kinder","sohn","tochter","kita","krippe","schule","tagesmutter","hort","betreuung","eltern"] },
  haushaltsnahe:    { w: 3, kw: ["putzen","reinigen","putzhilfe","garten","renovier","handwerker","reparatur","sanitär","elektriker","maler","haushalt","wohnung"] },
  aussergewoehnlich:{ w: 3, kw: ["arzt","zahnarzt","krankenhaus","medikamente","kur","rollstuhl","hilfsmittel","pflege","behinderung","krankheit","kosten"] },
  arbeitsmittel:    { w: 3, kw: ["laptop","computer","pc","notebook","monitor","drucker","stuhl","schreibtisch","headset","tablet","handy","buch","literatur"] },
  sonderausgaben:   { w: 3, kw: ["versicherung","krankenversicherung","kv","spende","kirchensteuer","schule","ausbildung","fortbildung","weiterbildung"] },
  riester:          { w: 4, kw: ["riester","zulage","grundzulage","kinderzulage","altersvorsorge","förderung","anlage av"] },
  bav:              { w: 4, kw: ["betriebliche","betriebsrente","entgeltumwandlung","direktversicherung","arbeitgeber","rente","bav"] },
  fristen:          { w: 3, kw: ["frist","termin","abgabe","wann","deadline","31.","juli","datum","einreichen","verpflichtet"] },
  optimieren:       { w: 2, kw: ["sparen","absetzen","zurück","rückerstattung","tipp","besser","mehr","lohnt","sinnvoll","möglichkeit","optimieren"] },
  steuerklasse:     { w: 3, kw: ["klasse","steuerklasse","verheiratet","partner","ehe","trennung","alleinerziehend","faktor"] },
  doppelteHH:       { w: 3, kw: ["andere stadt","zweitwohnung","zweite wohnung","wochenende","pendeln weit","weit entfernt","arbeitsort","unterkunft","miete am arbeits"] },
  studenten:        { w: 3, kw: ["studium","uni","hochschule","student","ausbildung","azubi","bachelor","master","promotion","bafög","semester"] },
  unterhalt:        { w: 4, kw: ["unterhalt","ex-frau","ex-mann","ex-partner","geschieden","getrennt","scheidung","kind zahlen"] },
  verlust:          { w: 3, kw: ["verlust","minus","verlustbescheinigung","verlustverrechnung","negativ"] },
  minijob:          { w: 3, kw: ["nebenjob","minijob","nebenbei","nebenher","geringfügig","midi","zusatzjob","zweiter job"] },
  grundfreibetrag:  { w: 3, kw: ["freibetrag","freigrenze","steuerfrei","grenze","erst ab","keine steuern","grundbetrag"] },
  kirchensteuer:    { w: 4, kw: ["kirche","kirchensteuer","evangelisch","katholisch","konfession","austritt","kirchenmitglied"] },
  soli:             { w: 4, kw: ["soli","solidaritätszuschlag","solidaritäts"] },
};

// Normalisiert: Kleinschreibung, Umlaute standardisieren, häufige Tippfehler korrigieren
function _normalize(msg) {
  return msg.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/absetzten/g, "absetzen")   // häufiger Tippfehler
    .replace(/steurern?/g, "steuern")
    .replace(/gehallt/g, "gehalt")
    .replace(/nto\b/g, "netto")
    .replace(/brutoo?/g, "brutto");
}

function _semanticScore(msg) {
  const norm = _normalize(msg);
  const scores = {};
  for (const [intent, { w, kw }] of Object.entries(_SEMANTIC)) {
    let score = 0;
    for (const k of kw) {
      if (norm.includes(k.replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss"))) {
        score += w;
      }
    }
    if (score >= 2) scores[intent] = score;
  }
  // Sortiert nach Score absteigend; liefert Array von Intent-Keys
  return Object.entries(scores).sort((a,b) => b[1]-a[1]).map(([k]) => k);
}

function _detectIntent(msg) {
  const m = msg.toLowerCase().trim();
  for (const { key, re } of _INTENTS) { if (re.test(m)) return key; }
  // Semantic fallback
  const sem = _semanticScore(msg);
  return sem.length > 0 ? sem[0] : "default";
}

// Gibt ALLE erkannten Intents zurück (Regex + Semantic kombiniert)
function _detectAllIntents(msg) {
  const m = msg.toLowerCase().trim();
  const found = [];
  for (const { key, re } of _INTENTS) {
    if (re.test(m)) found.push(key);
  }
  if (found.length > 0) return found;
  // Semantic fallback: alle Intents mit Score ≥ 2, max. 3
  const sem = _semanticScore(msg).slice(0, 3);
  return sem.length > 0 ? sem : ["default"];
}


// ════════════════════════════════════════════════════════════════════════
// NLU-UPGRADE (v3) — macht den deterministischen Kern "KI-ähnlich":
//   1. Slot-Extraktion: Zahlen + Einheiten direkt aus der Frage
//      ("Ich fahre 25 km an 200 Tagen" → rechnet mit 25 km / 200 Tagen,
//       nicht nur mit den Interview-Daten)
//   2. Dialog-Gedächtnis: Folgefragen ("und bei 30 km?", "was wenn ich
//      60.000 € verdiene?") werden auf das letzte Thema bezogen
//   3. Fuzzy-Matching (Stufe 3): Tippfehler-tolerante Themenerkennung
//      via Levenshtein-Distanz gegen das Keyword-Lexikon
//   4. Negations-Filter: "kein Homeoffice" triggert nicht Homeoffice
//   5. Szenario-Vergleich: "50.000 oder 60.000 brutto?" / "20 oder 35 km?"
//      → Seite-an-Seite-Berechnung beider Varianten
//   6. ELSTER-Zeilen-Direktantwort bei "Wo trage ich … ein?"
// Alle Berechnungen laufen weiterhin über die Tax-Engine + tax-config.json.
// ════════════════════════════════════════════════════════════════════════

// ── Deutsche Zahl parsen ("55.000", "1.234,56", "55k", "3,5") ────────────
function _numDE(s) {
  s = String(s).trim().toLowerCase();
  let mult = 1;
  if (/k$/.test(s)) { mult = 1000; s = s.slice(0, -1); }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n * mult;
}

const _WORTZAHLEN = { "ein": 1, "eine": 1, "einem": 1, "zwei": 2, "drei": 3, "vier": 4, "fuenf": 5, "fünf": 5, "sechs": 6 };

// ── Slot-Extraktion: Zahlen mit Kontextfenster klassifizieren ────────────
function _extractSlots(rawMsg) {
  const msg = " " + String(rawMsg || "").toLowerCase() + " ";
  const slots = { _nums: [] };

  // Steuerklasse als römische Zahl ("Klasse III", "SK V")
  const rom = msg.match(/(?:steuerklasse|klasse|\bsk)\s*(i{1,3}|iv|vi|v)\b/);
  if (rom) {
    const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
    if (map[rom[1]]) slots.sk = map[rom[1]];
  }
  // Wortzahlen vor "kind/kinder"
  const wk = msg.match(/\b(ein|eine|zwei|drei|vier|fuenf|fünf|sechs)\s+kind(er)?\b/);
  if (wk) slots.kinder = _WORTZAHLEN[wk[1]] || 1;

  const numRe = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)(\s*k\b)?/g;
  let m;
  while ((m = numRe.exec(msg)) !== null) {
    let v = _numDE(m[1]);
    if (v === null) continue;
    if (m[2]) v *= 1000;
    const start = m.index, end = numRe.lastIndex;
    const before = msg.slice(Math.max(0, start - 35), start);
    const afterFull = msg.slice(end, end + 35);
    const after = afterFull.slice(0, 20);
    const w = before + " ⏷ " + afterFull;
    slots._nums.push(v);

    // Jahr (2020–2030, vierstellig geschrieben)
    if (v >= 2020 && v <= 2030 && /^\d{4}$/.test(m[1])) {
      if (v >= 2024 && v <= 2026) slots.jahr = Math.round(v);
      continue;
    }
    // Steuerklasse 1–6
    if (v >= 1 && v <= 6 && /(?:steuerklasse|klasse|\bsk)\s*$/.test(before)) { slots.sk = Math.round(v); continue; }
    // Kilometer
    if (/^\s*(km\b|kilometer)/.test(after) || /(entfernung|strecke|arbeitsweg|einfache?r?\s*weg)\s*(von|betr[äa]gt|ist|:)?\s*$/.test(before)) {
      slots.kmList = slots.kmList || []; slots.kmList.push(v);
      if (slots.km == null) slots.km = v;
      continue;
    }
    // Tage
    if (/^\s*(arbeits|b[üu]ro|homeoffice|ho)?-?\s*tage?n?\b/.test(after)) {
      const nahVor = before.slice(-22);
      if (/tage?n?\s*(die|pro|je|in der)\s*woche/.test(afterFull)) { if (slots.tage_pro_woche == null) slots.tage_pro_woche = v; }
      else if (/pendel|pendle|fahr|büro|arbeitsweg/.test(nahVor)) { if (slots.tage == null) slots.tage = v; }
      else if (/home.?o?f+ice|zu\s*hause|zuhause|daheim|remote/.test(w)) { if (slots.ho_tage == null) slots.ho_tage = v; }
      else if (slots.tage == null) { slots.tage = v; }
      continue;
    }
    // Prozent / GdB
    if (/^\s*%/.test(after) || /\bgdb\s*(von\s*)?$/.test(before)) {
      if (/gdb|behinder/.test(w)) slots.gdb = v;
      else slots.prozent = v;
      continue;
    }
    // Kinderzahl
    if (/^\s*kind(er)?\b/.test(after) && v <= 10) { slots.kinder = Math.round(v); continue; }
    // Geldbeträge
    const istGeld = /^\s*(€|euro|eur\b)/.test(after) || m[2] ||
      /(brutto|gehalt|verdien|einkommen|lohn|jahresgehalt|verdienst)\s*(von|betr[äa]gt|ist|liegt bei|:)?\s*$/.test(before) ||
      /^\s*(€|euro)?\s*(brutto|gehalt|im jahr|j[äa]hrlich|pro jahr|im monat|monatlich|verdien)/.test(afterFull);
    if (istGeld) {
      let geld = v;
      if (/monat/.test(w) && geld < 20000) geld = geld * 12;
      if (/spende/.test(w)) { slots.spenden = geld; continue; }
      if (geld >= 3000) {
        slots.bruttoList = slots.bruttoList || []; slots.bruttoList.push(geld);
        if (slots.brutto == null) slots.brutto = geld;
      } else {
        slots.geldList = slots.geldList || []; slots.geldList.push(geld);
      }
      continue;
    }
  }
  // Fallback: unklassifizierte Zahlen ≥ 3.000 in Geld-Kontext → Brutto
  // ("55.000 oder 62.000 brutto?" — nur die zweite Zahl trägt die Einheit)
  if (/brutto|netto|gehalt|verdien|einkommen|jahresbrutto|lohn/.test(msg)) {
    for (const v of slots._nums) {
      if (v >= 3000 && v <= 2000000 && (!slots.bruttoList || slots.bruttoList.indexOf(v) === -1)) {
        if (slots.kmList && slots.kmList.indexOf(v) !== -1) continue;
        slots.bruttoList = slots.bruttoList || [];
        slots.bruttoList.push(v);
        if (slots.brutto == null) slots.brutto = v;
      }
    }
    if (slots.bruttoList) slots.bruttoList.sort((a, b) => a - b);
  }
  return slots;
}

// ── Negations-Filter (für Fuzzy-/Semantik-Stufen) ────────────────────────
function _stripNegations(msg) {
  return String(msg || "").replace(/\b(kein(e|en|em|er)?|nicht|ohne)\s+[a-zäöüß-]+/gi, " ");
}

// ── Fuzzy-Matching (Stufe 3): Levenshtein ≤ 1–2 gegen Keyword-Lexikon ────
function _lev(a, b, max) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array(lb + 1), cur = new Array(lb + 1), prev2 = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) { prev[j] = j; prev2[j] = j; }
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // Damerau (OSA): Buchstabendreher zählt nur 1 ("miniojb" → "minijob")
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      }
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    const t = prev2; prev2 = prev; prev = cur; cur = t;
  }
  return prev[lb];
}

let _FUZZY_LEX = null;
const _FUZZY_EXTRA = {
  homeoffice: ["homeoffice", "heimbuero", "tagespauschale"],
  pendler: ["pendlerpauschale", "entfernungspauschale", "fahrtkosten", "arbeitsweg", "pendeln"],
  werbungskosten: ["werbungskosten", "absetzen", "pauschbetrag"],
  bruttoNetto: ["bruttonetto", "nettogehalt", "nettolohn"],
  steuerklasse: ["steuerklasse", "faktorverfahren", "steuerklassenwechsel"],
  grundfreibetrag: ["grundfreibetrag", "existenzminimum"],
  kapital: ["kapitalertrag", "abgeltungsteuer", "freistellungsauftrag", "sparerpauschbetrag", "dividende"],
  kirchensteuer: ["kirchensteuer", "kirchenaustritt"],
  soli: ["solidaritaetszuschlag"],
  fristen: ["abgabefrist", "steuererklaerung", "steuerfrist"],
  minijob: ["minijob", "midijob", "geringfuegig"],
  riester: ["riesterrente", "riestervertrag"],
  ruerup: ["ruerup", "basisrente"],
  bav: ["entgeltumwandlung", "direktversicherung", "betriebsrente"],
  aussergewoehnlich: ["krankheitskosten", "eigenbelastung", "pflegekosten"],
  studenten: ["erststudium", "zweitstudium", "studienkosten", "verlustvortrag"],
  arbeitsmittel: ["arbeitsmittel", "arbeitszimmer", "sofortabschreibung"],
  haushaltsnahe: ["putzfrau", "haushaltsnahe", "handwerkerleistung", "putzhilfe"],
  kinder: ["kindergeld", "kinderfreibetrag", "kinderbetreuung"],
  unterhalt: ["unterhalt", "realsplitting"],
  doppelteHH: ["zweitwohnung", "haushaltsfuehrung"],
  elster: ["elster", "finanzamt"],
  optimieren: ["steuertipps", "steuererstattung", "optimieren", "steuern sparen"],
};

function _buildFuzzyLex() {
  _FUZZY_LEX = [];
  const normX = (s2) => s2.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  for (const [intent, words] of Object.entries(_FUZZY_EXTRA)) {
    for (const k of words) if (!k.includes(" ")) _FUZZY_LEX.push([normX(k), intent, 3]);
  }
  const norm = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  for (const [intent, def] of Object.entries(_SEMANTIC)) {
    for (const k of def.kw) {
      if (k.length >= 5 && !k.includes(" ")) _FUZZY_LEX.push([norm(k), intent, def.w]);
    }
  }
}

function _fuzzyIntents(msg) {
  if (!_FUZZY_LEX) _buildFuzzyLex();
  const toks = _normalize(_stripNegations(msg)).split(/[^a-z0-9]+/).filter((t) => t.length >= 5);
  const scores = {};
  for (const t of toks) {
    for (const [k, intent, w] of _FUZZY_LEX) {
      if (Math.abs(t.length - k.length) > 2) continue;
      const max = k.length >= 8 ? 2 : 1;
      if (_lev(t, k, max) <= max) scores[intent] = (scores[intent] || 0) + w;
    }
  }
  return Object.entries(scores)
    .filter(([, s]) => s >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

// ── Dialog-Gedächtnis (pro Session) ──────────────────────────────────────
let _NLU_CTX = { intent: null, slots: null, ts: 0 };
const _FOLLOWUP_RE = /^(und\b|aber\b|ok(ay)?\b|dann\b|jetzt\b|stattdessen|gleiche|dasselbe|noch ?mal|was (w[äa]re|ist|wenn)|wie (w[äa]re|s[äa]he|viel w[äa]re)|angenommen|rechne|nimm\b|mach\b|bei\b|mit\b|f[üu]r\b)/i;

function _resolveFollowUp(msg, slots, intents) {
  if (!_NLU_CTX.intent || _NLU_CTX.intent === "default" || _NLU_CTX.intent === "hilfe") return null;
  if (Date.now() - _NLU_CTX.ts > 30 * 60 * 1000) return null;
  const m = String(msg || "").trim();
  if (m.length > 110) return null;
  const noIntent = !intents || intents.length === 0 || intents[0] === "default";
  if (!noIntent) return null; // eigenes Thema erkannt → kein Follow-up nötig
  const hasNums = slots && slots._nums && slots._nums.length > 0;
  if (hasNums || _FOLLOWUP_RE.test(m)) return _NLU_CTX.intent;
  return null;
}

// ── Slots auf das Profil anwenden (pro Frage, nicht persistent) ──────────
function _applySlots(p, slots, msg, yr, K) {
  if (!slots) return p;
  const q = Object.assign({}, p);
  const info = [];
  const low = String(msg || "").toLowerCase();
  const hoCtx = /home.?o?f+ice|zu\s*hause|zuhause|daheim|remote/.test(low);

  if (slots.km != null && slots.km > 0 && slots.km <= 400) { q.pendlKm = slots.km; info.push(slots.km + " km"); }
  if (slots.tage != null && slots.tage > 0 && slots.tage <= 366) { q.atage = Math.round(slots.tage); info.push(Math.round(slots.tage) + " Arbeitstage"); }

  let ho = slots.ho_tage;
  if (ho == null && slots.tage_pro_woche != null && hoCtx) ho = Math.round(slots.tage_pro_woche * 46);
  if (ho != null && ho >= 0) {
    const maxT = (K && K.homeoffice_max_tage) || 210;
    q.hoTage = Math.min(Math.round(ho), maxT);
    info.push(q.hoTage + " HO-Tage" + (slots.tage_pro_woche != null && slots.ho_tage == null ? " (≈ " + slots.tage_pro_woche + " Tage/Woche × 46 Wochen)" : ""));
  }
  if (slots.brutto != null && slots.brutto >= 3000 && slots.brutto <= 2000000) {
    q.brutto = Math.round(slots.brutto);
    info.push(_fmt(q.brutto) + " brutto");
    // Grenzsteuersatz für das neue Brutto neu berechnen
    try {
      if (typeof _calcPreciseGST === "function") {
        q.gst = Math.round(_calcPreciseGST({ brutto: q.brutto, _ia: q._ia || {} }, yr) * 100);
      } else if (K && typeof calcGrenzsteuersatz === "function") {
        const bbgKv = K.bbg_kv_monatlich * 12, bbgRv = K.bbg_rv_monatlich * 12;
        const sv = Math.round(Math.min(q.brutto, bbgKv) * K.sv_kv + Math.min(q.brutto, bbgRv) * (K.sv_rv + K.sv_alv) + Math.min(q.brutto, bbgKv) * K.sv_pv);
        q.gst = Math.round(calcGrenzsteuersatz(Math.max(0, q.brutto - sv - K.wk_pauschale), String(yr)) * 100);
      }
    } catch (e) { /* GST optional */ }
  }
  if (slots.sk != null) { q.sk = slots.sk; info.push("SK " + slots.sk); }
  if (slots.kinder != null) { q.kinder = slots.kinder > 0; if (slots.kinder > 0) info.push(slots.kinder + (slots.kinder === 1 ? " Kind" : " Kinder")); }
  // Negierte Familien-/HO-Angaben
  if (/\b(nicht|un)verheiratet|\bledig\b/.test(low)) q.verh = false;
  if (/\bkein(e)?\s+kind(er)?\b/.test(low)) q.kinder = false;

  q._slotInfo = info;
  return q;
}

// ── Szenario-Vergleich: Brutto A vs. B ───────────────────────────────────
function _h_vergleichBrutto(list, p, yr, K) {
  if (typeof calcBruttoNetto !== "function") return null;
  const a = Math.round(list[0]), b = Math.round(list[1]);
  const ca = calcBruttoNetto({ brutto: a, steuerklasse: p.sk, kirchensteuer: p.kstMit, bundesland: p.bl, kinder: p.kinder, year: yr });
  const cb = calcBruttoNetto({ brutto: b, steuerklasse: p.sk, kirchensteuer: p.kstMit, bundesland: p.bl, kinder: p.kinder, year: yr });
  let r = `**Szenario-Vergleich ${yr}** (SK ${p.sk}${p.kstMit ? " + KiSt" : ""})\n\n`;
  r += `| | **${_fmt(a)}** | **${_fmt(b)}** |\n|---|---|---|\n`;
  r += `| Lohnsteuer | ${_fmt(ca.lohnsteuer)} | ${_fmt(cb.lohnsteuer)} |\n`;
  r += `| Soli | ${_fmt(ca.soli)} | ${_fmt(cb.soli)} |\n`;
  if (p.kstMit) r += `| Kirchensteuer | ${_fmt(ca.kst)} | ${_fmt(cb.kst)} |\n`;
  r += `| Sozialversicherung | ${_fmt(ca.sv)} | ${_fmt(cb.sv)} |\n`;
  r += `| **Jahres-Netto** | **${_fmt(ca.netto)}** | **${_fmt(cb.netto)}** |\n`;
  r += `| Monats-Netto | ${_fmt(Math.round(ca.netto / 12))} | ${_fmt(Math.round(cb.netto / 12))} |\n\n`;
  const dB = b - a, dN = cb.netto - ca.netto;
  if (dB !== 0) {
    r += `**${_fmt(Math.abs(dB))} mehr brutto → ${_fmt(Math.abs(dN))} mehr netto** `;
    r += `(${Math.round(Math.abs(dN) / Math.abs(dB) * 100)} % kommen an, ${Math.round((1 - Math.abs(dN) / Math.abs(dB)) * 100)} % gehen an Steuern + SV).`;
  }
  r += `\n\n*Vereinfachte Berechnung — kein Lohnsteuerjahresausgleich, keine individuellen Freibeträge.*`;
  return r + _TAG;
}

// ── Szenario-Vergleich: Pendelstrecke A vs. B ────────────────────────────
function _h_vergleichKm(list, p, yr, K) {
  const a = list[0], b = list[1];
  const tage = Math.max(0, p.atage - p.hoTage) || 220;
  const pa = _pendler(a, tage, yr, K), pb = _pendler(b, tage, yr, K);
  let r = `**Pendlerpauschale im Vergleich ${yr}** (${tage} Pendeltage)\n\n`;
  r += `| Strecke | Pauschale/Jahr |${p.gst !== null ? " Steuerersparnis |" : ""}\n|---|---|${p.gst !== null ? "---|" : ""}\n`;
  r += `| ${a} km | **${_fmt(pa)}** |${p.gst !== null ? " ~" + _fmt(Math.round(pa * p.gst / 100)) + " |" : ""}\n`;
  r += `| ${b} km | **${_fmt(pb)}** |${p.gst !== null ? " ~" + _fmt(Math.round(pb * p.gst / 100)) + " |" : ""}\n\n`;
  r += `Differenz: **${_fmt(Math.abs(pb - pa))}/Jahr** mehr Werbungskosten bei der längeren Strecke.`;
  return r + _TAG;
}

// ── Steuerklassen-Rechner: III/V vs. IV/IV bei zwei Bruttos ────────────
function _h_vergleichSK(b1, b2, p, yr, K) {
  if (typeof calcBruttoNetto !== "function") return null;
  const hi = Math.max(b1, b2), lo = Math.min(b1, b2);
  const opt = { kirchensteuer: p.kstMit, bundesland: p.bl, kinder: p.kinder, year: yr };
  const n44 = calcBruttoNetto(Object.assign({}, opt, { brutto: hi, steuerklasse: 4 })).netto
            + calcBruttoNetto(Object.assign({}, opt, { brutto: lo, steuerklasse: 4 })).netto;
  const n35 = calcBruttoNetto(Object.assign({}, opt, { brutto: hi, steuerklasse: 3 })).netto
            + calcBruttoNetto(Object.assign({}, opt, { brutto: lo, steuerklasse: 5 })).netto;
  let r = `**Steuerklassen-Vergleich ${yr}** — Ehepaar mit ${_fmt(hi)} + ${_fmt(lo)} brutto\n\n`;
  r += `| Kombination | Jahres-Netto (gemeinsam) | pro Monat |\n|---|---|---|\n`;
  r += `| **IV / IV** | ${_fmt(n44)} | ${_fmt(Math.round(n44 / 12))} |\n`;
  r += `| **III / V** | ${_fmt(n35)} | ${_fmt(Math.round(n35 / 12))} |\n\n`;
  const d = n35 - n44;
  if (d > 0) r += `→ **III/V bringt unterjährig ca. ${_fmt(d)} mehr Netto** (${_fmt(Math.round(d / 12))}/Monat Liquiditätsvorteil).\n\n`;
  else r += `→ Bei dieser Verteilung ist **IV/IV** praktisch gleichwertig oder besser.\n\n`;
  r += `⚠️ **Wichtig:** Die endgültige Jahressteuer (Splittingtarif) ist bei beiden Kombinationen **identisch** — III/V verschiebt nur die Liquidität ins Jahr und führt oft zu Nachzahlung + Pflichtveranlagung. Das **Faktorverfahren (§ 39f EStG)** verteilt den Abzug verursachungsgerecht und vermeidet Nachzahlungen.\n\n`;
  r += `*Vereinfachte Lohnsteuer-Näherung — für die exakte Entscheidung BMF-Steuerklassenrechner nutzen.*`;
  return r + _TAG;
}

// ── ELSTER-Zeilen-Kurzantworten ("Wo trage ich … ein?") ──────────────────
const _ELSTER_ZEILEN = {
  homeoffice:        "Anlage N, Zeile 45 — Tagespauschale (Anzahl HO-Tage eintragen)",
  pendler:           "Anlage N, Zeilen 31–40 — Entfernungspauschale (je Arbeitsstätte)",
  werbungskosten:    "Anlage N, Zeilen 31–57 — Werbungskosten",
  arbeitsmittel:     "Anlage N, Zeile 57 — Arbeitsmittel",
  kapital:           "Anlage KAP — Kapitalerträge (nur nötig bei Günstigerprüfung / fehlendem FSA)",
  guenstiger:        "Anlage KAP, Zeile 4 — Günstigerprüfung beantragen",
  sonderausgaben:    "Anlage Sonderausgaben + Anlage Vorsorgeaufwand",
  haushaltsnahe:     "Hauptvordruck ESt 1 A, Zeilen 71–79 — § 35a (Haushaltsnahe / Handwerker)",
  riester:           "Anlage AV — Riester-Beiträge",
  ruerup:            "Anlage Vorsorgeaufwand, Zeilen 4–10 — Basisrente (Rürup)",
  kinder:            "Anlage Kind — eine Anlage pro Kind",
  unterhalt:         "Anlage U (Realsplitting) bzw. Anlage Unterhalt (§ 33a)",
  aussergewoehnlich: "Anlage Außergewöhnliche Belastungen",
  verlust:           "Anlage KAP (Kapital-Verluste) bzw. Anlage SO — Verlustbescheinigung beilegen",
  doppelteHH:        "Anlage N, Zeilen 61–87 — Doppelte Haushaltsführung",
  studenten:         "Erststudium: Anlage Sonderausgaben · Zweitstudium: Anlage N (Werbungskosten)",
};

function _fmt(n)    { return (typeof fmtEUR === "function") ? fmtEUR(Math.round(n)) : Math.round(n).toLocaleString("de-DE") + " €"; }
function _pct(n)    { return Math.round(n * 10) / 10 + " %"; }
const _TAG = "\n\n---\n*⚡ Offline · Steuer-Engine · Kein KI-Backend aktiv*";

function _profile(ia, tweaks, yr, K) {
  const brutto   = Number(ia.jahresbrutto || ia.brutto || tweaks.brutto || 0);
  const sk       = Number(ia.steuerklasse || tweaks.steuerklasse || 1);
  const bl       = ia.bundesland || tweaks.bundesland || "default";
  const kstMit   = ia.kirchenmitglied ?? tweaks.kirchensteuer ?? false;
  const kinder   = ia.kinder === true;
  const verh     = (ia.familienstand || tweaks.familienstand || "") === "verheiratet";
  const hoTage   = Number(ia.homeoffice_tage || 0);
  const pendlKm  = Number(ia.arbeitsweg_km || ia.entfernung_km || 0);
  const atage    = Number(ia.arbeitstage || ia.buerotage || 220);
  const beschaeft = ia.beschaeftigung || ia.berufstyp || tweaks.berufstyp || "arbeitnehmer";
  // Grenzsteuersatz mit korrekter SV-Berechnung (kein brutto*0.80-Pauschalabzug mehr)
  const gst = (brutto > 0)
    ? (typeof _calcPreciseGST === "function"
        ? Math.round(_calcPreciseGST({ brutto, _ia: ia }, yr) * 100)
        : (K && typeof calcGrenzsteuersatz === "function"
            ? (() => {
                // K kommt von getK() — alle SV-Felder immer vorhanden
                const bbgKv = K.bbg_kv_monatlich * 12;
                const bbgRv = K.bbg_rv_monatlich * 12;
                const sv = Math.round(
                  Math.min(brutto, bbgKv) * K.sv_kv +
                  Math.min(brutto, bbgRv) * (K.sv_rv + K.sv_alv) +
                  Math.min(brutto, bbgKv) * K.sv_pv
                );
                return Math.round(calcGrenzsteuersatz(Math.max(0, brutto - sv - K.wk_pauschale), String(yr)) * 100);
              })()
            : null))
    : null;
  return { brutto, sk, bl, kstMit, kinder, verh, hoTage, pendlKm, atage, beschaeft, gst, _ia: ia, _tweaks: typeof tweaks !== 'undefined' ? tweaks : {} };
}

function _pendler(km, tage, yr, K) {
  if (km <= 0 || tage <= 0) return 0;
  if (yr >= 2026) return Math.round(tage * km * (K.entfernung_km_ab_21 || 0.38));
  const z1 = Math.min(km, 20), z2 = Math.max(0, km - 20);
  return Math.round(tage * (z1 * (K.entfernung_km_bis_20 || 0.30) + z2 * (K.entfernung_km_ab_21 || 0.38)));
}

// ── Handler ──────────────────────────────────────────────────────────────

function _h_hilfe() {
  return `**SteuerBot — Was ich im Offline-Modus beantworten kann:**\n\n` +
    `**Berechnungen (mit deinen echten Profilzahlen):**\n` +
    `- "Homeoffice" → Pauschale berechnen\n` +
    `- "Pendlerpauschale" → km × Tage\n` +
    `- "Brutto Netto" → vollständige Lohnabrechnung\n` +
    `- "Werbungskosten" → Einzelnachweis vs. Pauschale\n` +
    `- "Kapitalerträge / ETF" → KapESt + Freistellungsauftrag\n\n` +
    `**Steuerrecht (aktuelle Werte ${new Date().getFullYear()}):**\n` +
    `- Grundfreibetrag · Steuerklassen · Solidaritätszuschlag\n` +
    `- Kirchensteuer · Sonderausgaben · §35a Haushaltsnahe\n` +
    `- Fristen · ELSTER · Rückwirkende Erklärungen\n` +
    `- Riester · Rürup · bAV · Minijob\n` +
    `- Außergewöhnliche Belastungen · Studenten\n` +
    `- Arbeitsmittel/GWG · Doppelte Haushaltsführung\n\n` +
    `**Analyse:**\n` +
    `- "Was kann ich optimieren?" → Top-Sparpotenziale aus deinem Profil\n` +
    `- "Mein Profil" → Zusammenfassung aller Steuerdaten\n\n` +
    `Für komplexe Freitext-Fragen: Ollama im ⚙-Menü einrichten (Mac).` + _TAG;
}

function _h_profil(p, yr, K, ia, tweaks, state, investments) {
  if (!p.brutto) {
    return `Füll das Interview (📋-Button im Steuer-Tab) aus — dann zeige ich dir eine vollständige Steuer-Übersicht mit echten Zahlen.` + _TAG;
  }
  const bn = typeof calcBruttoNetto === "function"
    ? calcBruttoNetto({ brutto: p.brutto, steuerklasse: p.sk, kirchensteuer: p.kstMit, bundesland: p.bl, kinder: p.kinder, year: yr })
    : null;
  let r = `**Dein Steuer-Profil ${yr}**\n\n`;
  r += `| | |\n|---|---|\n`;
  r += `| Jahresbrutto | **${_fmt(p.brutto)}** |\n`;
  r += `| Steuerklasse | **SK ${p.sk}** |\n`;
  r += `| Familienstand | ${p.verh ? "verheiratet" : "ledig/Single"} |\n`;
  r += `| Bundesland | ${p.bl !== "default" ? p.bl : "nicht angegeben"} |\n`;
  r += `| Kirchensteuer | ${p.kstMit ? "ja" : "nein"} |\n`;
  r += `| Kinder | ${p.kinder ? "ja" : "nein"} |\n`;
  if (p.hoTage > 0) r += `| Homeoffice-Tage | ${p.hoTage} Tage |\n`;
  if (p.pendlKm > 0) r += `| Arbeitsweg | ${p.pendlKm} km (einfach) |\n`;
  if (bn) {
    r += `\n**Lohnabrechnung ${yr} (Jahreswerte):**\n`;
    r += `    Brutto:           ${_fmt(p.brutto)}\n`;
    r += `    − Lohnsteuer:     ${_fmt(bn.lohnsteuer)}\n`;
    if (bn.soli > 0) r += `    − Soli:           ${_fmt(bn.soli)}\n`;
    if (bn.kst  > 0) r += `    − Kirchensteuer:  ${_fmt(bn.kst)}\n`;
    r += `    − Sozialvers.:    ${_fmt(bn.sv)}\n`;
    r += `    = Netto:          **${_fmt(bn.netto)}**\n`;
    r += `\nEffektiver Steuersatz: **${Math.round(bn.lohnsteuer / p.brutto * 100)} %**`;
    if (p.gst !== null) r += ` · Grenzsteuersatz: **~${p.gst} %**`;
  }
  return r + _TAG;
}

function _h_optimieren(p, yr, K, ia, tweaks, state, investments) {
  if (!p.brutto) {
    return `Füll das Interview (📋) aus — dann zeige ich dir alle Steuer-Potenziale mit €-Beträgen.` + _TAG;
  }
  if (typeof findOpportunities !== "function" || typeof buildUserProfile !== "function") {
    return `Optimierungs-Engine nicht verfügbar. Bitte Seite neu laden.` + _TAG;
  }
  const profile = buildUserProfile(ia, tweaks);
  const ops = findOpportunities(profile, state.receipts || [], investments || {}, yr);
  const valid = ops.filter(o => !o.__noData && o.ersparnis > 0).sort((a,b) => b.ersparnis - a.ersparnis);
  if (!valid.length) {
    return `Kein Optimierungspotenzial erkannt — Profil ist möglicherweise unvollständig. Füll das Interview (📋) aus.` + _TAG;
  }
  const top = valid.slice(0, 8);
  const gesamt = top.reduce((s, o) => s + o.ersparnis, 0);
  let r = `**Deine Top-${top.length} Steuer-Optimierungen ${yr}:**\n\n`;
  top.forEach((op, i) => {
    const badge = op.status === "lohnt" ? "✅" : op.status === "action" ? "⚡" : op.status === "warn" ? "⚠️" : "ℹ️";
    r += `**${i + 1}. ${badge} ${op.titel}** — Ersparnis ~${_fmt(op.ersparnis)}\n`;
    r += `   ${op.beschreibung}\n`;
    if (op.paragraph) r += `   📌 ${op.paragraph} · ${op.anlage || ""}\n`;
    if (op.aktion) r += `   👉 ${op.aktion}\n`;
    r += "\n";
  });
  r += `**Gesamtpotenzial (Top ${top.length}): ~${_fmt(gesamt)}**\n\n`;
  r += `Den vollständigen Optimierer öffnest du mit dem 💡-Button im Steuer-Tab.`;
  return r + _TAG;
}

function _h_homeoffice(p, yr, K) {
  const anrech = Math.min(p.hoTage, K.homeoffice_max_tage || 210);
  const betrag = anrech * (K.homeoffice_pro_tag || 6);
  let r = `**Homeoffice-Pauschale ${yr}** (§ 4 Abs. 5 Nr. 6c EStG)\n\n`;
  r += `- **${K.homeoffice_pro_tag || 6} €/Tag** · max. ${K.homeoffice_max_tage || 210} Tage · max. **${_fmt((K.homeoffice_pro_tag||6) * (K.homeoffice_max_tage||210))}/Jahr**\n`;
  r += `- Kein Beleg nötig, keine Arbeitgeberbestätigung\n`;
  r += `- Gilt auch bei Homeoffice-Ecke (kein eigenes Arbeitszimmer nötig)\n`;
  r += `- Kombinierbar mit Pendlerpauschale (an Bürotagen)\n`;
  if (p.hoTage > 0) {
    r += `\n**Deine Berechnung:**\n`;
    r += `    ${p.hoTage} HO-Tage × ${K.homeoffice_pro_tag || 6} €`;
    if (p.hoTage > (K.homeoffice_max_tage || 210)) r += ` (auf ${K.homeoffice_max_tage} Tage gekürzt)`;
    r += ` = **${_fmt(betrag)}**`;
    if (p.gst !== null) r += `\n    → Ersparnis ca. **${_fmt(Math.round(betrag * p.gst / 100))}** (Grenzsteuersatz ~${p.gst} %)`;
    r += `\n\n📌 Anlage N, Zeile 44 — einfach Anzahl Tage eintragen.`;
  } else {
    r += `\nTrag deine HO-Tage im Interview (📋) ein für die genaue Berechnung.`;
  }
  return r + _TAG;
}

function _h_pendler(p, yr, K) {
  const ia = p._ia || {};
  const tw = p._tweaks || {};

  // Build location list from tweaks.arbeitsstaetten or fall back to interview answers
  const stRaw = (tw.arbeitsstaetten || []).filter(s => Number(s.km) > 0);
  let locs;
  if (stRaw.length > 0) {
    locs = stRaw.map((s, idx) => ({
      name: s.name || ("Standort " + (idx + 1)),
      km: Number(s.km),
      tage: idx === 0 ? Math.max(0, Number(s.tage) - p.hoTage) : (Number(s.tage) || 0)
    }));
  } else {
    const p1km   = p.pendlKm;
    const p1tage = Math.max(0, p.atage - p.hoTage);
    const p2km   = ia.zweiter_standort === true ? (Number(ia.zweiter_standort_km)   || 0) : 0;
    const p2tage = ia.zweiter_standort === true ? (Number(ia.zweiter_standort_tage) || 0) : 0;
    locs = [];
    if (p1km > 0) locs.push({ name: "Hauptstandort", km: p1km, tage: p1tage });
    if (p2km > 0) locs.push({ name: "Zweiter Standort", km: p2km, tage: p2tage });
  }

  const betraege = locs.map(s => _pendler(s.km, s.tage, yr, K));
  const betragGesamt = betraege.reduce((a, b) => a + b, 0);
  const wk = K.wk_pauschale;

  let r = `**Pendlerpauschale ${yr}** (§ 9 Abs. 1 Nr. 4 EStG)\n\n`;
  if (yr >= 2026) {
    r += `- Ab ${yr}: **0,38 €/km ab km 1** (vereinheitlicht)\n`;
  } else {
    r += `- 0,30 €/km für km 1–20, **0,38 €/km ab km 21**\n`;
  }
  r += `- Nur **einfache** Strecke — nicht Hin+Rückfahrt\n`;
  r += `- HO-Tage zählen **nicht** — kein Pendeln = kein Abzug\n`;
  r += `- Gilt für **jeden Arbeitsstandort** separat (Büro, Kundenbüro, Zweigstelle …)\n`;
  r += `- Auch für ÖPNV eintragen, auch wenn AG Jobticket zahlt\n`;

  if (locs.length > 0) {
    r += `\n**Deine Berechnung:**\n`;
    locs.forEach((s, i) => {
      r += `    ${s.name}: ${s.km} km × ${s.tage} Tage = **${_fmt(betraege[i])}**\n`;
    });
    if (locs.length > 1) {
      r += `    ───────────────────────────────────────\n`;
      r += `    Gesamt Pendlerpauschale:     **${_fmt(betragGesamt)}**\n`;
    }
    if (betragGesamt > wk) {
      r += `\n✅ **${_fmt(betragGesamt - wk)} über WK-Pauschale** → Einzelnachweis lohnt sich!`;
      if (p.gst !== null) r += `\n    Zusatzersparnis ca. **${_fmt(Math.round((betragGesamt - wk) * p.gst / 100))}** (~${p.gst} % Grenzsteuersatz)`;
    } else {
      r += `\nWK-Pauschale ${_fmt(wk)} deckt die Pendlerpauschale ab (noch kein Einzelnachweis nötig).`;
    }
    r += `\n\n📌 Anlage N, Zeile 31–40. Jeden Standort separat eintragen!`;
  } else {
    r += `\nTrag Entfernung und Arbeitstage unter Einstellungen → Steuer-Profil → Arbeitsstätten ein, oder starte das Interview.`;
  }
  return r + _TAG;
}
function _h_werbungskosten(p, yr, K, state) {
  const yr_s    = String(yr);
  const receipts = state.receipts || [];
  const ia = p._ia || {};

  // Belege nach WK-Unterkategorien aufschlüsseln
  const WK_LABELS = {
    arbeitsmittel:   "Arbeitsmittel (Laptop, Bürostuhl …)",
    fortbildung:     "Fortbildung / Fachliteratur",
    berufskleidung:  "Berufskleidung (typisch beruflich)",
    telefon:         "Telefon/Internet (20 % Anteil)",
    gewerkschaft:    "Gewerkschaftsbeitrag",
    sonstige_wk:     "Sonstige Werbungskosten",
  };
  const wkBelege = receipts.filter(r => r.steuerkat === "werbungskosten" && (r.datum||"").startsWith(yr_s));
  const wkSum    = wkBelege.reduce((s,r) => s + Number(r.gesamtbetrag||0), 0);

  // Telefonkosten: 20 % der angegebenen Gesamtkosten
  const telGesamt = Number(ia.telefon_kosten_jahres) || 0;
  const telWk     = Math.min(240, Math.round(telGesamt * 0.20));

  // Pendlerpauschale — alle Standorte aus tweaks.arbeitsstaetten oder Interview
  const tw = p._tweaks || {};
  const stRaw = (tw.arbeitsstaetten || []).filter(s => Number(s.km) > 0);
  let pendLocs;
  if (stRaw.length > 0) {
    pendLocs = stRaw.map((s, idx) => ({
      name: s.name || ("Standort " + (idx + 1)),
      km: Number(s.km),
      tage: idx === 0 ? Math.max(0, Number(s.tage) - p.hoTage) : (Number(s.tage) || 0)
    }));
  } else {
    const p1km   = p.pendlKm;
    const p1tage = Math.max(0, p.atage - p.hoTage);
    const p2km_  = ia.zweiter_standort === true ? (Number(ia.zweiter_standort_km)   || 0) : 0;
    const p2tage_= ia.zweiter_standort === true ? (Number(ia.zweiter_standort_tage) || 0) : 0;
    pendLocs = [];
    if (p1km > 0) pendLocs.push({ name: "Hauptstandort", km: p1km, tage: p1tage });
    if (p2km_ > 0) pendLocs.push({ name: "Zweiter Standort", km: p2km_, tage: p2tage_ });
  }
  const pendBetraege = pendLocs.map(s => _pendler(s.km, s.tage, yr, K));
  const pendSum = pendBetraege.reduce((a, b) => a + b, 0);

  // Homeoffice-Pauschale
  const hoSum = Math.min(p.hoTage, K.homeoffice_max_tage||210) * (K.homeoffice_pro_tag||6);

  // Kontoführungsgebühr (16 € Pauschale, immer anerkannt)
  const kontoWk = 16;

  const gesamt   = wkSum + telWk + pendSum + hoSum + kontoWk;
  const wkPausch = K.wk_pauschale;
  const ueber    = gesamt - wkPausch;

  let r = `**Werbungskosten ${yr}** (§ 9 EStG)\n\n`;
  r += `WK-Pauschale: **${_fmt(wkPausch)}** — Finanzamt erkennt sie automatisch an.\n`;
  r += `Einzelnachweis lohnt sich nur wenn deine WK > ${_fmt(wkPausch)}.\n\n`;

  r += `**Deine WK-Hochrechnung:**\n`;
  r += `    Erfasste Belege (WK-Kategorie): ${_fmt(wkSum)}\n`;
  pendLocs.forEach((s, i) => {
    if (pendBetraege[i] > 0) r += `    Pendlerpauschale ${s.name}:  ${_fmt(pendBetraege[i])}  (${s.km} km × ${s.tage} Tage)\n`;
  });
  if (hoSum    > 0) r += `    Homeoffice-Pauschale:           ${_fmt(hoSum)}  (${Math.min(p.hoTage, K.homeoffice_max_tage||210)} Tage × ${K.homeoffice_pro_tag||6} €)\n`;
  if (telWk    > 0) r += `    Telefon/Internet (20 %):        ${_fmt(telWk)}  (von ${_fmt(telGesamt)} Gesamtkosten)\n`;
  r += `    Kontoführungsgebühr:            ${_fmt(kontoWk)}  (Pauschale)\n`;
  r += `    ──────────────────────────────────────────\n`;
  r += `    Gesamt:                         **${_fmt(gesamt)}**\n`;

  if (gesamt > wkPausch) {
    r += `    Vorteil ggü. Pauschale:         **+${_fmt(ueber)}** ✅\n`;
    if (p.gst !== null) r += `    Steuerersparnis (ca. ${p.gst} %):     ca. **${_fmt(Math.round(ueber * p.gst / 100))}**\n`;
    r += `\n✅ **Einzelnachweis lohnt sich!** → Anlage N ausfüllen und alle Belege einreichen.\n`;
  } else {
    r += `\nWK-Pauschale reicht noch — noch **${_fmt(wkPausch - gesamt)}** Puffer.\n`;
    if (p.gst !== null && (wkPausch - gesamt) < 500) {
      r += `💡 Du bist nah dran — prüfe ob weitere Arbeitsmittel oder Fortbildungen fehlen.\n`;
    }
  }

  // Was sonst noch als WK gilt
  r += `\n**Was noch als WK absetzbar ist (häufig vergessen):**\n`;
  r += `- Arbeitsmittel: Laptop, Headset, Bürostuhl, Schreibtisch (GWG ≤ 800 € netto → Sofortabzug)\n`;
  r += `- Fortbildung: Kurse, Fachbücher, Zeitschriften — beruflich veranlasst\n`;
  r += `- Gewerkschaftsbeitrag: immer voll absetzbar (ab 2026 sogar über Pauschale hinaus)\n`;
  r += `- Umzug aus beruflichen Gründen (§ 9 Abs. 1 Nr. 5 EStG)\n`;
  r += `- Bewerbungskosten: Porto, Passfoto, Mappe\n`;
  r += `- Fachliteratur: Fachzeitschriften, Bücher mit beruflichem Bezug\n`;
  r += `\n📌 Alle WK in Anlage N, Zeilen 31–49.`;
  return r + _TAG;
}
function _h_bruttoNetto(p, yr, K) {
  if (!p.brutto) {
    return `Trag dein Jahresbrutto im Interview (📋) ein — dann berechne ich die vollständige Lohnabrechnung.` + _TAG;
  }
  if (typeof calcBruttoNetto !== "function") return `Brutto-Netto-Rechner nicht verfügbar.` + _TAG;
  const bn = calcBruttoNetto({ brutto: p.brutto, steuerklasse: p.sk, kirchensteuer: p.kstMit, bundesland: p.bl, kinder: p.kinder, year: yr });
  let r = `**Brutto → Netto ${yr}** (SK ${p.sk}${p.kstMit ? " + KiSt" : ""})\n\n`;
  r += `    Jahresbrutto:       ${_fmt(p.brutto)}\n`;
  r += `    − Lohnsteuer:       ${_fmt(bn.lohnsteuer)}  (${_pct(bn.lohnsteuer / p.brutto * 100)})\n`;
  if (bn.soli > 0) r += `    − Soli:             ${_fmt(bn.soli)}\n`;
  if (bn.kst  > 0) r += `    − Kirchensteuer:    ${_fmt(bn.kst)}\n`;
  r += `    − KV:               ${_fmt(bn.kv)}\n`;
  r += `    − RV:               ${_fmt(bn.rv)}\n`;
  r += `    − ALV:              ${_fmt(bn.alv)}\n`;
  r += `    − PV:               ${_fmt(bn.pv)}\n`;
  r += `    ─────────────────────────\n`;
  r += `    Jahres-Netto:       **${_fmt(bn.netto)}**\n`;
  r += `    Monats-Netto ca.:   **${_fmt(Math.round(bn.netto / 12))}**/Monat\n\n`;
  r += `Effektiver Steuersatz: **${_pct(bn.lohnsteuer / p.brutto * 100)}**`;
  if (p.gst !== null) r += ` · Grenzsteuersatz: **~${p.gst} %**`;
  r += `\n\n*Vereinfachte Berechnung — kein Lohnsteuerjahresausgleich, keine Freibetragsanträge enthalten.*`;
  return r + _TAG;
}

function _h_steuerklasse(p, yr) {
  const skt = {
    1: "Ledig, geschieden, verwitwet (>1 Jahr), getrennt lebend",
    2: "Alleinerziehend → Entlastungsbetrag 4.008 €/Jahr",
    3: "Verheiratet/EP, höheres Einkommen → niedrigster Abzug",
    4: "Verheiratet/EP, ähnliches Einkommen (Standard)",
    5: "Verheiratet/EP, niedrigeres Einkommen → höchster Abzug",
    6: "Zweites/weiteres Arbeitsverhältnis → maximaler Abzug",
  };
  let r = `**Steuerklassen ${yr}**\n\n`;
  Object.entries(skt).forEach(([k, v]) => {
    r += `- **SK ${k}:** ${v}\n`;
  });
  if (p.sk) r += `\nDeine aktuelle Klasse: **SK ${p.sk}**\n`;
  r += `\n**SK III/V vs. IV/IV:** Bei starkem Einkommensunterschied spart III/V monatlich Netto, aber: Nachzahlung bei Veranlagung möglich.\n`;
  r += `**Faktor-Verfahren (§ 39f EStG):** Alternative zu III/V — vermeidet Nachzahlung bei genauerer monatlicher Aufteilung.\n`;
  r += `\n📌 Wechsel beim Finanzamt beantragen (Formular "Antrag auf Steuerklassenwechsel bei Ehegatten/Lebenspartnern").`;
  return r + _TAG;
}

function _h_grundfreibetrag(yr, K) {
  const raw = window.TAX_CONFIG_RAW || {};
  let r = `**Steuerliche Freibeträge ${yr}**\n\n`;
  r += `| Freibetrag | Betrag | Paragraf |\n|---|---|---|\n`;
  r += `| Grundfreibetrag | **${_fmt(K.grundfreibetrag)}** | § 32a EStG |\n`;
  r += `| WK-Pauschale (AN) | **${_fmt(K.wk_pauschale)}** | § 9a EStG |\n`;
  r += `| Sonderausgaben-Pauschale | **36 €** | § 10c EStG |\n`;
  r += `| Sparerpauschbetrag (Single) | **${_fmt(K.sparerpauschbetrag_single || 1000)}** | § 20 Abs. 9 EStG |\n`;
  r += `| Sparerpauschbetrag (verh.) | **${_fmt(K.sparerpauschbetrag_verheiratet || 2000)}** | § 20 Abs. 9 EStG |\n`;
  if (raw.kinderfreibetrag_gesamt_2026 && yr >= 2026) r += `| Kinderfreibetrag je Kind | **${_fmt(raw.kinderfreibetrag_gesamt_2026)}** | § 32 EStG |\n`;
  r += `\n**Grundfreibetrag heißt:** Bis ${_fmt(K.grundfreibetrag)} zvE (zu versteuerndes Einkommen) fällt null Steuer an.\n`;
  r += `zvE = Bruttoeinkommen − Werbungskosten − Sonderausgaben − Vorsorgeaufwendungen − ggf. Freibeträge.`;
  return r + _TAG;
}

function _h_sonderausgaben(p, yr, K, ia) {
  const kvJ = Number(ia.kv_beitrag_jahres || 0);
  const riesterJ = Number(ia.riester_eigenanteil || 0);
  const bavJ = Number(ia.bav_beitrag_jahres || 0);
  let r = `**Sonderausgaben ${yr}** (§ 10 EStG)\n\n`;
  r += `**1. Vorsorgeaufwendungen (§ 10 Abs. 1 Nr. 2–3a EStG):**\n`;
  r += `- Private KV/PV-Beiträge: vollständig absetzbar (Basisabsicherung)\n`;
  r += `- Gesetzl. KV/PV: AN-Anteil absetzbar\n`;
  const _rie = (window.TAX_CONFIG_RAW || {}).riester || {};
  const _rue = (window.TAX_CONFIG_RAW || {}).ruerup || {};
  const _riesterMax = _rie.max_sa_abzug ?? 2100;
  const _ruerupMax  = _rue.hoechstbetrag ?? 26528;
  const _ruerupPct  = _rue.abzugsprozent ?? 0.86;
  r += `- Riester: bis ${_fmt(_riesterMax)}/Jahr (Eigenanteil + Zulagen)\n`;
  r += `- Rürup: bis ${_fmt(Math.round(p.brutto > 0 ? Math.min(p.brutto * _ruerupPct, _ruerupMax) : _ruerupMax))}/Jahr (${yr})\n\n`;
  r += `**2. Sonstige Sonderausgaben:**\n`;
  r += `- Kirchensteuer (§ 10 Abs. 1 Nr. 4 EStG)\n`;
  r += `- Spenden (§ 10b EStG): bis 20 % des GE als SA; Spendenquittung nötig\n`;
  r += `- Berufsausbildungskosten Erststudium: max. 6.000 € (§ 10 Abs. 1 Nr. 7 EStG)\n`;
  r += `- Unterhalt Ex-Partner (§ 10 Abs. 1a Nr. 1 EStG): max. 13.805 €\n`;
  if (kvJ > 0) r += `\n**Dein KV-Beitrag:** ${_fmt(kvJ)}/Jahr → voll absetzbar`;
  if (riesterJ > 0) r += `
**Dein Riester-Eigenanteil:** ${_fmt(riesterJ)}/Jahr (+ Grundzulage ${_fmt(_rie.grundzulage ?? 175)} + ggf. Kinderzulage)`;
  if (bavJ > 0) r += `\n**Dein bAV-Beitrag:** ${_fmt(bavJ)}/Jahr → steuer- + SV-frei bis 4 % BBG`;
  r += `\n\n📌 Alles in Anlage Vorsorgeaufwand + Mantelbogen.`;
  return r + _TAG;
}

function _h_haushaltsnahe(p, yr, K, state) {
  const yr_s = String(yr);
  const receipts = state.receipts || [];
  const dlSum  = receipts.filter(r => r.steuerkat === "haushaltsnahe" && (r.datum||"").startsWith(yr_s)).reduce((s,r) => s + Number(r.gesamtbetrag||0), 0);
  const hwkSum = receipts.filter(r => r.steuerkat === "handwerker"    && (r.datum||"").startsWith(yr_s)).reduce((s,r) => s + Number(r.gesamtbetrag||0), 0);
  const raw = window.TAX_CONFIG_RAW || {};
  const dlMaxAuf  = raw.haushaltsnahe_dienstleistungen?.max_aufwendungen  || 20000;
  const dlMaxEr   = raw.haushaltsnahe_dienstleistungen?.max_ermaessigung  || 4000;
  const hwkMaxArb = raw.handwerkerleistungen?.max_arbeitskosten  || 6000;
  const hwkMaxEr  = raw.handwerkerleistungen?.max_ermaessigung   || 1200;
  let r = `**§ 35a EStG — Steuerermäßigung für Dienstleistungen im Haushalt**\n\n`;
  r += `**Abs. 2 — Haushaltsnahe Dienstleistungen (Putzhilfe, Gartenpflege, Pflegedienst):**\n`;
  r += `- 20 % der Aufwendungen, max. **${_fmt(dlMaxEr)}/Jahr**\n`;
  r += `- Basis: Aufwendungen bis ${_fmt(dlMaxAuf)}/Jahr\n`;
  r += `- Wichtig: nur **Überweisung** (kein Bargeld!), Rechnung aufbewahren\n\n`;
  r += `**Abs. 3 — Handwerkerleistungen (Renovierung, Reparatur, Installation):**\n`;
  r += `- 20 % der **Lohnkosten**, max. **${_fmt(hwkMaxEr)}/Jahr**\n`;
  r += `- Basis: Arbeitskosten bis ${_fmt(hwkMaxArb)}/Jahr (Materialkosten zählen NICHT)\n`;
  r += `- Immer: Lohnanteil auf Rechnung ausweisen lassen\n`;
  if (dlSum > 0) {
    const dlErm = Math.min(Math.round(dlSum * 0.20), dlMaxEr);
    r += `\n**Deine §35a Abs.2-Belege:** ${_fmt(dlSum)} → Steuerermäßigung **${_fmt(dlErm)}**`;
  }
  if (hwkSum > 0) {
    const hwkErm = Math.min(Math.round(hwkSum * 0.20), hwkMaxEr);
    r += `\n**Deine Handwerker-Belege:** ${_fmt(hwkSum)} (Lohnanteil) → Steuerermäßigung **${_fmt(hwkErm)}**`;
  }
  r += `\n\n📌 Anlage Haushaltsnahe Aufwendungen (Zeile 71–77 Mantelbogen).`;
  r += `\n⚠️ Ermäßigung mindert direkt die Steuerlast (kein Abzug vom Einkommen) — sehr wertvoll!`;
  return r + _TAG;
}

function _h_kapital(p, yr, K, investments) {
  const verh = p.verh;
  const sparer = verh ? (K.sparerpauschbetrag_verheiratet || 2000) : (K.sparerpauschbetrag_single || 1000);
  const trades = (investments?.trades || []).filter(t => (t.date||"").startsWith(String(yr)));
  let r = `**Kapitalertragssteuer ${yr}** (§ 20 EStG)\n\n`;
  r += `**Steuersatz:** 25 % KapESt + 5,5 % Soli darauf = **26,375 % effektiv**\n\n`;
  r += `**Sparerpauschbetrag: ${_fmt(sparer)}** ${verh ? "(verheiratet)" : "(Single)"}\n`;
  r += `→ Bis zu diesem Betrag sind Kapitalerträge steuerfrei.\n`;
  r += `→ Freistellungsauftrag bei jeder Bank separat stellen!\n\n`;
  r += `**Verlustverrechnung (§ 20 Abs. 6 EStG):**\n`;
  r += `- Aktien-Verluste: dürfen NUR Aktien-Gewinne mindern\n`;
  r += `- Sonstige Verluste (ETF, Zinsen): verrechnen breiter\n\n`;
  r += `**Günstigerprüfung (§ 32d Abs. 6 EStG):**\n`;
  r += `Wenn dein persönlicher Grenzsteuersatz < 25 %, beantrage Anlage KAP → dann gilt dein niedrigerer Satz.`;
  if (p.gst !== null && p.gst < 25) r += ` Bei dir (~${p.gst} %) **empfohlen!**`;
  if (trades.length > 0 && typeof calcKapESt === "function") {
    const kap = calcKapESt({ trades, year: String(yr), verheiratet: verh, kirchensteuer: p.kstMit, bundesland: p.bl });
    r += `\n\n**Deine Kapitalerträge ${yr}:**\n`;
    r += `    Gewinne:             ${_fmt(kap.gewinn)}\n`;
    r += `    Verluste:            ${_fmt(kap.verlust)}\n`;
    r += `    Saldo:               ${_fmt(kap.saldo)}\n`;
    r += `    Sparerpauschbetrag:  ${_fmt(kap.freibetrag)}\n`;
    r += `    Steuerpflichtig:     ${_fmt(kap.steuerpflichtig)}\n`;
    r += `    KapESt + Soli:       **${_fmt(kap.gesamt)}**\n`;
  }
  r += `\n\n📌 Anlage KAP. Kirchensteuer auf KapErträge: Anlage KAP-INV.`;
  return r + _TAG;
}


function _h_guenstiger(p, yr, K, investments) {
  const verh = p.verh;
  const sparer = verh ? (K.sparerpauschbetrag_verheiratet || K.sparerpauschbetrag_single * 2) : K.sparerpauschbetrag_single;
  let r = `**Günstigerprüfung ${yr} (§ 32d Abs. 6 EStG)**\n\n`;
  r += `Die Günstigerprüfung erlaubt dir, Kapitalerträge **statt mit dem pauschalen 25 % KapESt-Satz** mit deinem persönlichen Einkommensteuersatz zu versteuern – wenn dieser niedriger ist.\n\n`;
  r += `**Wann lohnt sich das?**\n`;
  r += `- Dein persönlicher Grenzsteuersatz liegt **unter 25 %**\n`;
  r += `- Das ist meistens der Fall bei Einkommen deutlich unterhalb des Spitzensteuersatzes\n\n`;
  r += `**Grundfreibetrag ${yr}: ${_fmt(K.grundfreibetrag)}** – bis hierhin ist auch Kapitalertrag steuerfrei.\n\n`;

  if (p.gst !== null && p.gst !== undefined) {
    if (p.gst < 25) {
      r += `✅ **Bei dir empfohlen!** Dein Grenzsteuersatz (~${p.gst} %) liegt unter 25 %.\n`;
      r += `→ Beantrage die Günstigerprüfung in der **Anlage KAP**, Zeile 4 ("Ich beantrage die Günstigerprüfung").\n`;
      r += `→ Das Finanzamt prüft dann automatisch beide Varianten und wählt die günstigere.\n\n`;
    } else {
      r += `ℹ️ Bei deinem Grenzsteuersatz (~${p.gst} %) ist die Günstigerprüfung **nicht vorteilhaft** – der pauschale 25 %-Satz ist günstiger.\n\n`;
    }
  } else {
    r += `ℹ️ Kein Grenzsteuersatz bekannt – vervollständige dein Profil (Brutto, Steuerklasse, Bundesland) für eine persönliche Empfehlung.\n\n`;
  }

  r += `**Sparerpauschbetrag ${yr}: ${_fmt(sparer)}** ${verh ? "(verheiratet)" : "(Single)"}\n`;
  r += `→ Kapitalerträge bis zu dieser Grenze sind ohnehin steuerfrei – Freistellungsauftrag bei jeder Bank stellen!\n\n`;

  if (investments?.trades?.length > 0 && typeof calcKapESt === "function") {
    const trades = (investments.trades || []).filter(t => (t.date || "").startsWith(String(yr)));
    if (trades.length > 0) {
      const kap = calcKapESt({ trades, year: String(yr), verheiratet: verh, kirchensteuer: p.kstMit, bundesland: p.bl });
      r += `**Deine Kapitalerträge ${yr}:**\n`;
      r += `    Gewinne:             ${_fmt(kap.gewinn)}\n`;
      r += `    Verluste:            ${_fmt(kap.verlust)}\n`;
      r += `    Saldo:               ${_fmt(kap.saldo)}\n`;
      r += `    Sparerpauschbetrag:  ${_fmt(kap.freibetrag)}\n`;
      r += `    Steuerpflichtig:     ${_fmt(kap.steuerpflichtig)}\n`;
      r += `    KapESt + Soli:       **${_fmt(kap.gesamt)}**\n\n`;
    }
  }

  r += `**So beantragst du die Günstigerprüfung:**\n`;
  r += `1. Steuererklärung → Anlage KAP, Zeile 4 ankreuzen\n`;
  r += `2. Alle Kapitalerträge eintragen (Jahressteuerbescheinigung der Bank)\n`;
  r += `3. Finanzamt berechnet automatisch die günstigere Variante\n`;
  r += `4. Zu viel gezahlte KapESt wird erstattet\n\n`;
  r += `📌 Auch wenn du keine Erstattung erwartest: Anlage KAP immer einreichen, wenn Günstigerprüfung möglich!`;
  return r + _TAG;
}

function _h_soli(yr, K) {
  const fg = K.soli_freigrenze || 18130;
  let r = `**Solidaritätszuschlag ${yr}** (§ 4 SolZG)\n\n`;
  r += `- Satz: **5,5 %** der Lohnsteuer (nicht des Einkommens!)\n`;
  r += `- Freigrenze: **${_fmt(fg)} Lohnsteuer/Jahr** → darunter 0 % Soli\n`;
  r += `- Milderungszone: zwischen Freigrenze und ca. ${_fmt(fg * 1.3)} gleitend\n`;
  r += `- Seit 2021 zahlen ~90 % der Steuerpflichtigen keinen Soli mehr\n`;
  r += `- Auf Kapitalerträge: Soli auf KapESt → Gesamtsatz 26,375 %\n\n`;
  r += `Soli wird automatisch über die Lohnsteuer berechnet — kein gesondertes Handeln nötig.`;
  return r + _TAG;
}

function _h_kirchensteuer(p, yr) {
  // KiSt-Sätze ausschließlich aus Config (§ 51a EStG)
  const _K    = (typeof getK === "function") ? (getK(yr) || {}) : {};
  const _kstC = _K.kirchensteuer_satz || (window.TAX_CONFIG_RAW || {}).kirchensteuer_satz || {};
  const satzDez = p.bl ? (_kstC[p.bl] ?? _kstC.default ?? 0.09) : 0.09;
  const satz    = Math.round(satzDez * 100);
  const satzBY  = Math.round((_kstC.BY ?? 0.08) * 100);
  const satzDef = Math.round((_kstC.default ?? 0.09) * 100);
  const raw  = window.TAX_CONFIG_RAW || {};
  let r = `**Kirchensteuer ${yr}** (§ 51a EStG)\n\n`;
  r += `| Bundesland | Satz |\n|---|---|\n`;
  r += `| Bayern, Baden-Württemberg | **${satzBY} %** der Lohnsteuer |\n`;
  r += `| Alle anderen Bundesländer | **${satzDef} %** der Lohnsteuer |\n`;
  if (p.bl !== "default") r += `\nDein Bundesland (${p.bl}): **${satz} %**\n`;
  r += `\n**Kirchensteuer ist Sonderausgabe** (§ 10 Abs. 1 Nr. 4 EStG) → mindert das zvE.\n`;
  r += `Kirchensteuer auf Kapitalerträge: wird auf die KapESt angerechnet → effektiver KapESt-Satz leicht niedriger.\n`;
  r += `\n**Kirchenaustritt:** Beim Standesamt/Amtsgericht. Wirkung: ab nächstem Jahr keine KiSt mehr. Kirchensteuer im Austrittsjahr anteilig.`;
  return r + _TAG;
}

function _h_fristen(yr) {
  const ny = yr + 1;
  let r = `**Steuerliche Fristen ${yr}/${ny}**\n\n`;
  r += `| Frist | Beschreibung |\n|---|---|\n`;
  r += `| **31.07.${yr}** | Steuererklärung ${yr-1} (ohne Steuerberater) |\n`;
  r += `| **02.06.${ny}** | Steuererklärung ${yr-1} mit Steuerberater |\n`;
  r += `| **28.02.${ny+1}** | Verlängerung bis Ende Feb. ${ny+1} mit Steuerberater möglich |\n`;
  r += `| **31.12.${yr}** | Letzte Chance: freiwillige Erklärung für ${yr-4} (4-Jahres-Frist!) |\n`;
  r += `| **1 Monat** | Einspruchsfrist nach Steuerbescheid (§ 355 AO) |\n\n`;
  r += `**Rückwirkende Erklärungen — nicht vergessen:**\n`;
  r += `Freiwillig bis 4 Jahre rückwirkend möglich. Ø-Erstattung laut Statistischem Bundesamt: **~1.100 €/Jahr**.\n`;
  r += `→ ${yr-4}, ${yr-3}, ${yr-2}, ${yr-1} noch einreichbar (solange Frist nicht abgelaufen).\n\n`;
  r += `📌 Abgabe via ELSTER.de (kostenlos) oder Steuersoftware (WISO, Taxfix etc.).`;
  return r + _TAG;
}

function _h_minijob(yr, K) {
  const raw = window.TAX_CONFIG_RAW || {};
  const grenze = raw.minijob_grenze_monatlich?.[String(yr)] || 603;
  let r = `**Minijob ${yr}** (§ 8 SGB IV)\n\n`;
  r += `- Einkommensgrenze: **${_fmt(grenze)}/Monat** (${_fmt(grenze * 12)}/Jahr)\n`;
  r += `- Arbeitnehmer: sozialversicherungsfrei, pauschal versteuert (keine Lohnsteuer)\n`;
  r += `- Arbeitgeber zahlt pauschal ~30 % (KV + RV + Steuern)\n\n`;
  r += `**Midijob-Übergangsbereich:** ${_fmt(grenze + 1)} – ${_fmt(2000)}/Monat → reduzierte SV-Beiträge\n\n`;
  r += `**Steuerlich:** Minijob-Einkünfte tauchen in der Steuererklärung nicht auf (pauschal abgegolten), AUSSER du optierst zur Regelbesteuerung (§ 40a EStG Abs. 2). Dann kann ein Verlust aus dem Minijob mit anderen Einkünften verrechnet werden.`;
  return r + _TAG;
}

function _h_riester(p, yr, K, ia) {
  // ── Alle Werte ausschließlich aus Config (§ 10a EStG) ──
  const _rie        = (window.TAX_CONFIG_RAW || {}).riester || {};
  const grundzulage = K.riester_grundzulage            ?? _rie.grundzulage          ?? 175;
  const kindzulage  = K.riester_kinderzulage_ab_2008    ?? _rie.kinderzulage_ab_2008  ?? 300;
  const maxSA       = K.riester_max_sa_abzug            ?? _rie.max_sa_abzug          ?? 2100;
  const minPct      = K.riester_mindestbeitrag_prozent  ?? _rie.mindestbeitrag_prozent ?? 0.04;
  const minAbs      = K.riester_mindestbeitrag_absolut  ?? _rie.mindestbeitrag_absolut ?? 60;

  const eigenanteil  = Number(ia.riester_eigenanteil || 0);
  const kinder_anz   = p.kinder ? (Number(ia.kinder_anzahl) || 1) : 0;
  const brutto       = p.brutto || 0;

  // Mindestbeitrag (§ 10a Abs. 1 EStG): 4 % des Vorjahresbruttos − Zulagen, mind. 60 €
  const zulagenGesamt  = grundzulage + kinder_anz * kindzulage;
  const mindestbeitrag = Math.max(minAbs, Math.round(brutto * minPct - zulagenGesamt));

  let r = `**Riester-Rente ${yr}** (§ 10a EStG)\n\n`;

  // ── Zulagen ──
  r += `**Staatliche Zulagen (direkt aufs Konto):**\n`;
  r += `- Grundzulage: **${_fmt(grundzulage)}/Jahr**\n`;
  r += `- Kinderzulage: **${_fmt(kindzulage)}/Kind/Jahr** (Kinder ab 2008 geboren)\n`;
  r += `- Voraussetzung: Mindestbeitrag (4 % Vorjahresbrutto − Zulagen, mind. ${_fmt(minAbs)})\n`;
  if (brutto > 0) r += `- Dein Mindestbeitrag (geschätzt): **${_fmt(mindestbeitrag)}/Jahr**\n`;
  r += `\n`;

  // ── SA-Abzug ──
  r += `**Sonderausgabenabzug (§ 10a EStG):**\n`;
  r += `- Eigenanteil + Zulagen bis max. **${_fmt(maxSA)}/Jahr** absetzbar\n`;
  r += `- Das Finanzamt prüft automatisch die **Günstigerprüfung**\n\n`;

  if (eigenanteil > 0 && p.gst !== null) {
    // ── Echte Günstigerprüfung (§ 10a Abs. 2 EStG) ──
    const einzahlungGesamt = eigenanteil + zulagenGesamt;
    const abzugsfaehig     = Math.min(einzahlungGesamt, maxSA);

    // Variante A: nur Zulagen (kein SA-Abzug)
    const vorteilZulagen = zulagenGesamt;

    // Variante B: SA-Abzug → Steuerersparnis
    const steuerersparnis = Math.round(abzugsfaehig * p.gst / 100);
    // Günstigerprüfung: FA vergleicht SA-Steuerersparnis mit Zulagen und wählt das Bessere
    const guenstiger      = steuerersparnis > vorteilZulagen ? "SA-Abzug" : "Zulagen";
    const vorteilGesamt   = Math.max(vorteilZulagen, steuerersparnis);
    const mehrwertSA      = Math.max(0, steuerersparnis - vorteilZulagen);

    r += `**Deine Günstigerprüfung (Grenzsteuersatz ~${p.gst} %):**\n`;
    r += `- Eigenanteil: ${_fmt(eigenanteil)}/Jahr\n`;
    r += `- Zulagen: ${_fmt(zulagenGesamt)} (Grundzulage ${_fmt(grundzulage)}${kinder_anz > 0 ? ` + ${kinder_anz}× ${_fmt(kindzulage)} Kinderzulage` : ""})\n`;
    r += `- Als SA absetzbar (inkl. Zulagen): ${_fmt(abzugsfaehig)}\n\n`;
    r += `| Variante | Vorteil |\n`;
    r += `|---|---|\n`;
    r += `| Nur Zulagen | **${_fmt(vorteilZulagen)}** |\n`;
    r += `| SA-Abzug (${p.gst} % auf ${_fmt(abzugsfaehig)}) | **${_fmt(steuerersparnis)}** |\n`;
    r += `\n→ **Finanzamt wählt automatisch: ${guenstiger}**`;
    if (guenstiger === "SA-Abzug") {
      r += ` → Gesamtvorteil ca. **${_fmt(vorteilGesamt)}/Jahr** (${_fmt(mehrwertSA)} Mehrwert über Zulagen)`;
    } else {
      r += ` → Gesamtvorteil = Zulagen **${_fmt(vorteilGesamt)}/Jahr**`;
    }
  } else if (eigenanteil > 0) {
    const abzugsfaehig = Math.min(eigenanteil + zulagenGesamt, maxSA);
    r += `**Dein Riester:** Eigenanteil ${_fmt(eigenanteil)}/Jahr\n`;
    r += `- Als SA absetzbar (inkl. Zulagen): ${_fmt(abzugsfaehig)}\n`;
    r += `- Zulagen garantiert: ${_fmt(zulagenGesamt)}/Jahr\n`;
    r += `→ Günstigerprüfung durch Finanzamt (SA-Abzug oder Zulagen, je nach Steuersatz)`;
  } else {
    r += `**Kein Riester-Eigenanteil erfasst.**\n`;
    r += `→ ${brutto > 0 ? `Mindestbeitrag ca. ${_fmt(mindestbeitrag)}/Jahr` : "Mindestbeitrag nach Einkommensprofil berechnen"}, um volle Zulagen zu erhalten.`;
  }

  r += `\n\n📌 Anlage AV ausfüllen. Zulagen jährlich beim Anbieter oder direkt bei der ZfA beantragen.`;
  return r + _TAG;
}
function _h_ruerup(p, yr) {
  const _rue     = (window.TAX_CONFIG_RAW || {}).ruerup || {};
  const _rMax    = _rue.hoechstbetrag ?? 26528;
  const _rPct    = _rue.abzugsprozent ?? 0.86;
  const maxAbzug = Math.round(Math.min(p.brutto > 0 ? p.brutto * _rPct : _rMax, _rMax));
  let r = `**Rürup/Basisrente ${yr}** (§ 10 Abs. 1 Nr. 2 EStG)\n\n`;
  r += `- Beiträge bis **${_fmt(maxAbzug)}/Jahr** absetzbar (${(_rPct * 100).toFixed(0)} % des Höchstbetrags ${_fmt(_rMax)})\n`;
  r += `- Für Selbstständige besonders attraktiv (kein gesetzl. RV-Zugang)\n`;
  r += `- Nachgelagerte Besteuerung: Einzahlungen steuerfrei, Rentenbezug versteuern\n`;
  r += `- Nicht beleihbar, nicht vererbbar (Ausnahmen Hinterbliebenenschutz)\n\n`;
  if (p.gst !== null && p.brutto > 0) {
    const ersparnis = Math.round(maxAbzug * p.gst / 100);
    r += `Bei Grenzsteuersatz ~${p.gst} % und max. Einzahlung (${_fmt(maxAbzug)}): Ersparnis ca. **${_fmt(ersparnis)}/Jahr**`;
  }
  r += `\n\n📌 Anlage Vorsorgeaufwand, Zeile 4–10.`;
  return r + _TAG;
}

function _h_bav(p, yr, K, ia) {
  const raw = window.TAX_CONFIG_RAW || {};
  const bbg = raw.beitragsbemessungsgrenze?.[String(yr)]?.rv_monatlich ?? K.bbg_rv_monatlich;
  const maxBeitr = Math.round(bbg * 12 * 0.04);
  const bavJ = Number(p.brutto > 0 ? Number((ia || {}).bav_beitrag_jahres || 0) : 0);
  let r = `**Betriebliche Altersvorsorge (bAV) ${yr}** (§ 3 Nr. 63 EStG)\n\n`;
  r += `**Steuer- UND SV-freie Einzahlungen:**\n`;
  r += `- Bis **4 % der BBG** (${_fmt(bbg)}/Monat) = **${_fmt(maxBeitr)}/Jahr** steuer- und sv-frei\n`;
  r += `- Zusätzlich **+1.800 €/Jahr** rein steuerfrei (kein SV-Beitrag)\n\n`;
  r += `**Entgeltumwandlung:** Bruttolohn wird direkt in bAV umgewandelt → spart Steuern + SV sofort.\n`;
  r += `Arbeitgeber muss seit 2019 bei Neuverträgen **15 %** der umgewandelten Beträge zuschießen.\n\n`;
  r += `**Nachgelagerte Besteuerung:** Im Rentenalter mit dann niedrigerem Steuersatz versteuern.\n\n`;
  if (bavJ > 0) {
    r += `**Dein bAV-Beitrag:** ${_fmt(bavJ)}/Jahr`;
    if (p.gst !== null) {
      const ersparnis = Math.round(bavJ * (p.gst / 100 + 0.20));
      r += ` → Ersparnis ca. **${_fmt(ersparnis)}/Jahr** (Steuern + SV-Anteil kombiniert)\n`;
    } else {
      r += `\n`;
    }
  } else if (p.gst !== null && p.brutto > 0) {
    r += `**Beispiel bei dir:** ${_fmt(maxBeitr)}/Jahr (Max.-Beitrag) in bAV → Ersparnis ca. ${_fmt(Math.round(maxBeitr * (p.gst / 100 + 0.2)))}/Jahr (Steuern + SV-Anteil)`;
  }
  r += `\n\n📌 Über Arbeitgeber abwickeln. In der Steuererklärung: nichts eintragen (Lohnzettel enthält alles).`;
  return r + _TAG;
}

function _h_aussergewoehnlich(p, yr, K) {
  let r = `**Außergewöhnliche Belastungen ${yr}** (§§ 33–33b EStG)\n\n`;
  r += `**§ 33 — Allgemeine außergewöhnliche Belastungen:**\n`;
  r += `- Krankheitskosten, Zahnarzt, Hilfsmittel, Kurkosten (zwangsläufig, medizinisch nötig)\n`;
  r += `- Zumutbare Eigenbelastung wird abgezogen (abhängig von Einkommen + Familienstand)\n`;
  r += `- Belege nötig: Arztrechnungen, Rezepte, Atteste\n\n`;
  r += `**§ 33a — Unterhalt für nahestehende Personen:**\n`;
  r += `- Max. **${_fmt(K.grundfreibetrag)}/Jahr** (= Grundfreibetrag)\n\n`;
  r += `**§ 33b — Pauschbeträge:**\n`;
  r += `| Behinderungsgrad | Pauschbetrag/Jahr |\n|---|---|\n`;
  r += `| 20 % | 384 € |\n`;
  r += `| 30 % | 620 € |\n`;
  r += `| 50 % | 1.140 € |\n`;
  r += `| 70 % | 1.780 € |\n`;
  r += `| 80 % | 2.120 € |\n`;
  r += `| 100 % | 2.840 € |\n`;
  r += `| Pflegeperson (häusl. Pflege) | **924 €** (§ 33b Abs. 6) |\n\n`;
  r += `📌 Anlage Außergewöhnliche Belastungen. Behindertenausweis oder ärztliches Attest als Nachweis.`;
  return r + _TAG;
}

function _h_studenten(yr, K) {
  const raw = window.TAX_CONFIG_RAW || {};
  const sa_max = raw.studenten?.erststudium_sonderausgaben_max || 6000;
  let r = `**Studenten & Auszubildende — Steuerregeln ${yr}**\n\n`;
  r += `**Erststudium (Bachelor / erstes Studium nach Schule):**\n`;
  r += `- Studienkosten = Sonderausgaben, max. **${_fmt(sa_max)}/Jahr**\n`;
  r += `- Fahrtkosten Uni → Sonderausgaben (kein Verlustabzug möglich)\n`;
  r += `- Kein steuerlicher Verlustvortrag\n\n`;
  r += `**Zweitstudium / Master / Berufsausbildung:**\n`;
  r += `- Studienkosten = **Werbungskosten** (kein Deckel!)\n`;
  r += `- Verlustvortrag möglich (§ 10d EStG) → bis 7 Jahre rückwirkend\n`;
  r += `- Auch bei 0 € Einkommen Steuererklärung abgeben → Verlust feststellen lassen\n\n`;
  r += `**Fahrtkosten — 3-Orte-Logik (duales Studium):**\n`;
  r += `- Betrieb → immer WK (Pendlerpauschale)\n`;
  r += `- Berufsschule → WK (beruflich veranlasst)\n`;
  r += `- Uni (Erststudium) → SA; Uni (Zweitstudium) → WK\n\n`;
  r += `**Laptop:** Ab ${yr >= 2021 ? 2021 : yr} Sofortabschreibung möglich (auch bei 10 % beruflicher Nutzung)\n`;
  r += `**Rückwirkend:** ${raw.studenten?.freiwillige_abgabe_rueckwirkend_jahre || 4} Jahre freiwillig (Zweitstudium bis zu 7 Jahre Verlustvortrag)`;
  return r + _TAG;
}

function _h_verlust(yr) {
  let r = `**Verlustvortrag & -rücktrag** (§ 10d EStG)\n\n`;
  r += `**Verlustrücktrag:** Verlust des aktuellen Jahres kann ins Vorjahr zurückgetragen werden → max. **10 Mio. €** (Einzelveranlagung). Sofortige Steuererstattung für Vorjahr.\n\n`;
  r += `**Verlustvortrag:** Verluste werden unbegrenzt in Folgejahre vorgetragen.\n`;
  r += `- Bis 1 Mio. € voll verrechenbar\n`;
  r += `- Darüber: Mindestbesteuerung 60 % (Rest wird vorgetragen)\n\n`;
  r += `**Wichtig:** Verlustfeststellungsbescheid beantragen! Nur dann gilt der Verlust für spätere Jahre.\n\n`;
  r += `**Kapitalverluste** (§ 20 EStG): Getrennte Verrechnungstöpfe bei der Bank. Verlustbescheinigung bis **15. Dezember** beantragen, dann in Anlage KAP verrechnen.\n\n`;
  r += `📌 Verlustfeststellungserklärung beim Finanzamt separat abgeben.`;
  return r + _TAG;
}

function _h_arbeitsmittel(p, yr) {
  const raw = window.TAX_CONFIG_RAW || {};
  const gwg = raw.gwg_grenze_brutto || 952;
  let r = `**Arbeitsmittel & GWG ${yr}** (§ 9 Abs. 1 Nr. 6 EStG)\n\n`;
  r += `**Sofortabschreibung (GWG):** Netto-Wert ≤ 800 € (Brutto ≤ ${_fmt(gwg)}) → im Kaufjahr voll absetzbar\n`;
  r += `- Laptop, Drucker, Schreibtisch, Bürostuhl, Fachliteratur etc.\n`;
  r += `- Ab 2021 gilt auch für Laptops ≤ 1.000 € die Sofortabschreibung (BMF-Schreiben)\n\n`;
  r += `**Nutzungsaufteilung:** Arbeitsmittel die privat + beruflich genutzt werden → anteilig absetzbar (mind. 10 % beruflich).\n\n`;
  r += `**Häusliches Arbeitszimmer** (§ 4 Abs. 5 Nr. 6b / § 9 Abs. 5 EStG):\n`;
  r += `- Arbeitszimmer als **Mittelpunkt** der Tätigkeit → volle Raumkosten absetzbar\n`;
  r += `- Seit 2023: Jahrespauschale **1.260 €** (alternativ zur Homeoffice-Pauschale) für echtes Arbeitszimmer\n`;
  r += `- Kein abgegrenztes Zimmer? → Homeoffice-Pauschale nutzen\n\n`;
  r += `📌 Belege aufbewahren. Bei Mischnutzung schriftliche Aufstellung der beruflichen Nutzungsanteile.`;
  return r + _TAG;
}

function _h_doppelteHH(p, yr, K) {
  let r = `**Doppelte Haushaltsführung ${yr}** (§ 9 Abs. 1 Nr. 5 EStG)\n\n`;
  r += `**Voraussetzungen:**\n`;
  r += `- Hauptwohnsitz aus beruflichen Gründen nicht der Beschäftigungsort\n`;
  r += `- Eigener Hausstand am Hauptwohnsitz (finanzielle Beteiligung an Wohnkosten)\n\n`;
  r += `**Absetzbare Kosten:**\n`;
  r += `- Unterkunft am Beschäftigungsort: max. **1.000 €/Monat** (Kaltmiete + NK + Stellplatz)\n`;
  r += `- Wöchentliche Heimfahrt: Pendlerpauschale (Entfernung Hauptwohnsitz ↔ Beschäftigungsort)\n`;
  r += `- Umzugskosten (bei beruflicher Veranlassung)\n`;
  r += `- Verpflegungsmehraufwand: erste 3 Monate (14 €/8h, 28 €/24h)\n\n`;
  r += `📌 Anlage N, Zeile 59–71. Mietvertrag, Wohnkostennachweise, Fahrtenprotokoll aufbewahren.`;
  return r + _TAG;
}

function _h_unterhalt(p, yr, K) {
  const max = K.grundfreibetrag;
  let r = `**Unterhaltszahlungen ${yr}** (§ 33a EStG)\n\n`;
  r += `**Unterhalt an Ex-Partner (Realsplitting, § 10 Abs. 1a Nr. 1 EStG):**\n`;
  r += `- Max. **13.805 €/Jahr** + KV/PV-Beiträge als Sonderausgabe\n`;
  r += `- Voraussetzung: Zustimmung des Empfängers (Anlage U) → Empfänger muss versteuern\n\n`;
  r += `**Unterhalt an Bedürftige (§ 33a Abs. 1 EStG):**\n`;
  r += `- Max. **${_fmt(max)}/Jahr** (= Grundfreibetrag) absetzbar\n`;
  r += `- Für Eltern, Kinder > 25 Jahre (ohne Anspruch auf Kindergeld) etc.\n`;
  r += `- Eigenes Einkommen/Vermögen des Empfängers wird angerechnet\n\n`;
  r += `📌 Anlage Unterhalt. Kontoauszüge als Nachweis. Auslandszahlungen: länderspezifische Kürzung prüfen.`;
  return r + _TAG;
}

function _h_kinder(p, yr, K) {
  const raw = window.TAX_CONFIG_RAW || {};
  const kg = raw.kindergeld_monatlich?.[`${yr >= 2026 ? "ab_2026" : "bis_2025"}`] ||
             (yr >= 2026 ? 259 : 255);
  const kfb = getK(yr).kinderfreibetrag_gesamt ?? raw.kinderfreibetrag_gesamt;
  let r = `**Kindergeld & Kinderfreibetrag ${yr}**\n\n`;
  r += `**Kindergeld:** **${kg} €/Monat** je Kind (= ${_fmt(kg * 12)}/Jahr)\n`;
  r += `- Automatisch — kein Antrag in der Steuererklärung nötig\n`;
  r += `- Bis 18 Jahre; bis 25 Jahre bei Ausbildung/Studium\n\n`;
  r += `**Kinderfreibetrag ${yr}: ${_fmt(kfb)} je Kind** (§ 32 EStG)\n`;
  r += `- Finanzamt prüft automatisch (Günstigerprüfung): KG oder Freibetrag — was mehr spart\n`;
  r += `- Bei höherem Einkommen lohnt sich der Freibetrag mehr\n\n`;
  r += `**Kinderbetreuungskosten (§ 10 Abs. 1 Nr. 5 EStG):**\n`;
  r += `- ²⁄₃ der Kosten, max. **4.000 €/Kind/Jahr** als Sonderausgaben\n`;
  r += `- Kita, Tagesmutter, Hort — nur Überweisung (kein Bargeld!)\n\n`;
  r += `📌 Anlage Kind. Geburtsurkunde beim ersten Antrag beilegen.`;
  return r + _TAG;
}

function _h_rueckwirkend(yr) {
  const erstattung = 1100;
  let r = `**Rückwirkende Steuererklärungen** (§ 46 EStG)\n\n`;
  r += `**Freiwillig bis 4 Jahre rückwirkend** → ${yr-4}, ${yr-3}, ${yr-2}, ${yr-1} noch einreichbar.\n`;
  r += `Ø-Erstattung laut Statistischem Bundesamt: **~${_fmt(erstattung)}/Jahr**\n\n`;
  r += `**Welche Jahre noch offen:**\n`;
  r += `| Steuerjahr | Frist läuft ab |\n|---|---|\n`;
  for (let y = yr-4; y <= yr-1; y++) {
    r += `| ${y} | 31.12.${y+4} |\n`;
  }
  r += `\n**Wann es sich besonders lohnt:**\n`;
  r += `- Homeoffice, Pendlerpauschale, Fortbildungen wurden nie abgesetzt\n`;
  r += `- Studium/Ausbildung abgeschlossen (Verlustvortrag für vergangene Jahre möglich)\n`;
  r += `- Krankheitskosten, haushaltsnahe Dienstleistungen vergessen\n\n`;
  r += `📌 Via ELSTER.de kostenlos rückwirkend einreichen. Daten aus alten Lohnsteuerbescheinigungen nutzen.`;
  return r + _TAG;
}

function _h_elster(yr) {
  let r = `**ELSTER — Elektronische Steuererklärung** (elster.de)\n\n`;
  r += `**Kostenlos & direkt beim Finanzamt:**\n`;
  r += `- elster.de → Mein ELSTER registrieren (ElsterSoftware oder Webformular)\n`;
  r += `- Alle Formulare elektronisch ausfüllen und senden\n`;
  r += `- Bescheid kommt per Post oder elektronisch\n\n`;
  r += `**Wichtige Anlagen:**\n`;
  r += `| Anlage | Inhalt |\n|---|---|\n`;
  r += `| **Anlage N** | Arbeitnehmereinkünfte, Werbungskosten, Homeoffice |\n`;
  r += `| **Anlage KAP** | Kapitalerträge, Günstigerprüfung |\n`;
  r += `| **Anlage SO** | Sonstige Einkünfte (Vermietung, Rente) |\n`;
  r += `| **Anlage Vorsorgeaufwand** | KV, Riester, Rürup, bAV |\n`;
  r += `| **Mantelbogen** | Kirchensteuer, Sonderausgaben, Unterhalt |\n`;
  r += `| **Anlage Kind** | Kindergeld, Kinderbetreuungskosten |\n\n`;
  r += `**ELSTER-CSV aus dieser App:** Im Steuer-Tab → ELSTER-Export Button → Datei für deinen Steuerberater oder zur eigenen Ablage.`;
  return r + _TAG;
}

// ════════════════════════════════════════════════════════════════════════
// KONZEPT-WISSENSDATENBANK — Fragetyp-Erkennung + Situations-Modifier
// Fängt Verständnisfragen ab BEVOR der Intent-Dispatcher greift
// ════════════════════════════════════════════════════════════════════════

// ── 1. Fragetyp-Erkennung ────────────────────────────────────────────────
const _FRAGE_TYPEN = {
  definition: /^(was (ist|sind|bedeutet|heißt|versteht man unter|meint man mit)|erkl[äae]r|definition|was genau (ist|bedeutet|heißt)|wie ist .{1,30} definiert|was verbirgt sich|was steckt hinter)/i,
  wie_funktioniert: /(wie (funktioniert|berechnet sich|berechne ich|rechnet man|wird .{1,20} berechnet|entsteht|läuft .{1,15} ab)|wie genau (funktioniert|berechnet)|wie rechne ich|funktionsweise)/i,
  gilt_fuer: /(gilt (das|die|der|es) (auch|für|bei)|kann ich (das|die|den|auch|trotzdem)|darf ich|habe ich (anspruch|recht)|steht mir|bin ich berechtigt|kommt (das|mir) (auch|in frage)|trifft das (auf mich|für mich)|gilt das (als|für|bei|wenn|auch wenn))/i,
  konditional: /(was (wenn|passiert wenn|ist wenn|gilt wenn|ändert sich wenn)|wenn ich (nur|erst|schon|noch|weniger|mehr|kein|keine)|falls ich|auch wenn ich|obwohl ich|trotzdem|wie lange muss|ab wann|bis wann gilt|nur .{1,20} monate|nur .{1,20} wochen|erst seit|noch nicht mal|weniger als)/i,
  vergleich: /(was ist (besser|sinnvoller|günstiger|vorteilhafter)|unterschied (zwischen|von)|vergleich|oder lieber|welches (lohnt|ist besser|ist sinnvoller)|vs\.?|versus|unterscheiden sich)/i,
  lohnt: /(lohnt (sich|es|das)|macht das sinn|rechnet sich|ist (es |das )?(sinnvoll|rentabel)|wann lohnt|für wen lohnt|bringt das was|wie viel spare ich|was bringt mir)/i,
  wo_eintragen: /(wo (trage ich|fülle ich|gebe ich|kommt das) (ein|aus|an)|welch(es|e|en) (formular|anlage|zeile|feld|rubrik)|in (welche|welchem|welchen) (anlage|formular|zeile|feld)|wo in der steuererklärung|elster.*wo|in welche anlage)/i,
  wer_berechtigt: /(wer (kann|darf|hat anspruch|ist berechtigt|profitiert|kommt in frage)|für wen (gilt|ist|kommt)|wer bekommt|wer profitiert)/i,
};

function _detectFragetyp(msg) {
  for (const [typ, re] of Object.entries(_FRAGE_TYPEN)) {
    if (re.test(msg)) return typ;
  }
  return null;
}

// ── 2. Situations-Modifier ───────────────────────────────────────────────
function _detectModifiers(msg) {
  const m = msg.toLowerCase();
  return {
    student:      /student|studier|studium|uni|hochschule|bachelor|master|promotion|doktor/.test(m),
    azubi:        /azubi|auszubildende|ausbildung|berufsschule|lehrling|duales studium/.test(m),
    teilzeit:     /teilzeit|part.?time|halbtags|stundenweise|reduziert/.test(m),
    minijob:      /minijob|geringfügig|538|520|450/.test(m),
    beamter:      /beamt|verbeamt|beamtenstatus/.test(m),
    rentner:      /rentner|rente|rentenalter|im ruhestand|pensio/.test(m),
    selbstaendig: /selbst[äa]ndig|freiberufler|freelance|gewerblich|unternehmer/.test(m),
    verheiratet:  /verheiratet|ehe[fg]att|heirat|zusammenveranlag|joint/.test(m),
    alleinerziehend: /alleinerziehend|single parent|allein erzieh/.test(m),
    kinder:       /kind|kinder|sohn|tochter|nachwuchs/.test(m),
    neu_job:      /(erst|nur|seit).{0,20}(monat|woche|jahr).{0,20}(im job|beschäftigt|angestellt|im unternehmen|beim arbeitgeber|in der firma)/.test(m)
      || /(angefangen|begonnen|gestartet).{0,20}(arbeit|job|stelle)/.test(m),
    kurz_beschaeftigt: /nur (ein|zwei|drei|1|2|3|4|5|6).{0,5}(monat|woche)/.test(m),
    wfh_nur_teil: /nur (manchmal|ab und zu|gelegentlich|selten|1|2|3|einen tag) (homeoffice|von zuhause|remote)/.test(m),
  };
}

// ── 3. Konzept-Erkennungs-Muster ─────────────────────────────────────────
const _KONZEPT_PATTERNS = [
  // Abschreibung / AfA
  { key: "afa",             re: /afa|absetz.{0,10}abnutzung|abschreib|abschreibung|nutzungsdauer|lineare.*abschreib|degressive.*abschreib/ },
  { key: "gwg",             re: /gwg|geringwert|800.?euro.{0,15}(grenze|limit|abschreib|sofort)|sofort.{0,10}abschreib|sofortabschreib/ },
  // Grundbegriffe
  { key: "grenzsteuersatz", re: /grenzsteuersatz|grenz.?steuersatz|marginaler steuersatz|letzter euro|nächster euro.{0,20}steuer/ },
  { key: "effektivsteuersatz", re: /effektiv.{0,10}steuersatz|durchschnittssteuersatz|durchschnittlicher steuersatz|real.{0,10}steuersatz/ },
  { key: "progression",    re: /progression|progressive.{0,10}steuer|steuerprogression|je mehr.{0,20}desto mehr.{0,20}steuer|steuersatz.{0,20}steigt/ },
  { key: "zuflussprinzip", re: /zuflussprinzip|zufluss.{0,10}prinzip|wann.{0,20}zu versteuern|wann.{0,20}steuer.{0,20}fällig|wann gilt|in welchem jahr.{0,20}steuer/ },
  { key: "pauschale_vs_real", re: /pauschale.{0,20}(vs|versus|oder|gegen).{0,20}(tatsächlich|real|nachweis|beleg)|was (bedeutet|ist|heißt).{0,20}pauschale|über.{0,10}pauschale|unter.{0,10}pauschale|pauschale überschreiten|pauschale unterschreiten|mehr als die pauschale|weniger als die pauschale/ },
  // Freibeträge
  { key: "grundfreibetrag_konzept", re: /grundfreibetrag|was ist steuerfrei|bis wann keine steuer|ab wann (zahle ich|muss ich).{0,20}steuer|steuerfreier betrag|existenzminimum/ },
  { key: "sparer_pauschbetrag_konzept", re: /sparer.?pauschbetrag|sparer.?freibetrag|kapital.{0,15}freibetrag|1000.?euro.{0,15}kapital|2000.?euro.{0,15}kapital/ },
  { key: "arbeitnehmer_pauschbetrag_konzept", re: /arbeitnehmer.?pausch(betrag|ale)|werbungskosten.{0,15}pausch|1230.?euro|automatisch.{0,20}werbungskosten|standard.{0,15}werbungskosten/ },
  // Pendeln
  { key: "pendlerpauschale_konzept", re: /pendlerpauschale.{0,20}(wie|was|gilt|funktioniert|berechnet|bedeutet)|was (ist|bedeutet) pendlerpauschale|entfernungspauschale.{0,20}(wie|was)/ },
  // Kapital
  { key: "abgeltungsteuer_konzept", re: /abgeltung(steuer|steur)|kapitalertrag.{0,20}(steuersatz|wie viel|was zahle|prozent)|25.{0,10}%.{0,20}kapital|flat.?tax|kapital.{0,20}pauschal.{0,20}versteuert/ },
  { key: "freistellungsauftrag_konzept", re: /freistellungsauftrag|fsa|freistellung.{0,15}(einrichten|stellen|erteilen|bank)|kapital.{0,15}steuerfrei|bank.{0,15}freistellen/ },
  { key: "verlustverrechnung_konzept", re: /verlustverrechnung.{0,20}(wie|was|funktioniert)|verlust.{0,10}topf|töpfe.{0,10}verlust|verluste.{0,20}verrechnen.{0,20}(wie|was|geht)/ },
  { key: "spekulationsfrist_konzept", re: /spekulationsfrist|1.?jahr.{0,20}aktien.{0,20}steuerfrei|ein.?jährige.{0,10}frist|nach einem jahr.{0,20}steuer|jahresfrist.{0,20}aktien|wann sind aktien steuerfrei/ },
  { key: "teilfreistellung_konzept", re: /teilfreistellung|etf.{0,20}(steuer|versteuert|wie viel)|30.?%.{0,20}(etf|fonds)|fondssteuer|wie wird etf.{0,20}versteuert/ },
  { key: "vorabpauschale_konzept", re: /vorabpauschale|vorab.?pauschale|thesaurierend.{0,20}steuer|ausschüttungsgleich|basiszins.{0,20}etf/ },
  { key: "guenstiger_pruefung_konzept", re: /günstigerprüfung.{0,20}(was|wie|wann)|günstigerwahlrecht.{0,20}(was|wie)|kapital.{0,20}persönlichem steuersatz|persönlicher satz.{0,20}kapital|niedriger.{0,20}steuersatz.{0,20}kapital/ },
  // Altersvorsorge
  { key: "ruerup_konzept", re: /rürup.{0,20}(wie|was|für wen|lohnt|funktioniert|mechanismus)|was ist rürup|basisrente.{0,20}(wie|was)/ },
  { key: "riester_konzept", re: /riester.{0,20}(wie|was|funktioniert|lohnt|mechanismus|zulage)|was ist riester|riester.{0,20}förderung.{0,20}(wie|was)/ },
  { key: "bav_konzept", re: /bav.{0,20}(wie|was|funktioniert)|betriebliche altersvorsorge.{0,20}(wie|was|funktioniert)|entgeltumwandlung.{0,20}(wie|was)|§\s*3.{0,5}nr.{0,5}63.{0,20}(wie|was)/ },
  // Außergew. Belastungen
  { key: "zumutbare_eigenbelastung", re: /zumutbare.{0,10}eigenbelastung|eigenbelastung.{0,20}(was|wie|wie viel|bedeutet)|selbstbehalt.{0,20}§.?33|warum (bekomme|kriege) ich nicht alles (erstattet|anerkannt).{0,20}arzt/ },
  { key: "behinderten_pauschbetrag_konzept", re: /behinderten.?pauschbetrag.{0,20}(wie hoch|wie viel|was|wie)|gdb.{0,20}(pauschbetrag|steuer|wie viel)|schwerbehinderung.{0,20}(pauschbetrag|steuer|wie viel)/ },
  // §35a
  { key: "haushaltsnahe_konzept", re: /§.?35a|haushaltsnahe.{0,20}(was ist|wie|dienstleistungen.*was|systematik|wie funktioniert)|handwerker.{0,20}steuer.{0,20}(wie|was)|(putzhilfe|reinigung|gartenarbeit).{0,20}(wie|was).{0,20}steuer/ },
  // Sonderausgaben
  { key: "sonderausgaben_konzept", re: /sonderausgaben.{0,20}(was (sind|zählt|gehört|ist)|wie|systematik|unterschied zu werbungskosten)|unterschied.{0,20}(werbungskosten|sonderausgaben).{0,20}(sonderausgaben|werbungskosten)/ },
  { key: "vorsorgeaufwendungen_konzept", re: /vorsorgeaufwendungen.{0,20}(was|wie)|krankenversicherung.{0,20}(absetzen|wie|was)|kv.{0,20}(steuer|absetzen)|pflichtbeiträge.{0,20}(steuer|absetzen)/ },
  // Studentenstatus
  { key: "student_steuer_konzept", re: /(student|studier).{0,30}(steuer|erststudium|zweitstudium|absetzen|werbungskosten|sonderausgaben)|erststudium.{0,20}(steuer|absetzen|warum nicht)|studiumskosten.{0,20}(steuer|wie)/ },
  { key: "azubi_steuer_konzept", re: /(azubi|auszubildende|ausbildung).{0,30}(steuer|absetzen|werbungskosten|wie viel)/ },
  // Sonstige wichtige Konzepte
  { key: "progressionsvorbehalt", re: /progressionsvorbehalt|kurzarbeit.{0,20}steuer|elterngeld.{0,20}steuer|krankengeld.{0,20}steuer|warum.{0,20}(kurzarbeit|elterngeld|krankengeld).{0,20}(steuer|erhöht|mehr steuer)/ },
  { key: "fuenftelregelung", re: /fünftelregel(ung)?|abfindung.{0,20}(steuer|wie|wie viel|berechnet)|außerordentliche einkünfte.{0,20}(steuer|wie)/ },
  { key: "zusammenveranlagung_konzept", re: /zusammenveranlag.{0,20}(was|wie|lohnt|vorteil)|ehegattensplitting.{0,20}(was|wie|lohnt)|splitting(vorteil|tarif).{0,20}(was|wie)|gemeinsam.{0,20}veranlag.{0,20}(was|wie|lohnt)/ },
  { key: "steuerklassen_konzept", re: /steuerklasse.{0,20}(was bedeutet|wie funktioniert|was ist|erkläre|was sind die unterschiede|welche gibt es)|welche steuerklasse.{0,20}(gibt es|existieren|bedeuten)/ },
  { key: "steuerklasse_verheiratet", re: /steuerklasse.{0,20}(verheiratet|ehe|heirat|3.{0,3}5|4.{0,3}4|faktorverfahren)|verheiratet.{0,20}(welche steuerklasse|steuerklassenkombination|3\/5|4\/4)|(3.{0,3}5|4.{0,3}4).{0,20}steuerklasse.{0,20}(verheiratet|was (ist|bedeutet) besser)/ },
  { key: "verlustvortrag_konzept", re: /verlustvortrag.{0,20}(was|wie|funktioniert)|verluste.{0,20}(vortragen|ins nächste jahr|in folgejahre|mehrere jahre).{0,20}(wie|was)|negative einkünfte.{0,20}(wie|was)/ },
  { key: "festsetzungsverjaehrung_konzept", re: /festsetzungsverjährig|4.{0,5}jahre.{0,20}(rückwirkend|nachreichen|steuer)|wie weit.{0,20}rückwirkend|wie viele jahre.{0,20}(nachreichen|abgeben)/ },
  { key: "einspruch_konzept", re: /einspruch.{0,20}(wie|was|frist|wann|gegen|einlegen)|widerspruch.{0,20}steuerbescheid|bescheid.{0,20}(anfechten|anzweifeln|nicht einverstanden|falsch)/ },
  { key: "vorlaeufiger_bescheid", re: /vorläufig.{0,10}bescheid|bescheid.{0,20}vorläufig|was bedeutet vorläufig.{0,20}bescheid/ },
  { key: "kinderfreibetrag_konzept", re: /kinderfreibetrag.{0,20}(vs|versus|oder|gegen|was ist besser).{0,20}kindergeld|kindergeld.{0,20}(vs|versus|oder|gegen|was ist besser).{0,20}kinderfreibetrag|günstigerprüfung.{0,20}kind/ },
  { key: "ubungsleiter_freibetrag_konzept", re: /übungsleiter(freibetrag|pauschale)?|§.?3.{0,5}nr.{0,5}26|sporttrainer.{0,20}steuer|trainer.{0,20}steuerfrei|ehrenamt.{0,20}vergütung.{0,20}steuer/ },
  { key: "inflationsausgleich_konzept", re: /inflationsausgleich(sprämie)?|3000.?euro.{0,20}(steuerfrei|arbeitgeber|prämie)|steuerfreie.{0,20}prämie.{0,20}arbeitgeber/ },
  { key: "dienstwagen_konzept", re: /dienstwagen.{0,20}(steuer|wie|1%.{0,5}regel|fahrtenbuch|was)|1%.{0,5}regel.{0,20}dienstwagen|firmenwagen.{0,20}(steuer|versteuern|wie)/ },
  { key: "doppelte_hh_konzept", re: /doppelte.{0,5}haushalt.{0,20}(voraussetzung|wann|was|wie)|zweitwohnung.{0,20}(absetzen|steuer|voraussetzung|was)|zweiter wohnsitz.{0,20}(beruf|arbeit|absetzen|was)/ },
  { key: "verpflegungsmehraufwand_konzept", re: /verpflegungsmehraufwand.{0,20}(was|wie|wann)|vma|auswärtstätigkeit.{0,20}(essen|verpflegung|kosten|was)|dienstreise.{0,20}(essen|verpflegung|pauschale|was)/ },
  { key: "photovoltaik_konzept", re: /photovoltaik.{0,20}(steuer|versteuern|steuerfrei|was|wie)|pv.{0,5}anlage.{0,20}(steuer|was)|einspeisevergütung.{0,20}(steuer|versteuern)/ },
  { key: "minijob_konzept", re: /minijob.{0,20}(was|wie|unterschied|midi|midijob)|geringfügig.{0,20}beschäftigung.{0,20}(was|wie)|538.{0,20}grenze|unterschied.{0,20}(mini|midi).?job/ },
];

function _detectKonzept(msg) {
  const m = msg.toLowerCase();
  for (const { key, re } of _KONZEPT_PATTERNS) {
    if (re.test(m)) return key;
  }
  return null;
}

// ── 4. Wissensdatenbank ──────────────────────────────────────────────────
function _konzeptAntwort(key, ft, mod, p, yr, K) {
  const y = yr || new Date().getFullYear();
  const gfb = K?.grundfreibetrag || 12096;
  const wkp = K?.wk_pauschale || 1230;
  const spb = K?.sparer_pauschbetrag || 1000;
  const hoT = K?.homeoffice_pro_tag || 6;
  const hoM = K?.homeoffice_max_tage || 210;
  const T = _TAG;
  const follow = (tips) => `

💬 *Frag mich auch:* ${tips.map(t => `*"${t}"*`).join(" · ")}`;

  // Situations-Präfix
  const sfx = [];
  if (mod.student) sfx.push("Student");
  if (mod.azubi) sfx.push("Azubi");
  if (mod.teilzeit) sfx.push("Teilzeit");
  if (mod.rentner) sfx.push("Rentner");
  if (mod.selbstaendig) sfx.push("Selbständig");
  if (mod.verheiratet) sfx.push("Verheiratet");
  const situationsHinweis = sfx.length ? `

👤 *Kontext erkannt: ${sfx.join(", ")} — ich beziehe das ein.*` : "";

  switch (key) {

    // ── AfA ──────────────────────────────────────────────────────────────
    case "afa": {
      let r = `**AfA — Absetzung für Abnutzung** (§ 7 EStG)${situationsHinweis}

`;
      r += `AfA bedeutet: Wenn du etwas kaufst das mehrere Jahre genutzt wird (Laptop, Schreibtisch, Kamera), darfst du nicht den vollen Kaufpreis auf einmal absetzen — sondern verteilst ihn auf die steuerliche Nutzungsdauer.

`;
      r += `**Wie es funktioniert:**
`;
      r += `Die Finanzverwaltung hat für fast alles eine fixe Nutzungsdauer festgelegt (AfA-Tabelle):
`;
      r += `- Laptop / PC: **3 Jahre** → 1/3 pro Jahr
`;
      r += `- Smartphone: **3 Jahre**
`;
      r += `- Schreibtisch / Bürostuhl: **13 Jahre**
`;
      r += `- Bücherschrank: **15 Jahre**

`;
      r += `**Beispiel:** Laptop für 1.500 € → 500 € AfA pro Jahr × 3 Jahre

`;
      if (mod.student || mod.azubi) {
        r += `**Als ${mod.student ? "Student" : "Azubi"}:** Die AfA-Regeln gelten genauso für dich — wenn du das Gerät für Studium/Ausbildung nutzt. Bei Erststudium zählt das als Sonderausgaben (max. 6.000 €/Jahr), bei Zweitstudium/zweiter Ausbildung als Werbungskosten (unbegrenzt).

`;
      }
      r += `**Sonderfall GWG (Sofortabschreibung):** Kostet das Gerät ≤ **800 € netto** (≤ 952 € brutto), kannst du es komplett im Kaufjahr absetzen — keine Verteilung nötig.

`;
      r += `**Wann lohnt AfA vs. Sofortabschreibung?**
`;
      r += `- Unter 800 € netto → immer Sofortabschreibung wählen
`;
      r += `- Über 800 € netto → AfA über Nutzungsdauer
`;
      r += `- Bei Kauf im Dezember: erstes Jahr nur anteilig (1/12 pro Monat ab Kauf)`;
      r += follow(["Was ist die GWG-Grenze?", "Laptop absetzen", "Büroausstattung absetzen"]);
      return r + T;
    }

    // ── GWG ──────────────────────────────────────────────────────────────
    case "gwg": {
      let r = `**GWG — Geringwertige Wirtschaftsgüter** (§ 6 Abs. 2 EStG)${situationsHinweis}

`;
      r += `GWG-Grenze: **800 € netto** (= 952 € brutto inkl. 19% MwSt).

`;
      r += `**Was das bedeutet:** Kaufst du ein Arbeitsmittel, das selbständig nutzbar ist und unter 800 € netto kostet, darfst du es **sofort und vollständig** im Kaufjahr als Werbungskosten absetzen — keine Aufteilung über mehrere Jahre.

`;
      r += `**Beispiele unter GWG-Grenze (sofort absetzbar):**
`;
      r += `- Maus, Tastatur, Headset, Monitor-Arm: i.d.R. unter 800 € → sofort
`;
      r += `- Günstiger Drucker, Webcam, Mikrofon → sofort

`;
      r += `**Beispiele über GWG-Grenze (AfA nötig):**
`;
      r += `- Laptop 1.200 € netto → AfA über 3 Jahre = 400 €/Jahr
`;
      r += `- Ergonomischer Bürostuhl 900 € netto → AfA über 13 Jahre

`;
      r += `**Wichtig:** Die 800 €-Grenze gilt pro Artikel einzeln — nicht für den Warenkorb gesamt. Kaufst du Maus (50 €) + Tastatur (80 €) + Monitor (600 €) = 730 € gesamt, aber Monitor-separat 600 € → alles unter 800 € → alles sofort absetzbar.`;
      r += follow(["Was ist AfA?", "Laptop absetzen", "Homeoffice Arbeitszimmer absetzen"]);
      return r + T;
    }

    // ── Grenzsteuersatz ──────────────────────────────────────────────────
    case "grenzsteuersatz": {
      let r = `**Grenzsteuersatz — was bedeutet das?**${situationsHinweis}

`;
      r += `Der Grenzsteuersatz ist der Steuersatz, der auf **den letzten verdienten Euro** anfällt — also wie viel Prozent du vom nächsten zusätzlichen Euro abgeben musst.

`;
      r += `**Warum ist das wichtig?**
Weil er zeigt, wie viel jeder abgesetzte Euro dir konkret spart:
`;
      r += `- Grenzsteuersatz 30 % → 1.000 € Werbungskosten sparen **300 €** Steuern
`;
      r += `- Grenzsteuersatz 42 % → 1.000 € Werbungskosten sparen **420 €** Steuern

`;
      r += `**Grenzsteuersätze ${y} in Deutschland (§ 32a EStG):**
`;
      r += `- Bis ${_fmt(gfb)}: **0 %** (steuerfrei)
`;
      r += `- ${_fmt(gfb + 1)} – ~68.000 €: **14–42 %** (linear steigend)
`;
      r += `- Ab ~68.000 €: **42 %** (Spitzensteuersatz)
`;
      r += `- Ab ~277.000 €: **45 %** (Reichensteuer)

`;
      r += `**Unterschied zum effektiven Steuersatz:** Der Grenzsteuersatz gilt nur für den letzten Euro. Der effektive Steuersatz ist der Durchschnitt über das gesamte Einkommen — immer niedriger als der Grenzsteuersatz.`;
      if (p.gst) r += `

📊 *Dein aktueller Grenzsteuersatz: ca. **${p.gst} %***`;
      r += follow(["Effektiver vs. Grenzsteuersatz", "Was spart mir Rürup?", "Werbungskosten berechnen"]);
      return r + T;
    }

    // ── Effektiver Steuersatz ─────────────────────────────────────────────
    case "effektivsteuersatz": {
      let r = `**Effektiver Steuersatz vs. Grenzsteuersatz**${situationsHinweis}

`;
      r += `**Effektiver Steuersatz** = Gesamte Steuerlast ÷ Gesamtes Einkommen
Der Durchschnitt über alles — was du wirklich zahlst.

`;
      r += `**Grenzsteuersatz** = Steuersatz auf den letzten Euro
Wichtig für: "Was bringt mir ein Abzug?"

`;
      r += `**Beispiel bei 50.000 € Brutto:**
`;
      r += `- Du zahlst z.B. 10.500 € Einkommensteuer
`;
      r += `- Effektiver Steuersatz: 10.500 ÷ 50.000 = **21 %**
`;
      r += `- Grenzsteuersatz: **~38 %** (der auf dein oberstes Einkommens-Segment)

`;
      r += `**Merksatz:** Effektiv = was du zahlst · Grenz = was du sparst wenn du absetzt`;
      if (p.gst) r += `

📊 *Dein geschätzter Grenzsteuersatz: ~${p.gst} %*`;
      r += follow(["Was ist der Grenzsteuersatz?", "Brutto Netto berechnen"]);
      return r + T;
    }

    // ── Steuerprogression ─────────────────────────────────────────────────
    case "progression": {
      let r = `**Progressive Besteuerung — wie funktioniert das?**

`;
      r += `In Deutschland gilt: **Je mehr du verdienst, desto höher der Steuersatz auf den nächsten Euro.** Aber: Höhere Sätze gelten NUR für den Teil über der jeweiligen Grenze — nicht rückwirkend für alles.

`;
      r += `**Schematisch ${y}:**
`;
      r += `- 0 – ${_fmt(gfb)}: **0 %** (Grundfreibetrag, steuerfrei)
`;
      r += `- Darüber bis ~68.000 €: Steuersatz steigt von **14 % auf 42 %**
`;
      r += `- Ab ~68.000 €: konstant **42 %** (Spitzensteuersatz)

`;
      r += `**Missverständnis:** Wenn du 70.000 € verdienst, zahlst du NICHT 42 % auf alles — nur auf den Teil über ~68.000 €. Auf die erste Tranche zahlst du 0–14 %, auf die mittlere mehr, auf die obere 42 %.

`;
      r += `**Deshalb:** Werbungskosten und Abzüge wirken am meisten für Gutverdiener — weil sie die oberste Tranche reduzieren.`;
      r += follow(["Was ist der Grenzsteuersatz?", "Effektiver Steuersatz", "Was kann ich absetzen?"]);
      return r + T;
    }

    // ── Zuflussprinzip ────────────────────────────────────────────────────
    case "zuflussprinzip": {
      let r = `**Zuflussprinzip — wann muss ich etwas versteuern?** (§ 11 EStG)

`;
      r += `**Grundregel:** Einnahmen werden in dem Jahr versteuert, in dem sie dir tatsächlich **zugeflossen** sind — egal wann du die Leistung erbracht hast.

`;
      r += `**Beispiele:**
`;
      r += `- Dezember-Gehalt kommt am 2. Januar → gehört zum **neuen Jahr**
`;
      r += `- Freelance-Rechnung aus November, Zahlung im Februar → **Februar-Jahr**
`;
      r += `- Dividende gutgeschrieben am 31.12. → **dieses Jahr**

`;
      r += `**Ausgaben-Seite:** Umgekehrt gilt das Abflussprinzip — Ausgaben zählen im Jahr der Zahlung, nicht der Leistungserbringung.

`;
      r += `**Ausnahme:** Regelmäßig wiederkehrende Zahlungen nahe dem Jahreswechsel (±10 Tage) gelten noch als „wirtschaftlich zugehörig" zum Vorjahr.`;
      r += follow(["Steuer für welches Jahr?", "Freelancer Steuern", "Muss ich Steuern nachzahlen?"]);
      return r + T;
    }

    // ── Pauschale vs. tatsächliche Kosten ─────────────────────────────────
    case "pauschale_vs_real": {
      let r = `**Pauschale vs. tatsächliche Kosten — was bedeutet das?**

`;
      r += `Beim Finanzamt kannst du oft wählen: entweder die **Pauschale** (fester Betrag, kein Nachweis nötig) oder deine **tatsächlichen Kosten** (mit Belegen).

`;
      r += `**Wenn du UNTER der Pauschale liegst:**
Du bekommst trotzdem den Pauschal-Betrag. Die Pauschale ist ein garantiertes Minimum — sie wird automatisch angesetzt, auch wenn deine echten Kosten niedriger sind.

`;
      r += `**Wenn du ÜBER der Pauschale liegst:**
Du kannst deine tatsächlichen Kosten geltend machen — aber du musst jeden Euro belegen können (Quittungen, Kontoauszüge). Das lohnt sich wenn deine echten Kosten deutlich höher sind.

`;
      r += `**Wichtigste Pauschalen ${y}:**
`;
      r += `| Pauschale | Betrag |
|---|---|
`;
      r += `| Arbeitnehmer-Pauschbetrag (WK) | **${_fmt(wkp)}/Jahr** |
`;
      r += `| Sparer-Pauschbetrag | **${_fmt(spb)}/Jahr** (${_fmt(spb*2)} verheiratet) |
`;
      r += `| Homeoffice-Pauschale | **${hoT} €/Tag**, max. ${_fmt(hoT * hoM)}/Jahr |
`;
      r += `| Pendlerpauschale | **0,30–0,38 €/km** je Weg |

`;
      r += `**Fazit:** Immer erst prüfen ob tatsächliche Kosten die Pauschale übersteigen — nur dann Belege sammeln. Darunter → Pauschale nehmen.`;
      r += follow(["Werbungskosten berechnen", "Homeoffice berechnen", "Pendlerpauschale berechnen"]);
      return r + T;
    }

    // ── Grundfreibetrag ───────────────────────────────────────────────────
    case "grundfreibetrag_konzept": {
      let r = `**Grundfreibetrag ${y}** (§ 32a EStG)

`;
      r += `Der Grundfreibetrag ist das steuerfreie Existenzminimum — auf Einkommen bis zu diesem Betrag zahlst du **null Einkommensteuer**.

`;
      r += `**${y}: ${_fmt(gfb)}** (Ledige) · **${_fmt(gfb * 2)}** (Verheiratete, Zusammenveranlagung)

`;
      r += `**Was zählt als Einkommen?** Nicht das Brutto, sondern das **zu versteuernde Einkommen** — also nach Abzug von Werbungskosten, Sonderausgaben, außergewöhnlichen Belastungen etc.

`;
      if (mod.student || mod.azubi) {
        r += `**Als ${mod.student ? "Student" : "Azubi"}:** Wenn du nur wenig verdienst und unter dem Grundfreibetrag bleibst, zahlst du keine Einkommensteuer. Trotzdem lohnt sich eine Steuererklärung — eventuell wurde zu viel Lohnsteuer einbehalten.

`;
      }
      if (mod.rentner) {
        r += `**Als Rentner:** Nur der **Besteuerungsanteil** deiner Rente zählt, nicht die volle Rente. ${y}: mind. 83 % Besteuerungsanteil für Neurentner. Liegt dieser Anteil unter dem Grundfreibetrag → keine Steuer.

`;
      }
      r += `**Entwicklung:** Der Grundfreibetrag wird jährlich angepasst (Inflationsausgleich).`;
      r += follow(["Muss ich Steuern zahlen?", "Was ist der Grenzsteuersatz?", "Brutto Netto berechnen"]);
      return r + T;
    }

    // ── Sparer-Pauschbetrag ───────────────────────────────────────────────
    case "sparer_pauschbetrag_konzept": {
      let r = `**Sparer-Pauschbetrag ${y}** (§ 20 Abs. 9 EStG)

`;
      r += `Kapitalerträge bis **${_fmt(spb)}/Jahr** (Ledige) bzw. **${_fmt(spb * 2)}/Jahr** (Verheiratete) sind steuerfrei — kein Nachweis nötig.

`;
      r += `**Was zählt dazu:** Dividenden, Zinsen, ETF-Ausschüttungen, realisierte Kursgewinne, Vorabpauschale.

`;
      r += `**Freistellungsauftrag:** Du musst deiner Bank einen Freistellungsauftrag erteilen — sonst zieht sie Kapitalertragsteuer ab, und du musst dir das Geld über die Steuererklärung zurückholen.

`;
      r += `**Mehrere Banken:** Teile den Freibetrag auf! Z.B. 600 € bei Bank A, 400 € bei Bank B. Gesamt darf ${_fmt(spb)} nicht übersteigen.

`;
      r += `**Was passiert darüber?** Auf alles über dem Freibetrag gilt die Abgeltungsteuer: 25 % + Soli (+ ggf. Kirchensteuer).`;
      r += follow(["Was ist Abgeltungsteuer?", "Freistellungsauftrag einrichten", "Günstigerprüfung Kapital"]);
      return r + T;
    }

    // ── Arbeitnehmer-Pauschbetrag ─────────────────────────────────────────
    case "arbeitnehmer_pauschbetrag_konzept": {
      let r = `**Arbeitnehmer-Pauschbetrag ${y}** (§ 9a EStG)

`;
      r += `**${_fmt(wkp)}/Jahr** — wird automatisch vom Finanzamt bei jedem Arbeitnehmer angesetzt, ohne dass du einen einzigen Beleg vorlegen musst.

`;
      r += `**Was das bedeutet:** Dein zu versteuerndes Einkommen wird automatisch um ${_fmt(wkp)} reduziert. Das entspricht etwa ${Math.round(wkp/12)}-€-Werbungskosten pro Monat "geschenkt".

`;
      r += `**Wann lohnt es sich mehr?** Wenn deine tatsächlichen Werbungskosten (Pendeln + Homeoffice + Arbeitsmittel + Fortbildung...) **über ${_fmt(wkp)}** liegen — dann zahlt sich Einzelnachweis aus.

`;
      r += `**Typische Schwelle:** Bei ~20 km Arbeitsweg täglich bist du oft schon bei oder über der Pauschale.

`;
      if (mod.student || mod.azubi) {
        r += `**Als ${mod.student ? "Student" : "Azubi"}:** Der Arbeitnehmer-Pauschbetrag gilt nur für Einkünfte aus nicht-selbständiger Arbeit (Lohn/Gehalt). Für Studiumskosten gelten andere Regelungen.`;
      }
      r += follow(["Werbungskosten berechnen", "Pendlerpauschale berechnen", "Homeoffice berechnen"]);
      return r + T;
    }

    // ── Pendlerpauschale Konzept ──────────────────────────────────────────
    case "pendlerpauschale_konzept": {
      let r = `**Pendlerpauschale — Konzept & Mechanismus** (§ 9 Abs. 1 Nr. 4 EStG)${situationsHinweis}

`;
      r += `Die Pendlerpauschale (offiziell: Entfernungspauschale) entschädigt dich pauschal für den Weg zur Arbeit — unabhängig vom tatsächlichen Verkehrsmittel (Auto, Bahn, Fahrrad, zu Fuß).

`;
      r += `**Wie berechnet:** Einfache Entfernung (km) × Arbeitstage × Satz:
`;
      r += `- Km 1–20: **0,30 €/km** pro Arbeitstag
`;
      r += `- Ab km 21: **0,38 €/km** pro Arbeitstag

`;
      r += `**Wichtig: Einfache Strecke!** Du fährst 30 km hin → du setzt 30 km an — nicht 60 km (kein Hin- und Rückweg).

`;
      if (mod.kurz_beschaeftigt || mod.neu_job) {
        r += `**Bei kurzer Beschäftigung / neuer Stelle:** Kein Mindest-Zeitraum nötig! Du setzt die Pauschale anteilig für die tatsächlichen Arbeitstage an. 3 Monate gearbeitet = ~60 Tage × deine km-Zahl.

`;
      }
      if (mod.teilzeit) {
        r += `**Bei Teilzeit:** Gilt genauso — nur für die Tage, an denen du tatsächlich ins Büro gefahren bist.

`;
      }
      r += `**Über oder unter Pauschale?** Die Entfernungspauschale ist eine Werbungskosten-Pauschale — du kannst nicht wählen. Sie gilt immer, auch wenn deine echten Kosten höher sind (Ausnahme: PKW bei extremer Entfernung).

`;
      r += `**Homeoffice & Pendeln:** An Homeoffice-Tagen gibt es keine Pendlerpauschale für diese Tage — dafür die Homeoffice-Pauschale (${hoT} €/Tag).`;
      r += follow(["Pendlerpauschale berechnen", "Homeoffice berechnen", "Was sind Werbungskosten?"]);
      return r + T;
    }

    // ── Abgeltungsteuer ───────────────────────────────────────────────────
    case "abgeltungsteuer_konzept": {
      let r = `**Abgeltungsteuer — wie funktioniert das?** (§ 32d EStG)

`;
      r += `Auf Kapitalerträge (Zinsen, Dividenden, Kursgewinne) gilt ein **pauschaler Satz von 25 %** — plus 5,5 % Soli darauf (= 1,375 %) — gesamt also **26,375 %** (ohne Kirchensteuer).

`;
      r += `**"Abgeltend" bedeutet:** Die Steuer ist damit abgegolten — du musst Kapitalerträge normalerweise nicht mehr in der Steuererklärung angeben. Die Bank führt sie direkt ab.

`;
      r += `**Sparer-Pauschbetrag:** ${_fmt(spb)}/Jahr (Ledige) bleiben steuerfrei → erst darüber fällt die 25 % an.

`;
      r += `**Ausnahme — Günstigerprüfung:** Ist dein persönlicher Steuersatz **unter 25 %** (z.B. du verdienst wenig), kannst du beantragen, dass Kapitalerträge mit dem normalen Einkommensteuersatz besteuert werden. Das Finanzamt wählt automatisch die günstigere Variante.

`;
      r += `**Verlustverrechnung:** Verluste aus Kapitalanlagen können nur mit Kapitalerträgen verrechnet werden — nicht mit Arbeitslohn oder anderen Einkunftsarten.`;
      r += follow(["Freistellungsauftrag einrichten", "Günstigerprüfung", "ETF Steuer", "Verluste verrechnen"]);
      return r + T;
    }

    // ── Freistellungsauftrag ──────────────────────────────────────────────
    case "freistellungsauftrag_konzept": {
      let r = `**Freistellungsauftrag — was ist das und wie einrichten?**

`;
      r += `Der Freistellungsauftrag (FSA) teilt deiner Bank mit, wie viel von deinem Sparer-Pauschbetrag (${_fmt(spb)}/Jahr) sie dir gutschreiben soll, ohne Abgeltungsteuer einzubehalten.

`;
      r += `**Ohne FSA:** Die Bank zieht automatisch 26,375 % Abgeltungsteuer + Soli ab — du musst dir das Geld über die Steuererklärung zurückholen.

`;
      r += `**Mit FSA:** Die Bank führt bis zum Freibetrag keine Steuer ab — du sparst dir die Steuererklärung für Kapitalerträge.

`;
      r += `**Mehrere Banken:** Du kannst den FSA aufteilen — z.B. 600 € bei Comdirect, 400 € bei ING. Gesamt darf ${_fmt(spb)} nicht überschreiten (Verheiratete: ${_fmt(spb * 2)}).

`;
      r += `**Einrichten:** Online im Banking-Portal der Bank → "Freistellungsauftrag" → Betrag eingeben. Läuft meist unbefristet bis zum Widerruf.

`;
      r += `**NV-Bescheinigung:** Alternativ für sehr geringes Einkommen (unter Grundfreibetrag): NV-Bescheinigung vom Finanzamt → Bank führt gar keine Steuer ab.`;
      r += follow(["Was ist der Sparer-Pauschbetrag?", "Was ist Abgeltungsteuer?", "ETF Steuer"]);
      return r + T;
    }

    // ── Verlustverrechnung Kapital ────────────────────────────────────────
    case "verlustverrechnung_konzept": {
      let r = `**Verlustverrechnung bei Kapitalanlagen — wie funktioniert das?**

`;
      r += `Das Finanzamt nutzt ein **Topf-System** für Kapitalverluste:

`;
      r += `**Topf 1 — Allgemeiner Verlustverrechnungstopf:**
Aktiengewinne, Fondsgewinne, Zinsen, Dividenden — alle verrechenbar miteinander.

`;
      r += `**Topf 2 — Aktien-Verlustverrechnungstopf:**
Aktienverluste dürfen NUR mit Aktiengewinnen verrechnet werden — nicht mit Dividenden oder Zinsen!

`;
      r += `**Beispiel:**
`;
      r += `- Aktie A: +2.000 € Gewinn
`;
      r += `- Aktie B: -1.500 € Verlust
`;
      r += `- Zu versteuern: nur 500 € → Steuer auf 500 €

`;
      r += `**Verlusttopf-Übertrag:** Nicht verrechnete Verluste werden automatisch ins Folgejahr übertragen (Verlustvortrag).

`;
      r += `**Verlustbescheinigung:** Willst du Verluste von Bank A mit Gewinnen bei Bank B verrechnen → bis 15. Dezember bei Bank A "Verlustbescheinigung" beantragen → in der Steuererklärung angeben.`;
      r += follow(["ETF Steuer", "Abgeltungsteuer", "Kapitalerträge versteuern"]);
      return r + T;
    }

    // ── Spekulationsfrist ─────────────────────────────────────────────────
    case "spekulationsfrist_konzept": {
      let r = `**Spekulationsfrist bei Aktien & ETFs** (§ 23 EStG)

`;
      r += `⚠️ **Wichtig:** Für Aktien & ETFs gilt in Deutschland **keine** einjährige Steuerfreiheit mehr — das ist ein häufiges Missverständnis!

`;
      r += `**Aktien, ETFs, Fonds:** Kursgewinne sind **immer** steuerpflichtig (Abgeltungsteuer 25 %), egal wie lange du gehalten hast. Die frühere 1-Jahres-Regel gilt nur noch für alte Bestände vor 2009.

`;
      r += `**Wann gibt es noch eine Spekulationsfrist?**
`;
      r += `- **Immobilien (§ 23 EStG):** Verkauf innerhalb von **10 Jahren** nach Kauf → Gewinn steuerpflichtig. Nach 10 Jahren → steuerfrei.
`;
      r += `- **Ausnahme:** Eigengenutzte Immobilien (mindestens 2 Kalenderjahre + Verkaufsjahr selbst bewohnt) → steuerfrei.
`;
      r += `- **Kryptowährungen:** Ebenfalls 1-Jahres-Haltefrist (seit 2025 umstritten, aktuelle Rechtslage prüfen).

`;
      r += `**Fazit:** Bei Aktien & ETFs gibt es keine Haltefrist-Steuerfreiheit. Der Sparer-Pauschbetrag (${_fmt(spb)}) ist dein einziger Freibetrag.`;
      r += follow(["Abgeltungsteuer", "ETF Steuer", "Freistellungsauftrag"]);
      return r + T;
    }

    // ── Teilfreistellung ETF ──────────────────────────────────────────────
    case "teilfreistellung_konzept": {
      let r = `**Teilfreistellung bei ETFs & Fonds** (§ 20 InvStG)

`;
      r += `ETFs genießen eine **Teilfreistellung** — ein Teil der Erträge ist pauschal steuerfrei:

`;
      r += `| Fondstyp | Teilfreistellung | Steuerpflichtig |
|---|---|---|
`;
      r += `| Aktienfonds (>= 51% Aktien) | **30 %** steuerfrei | 70 % wird versteuert |
`;
      r += `| Mischfonds (25–50% Aktien) | **15 %** steuerfrei | 85 % wird versteuert |
`;
      r += `| Immobilienfonds (inl.) | **60 %** steuerfrei | 40 % wird versteuert |
`;
      r += `| Anleihenfonds | **0 %** | 100 % steuerpflichtig |

`;
      r += `**Praktische Bedeutung:** Von 1.000 € Gewinn eines Aktien-ETFs werden nur 700 € mit 25 % versteuert → effektive Steuer: 175 € statt 250 €.

`;
      r += `**Vorabpauschale:** Thesaurierende ETFs (die keine Dividende ausschütten) zahlen jährlich eine fiktive "Vorabpauschale" — auch auf diese gilt die Teilfreistellung.`;
      r += follow(["Was ist die Vorabpauschale?", "Abgeltungsteuer", "Freistellungsauftrag"]);
      return r + T;
    }

    // ── Vorabpauschale ────────────────────────────────────────────────────
    case "vorabpauschale_konzept": {
      let r = `**Vorabpauschale bei ETFs — was ist das?** (§ 18 InvStG)

`;
      r += `Thesaurierende ETFs (die Gewinne nicht ausschütten, sondern reinvestieren) zahlen keine Dividende. Damit kein Steuerstundungseffekt entsteht, berechnet das Finanzamt eine **fiktive Mindestrendite** — die Vorabpauschale.

`;
      r += `**Berechnung:** Basiszins × Fondsvolumen × 70 % × Teilfreistellung

`;
      r += `**Wann fällt sie an?** Nur wenn der ETF in dem Jahr keine oder weniger Ausschüttungen als die Vorabpauschale hatte. Bei einem sehr schwachen Börsenjahr (Basiszins × Volumen > Wertzuwachs) kann sie null sein.

`;
      r += `**Praktisch:** Die Depotbank bucht die Steuer auf die Vorabpauschale Anfang Januar automatisch von deinem Verrechnungskonto ab. Du musst nichts tun — aber du brauchst genug Geld auf dem Verrechnungskonto.

`;
      r += `**Vorteil:** Beim späteren Verkauf wird die gezahlte Vorabpauschale angerechnet — keine Doppelbesteuerung.`;
      r += follow(["ETF Steuer", "Teilfreistellung", "Freistellungsauftrag"]);
      return r + T;
    }

    // ── Günstigerprüfung ──────────────────────────────────────────────────
    case "guenstiger_pruefung_konzept": {
      let r = `**Günstigerprüfung bei Kapitalerträgen — wann lohnt sich das?** (§ 32d Abs. 6 EStG)

`;
      r += `Standardmäßig werden Kapitalerträge mit 25 % Abgeltungsteuer besteuert. Die Günstigerprüfung ermöglicht, stattdessen den **persönlichen Einkommensteuersatz** zu verwenden — wenn der niedriger als 25 % ist.

`;
      r += `**Für wen lohnt sich das?**
`;
      r += `- Studenten, Geringverdiener, Rentner mit niedrigem Einkommen
`;
      r += `- Personen deren persönlicher Grenzsteuersatz **unter 25 %** liegt

`;
      r += `**Wie beantragen?** In der Steuererklärung Anlage KAP, Zeile "Günstigerprüfung beantragen" anhaken. Das Finanzamt prüft dann automatisch, ob die normale Besteuerung oder die Abgeltungsteuer günstiger ist — und wählt das Günstigere.

`;
      r += `**Wichtig:** Auch wenn die Günstigerprüfung keinen Vorteil bringt, entstehen keine Nachteile — das Finanzamt nimmt nie mehr als die 25 %.`;
      if (mod.student) r += `

**Als Student:** Besonders relevant — dein Steuersatz ist oft unter 25 %. Lass die Günstigerprüfung immer beantragen!`;
      r += follow(["Abgeltungsteuer", "Sparer-Pauschbetrag", "Anlage KAP"]);
      return r + T;
    }

    // ── Rürup Konzept ─────────────────────────────────────────────────────
    case "ruerup_konzept": {
      const hb = K?.ruerup_hoechstbetrag || 29344;
      let r = `**Rürup-Rente (Basisrente) — für wen lohnt sich das?** (§ 10 Abs. 1 Nr. 2 EStG)${situationsHinweis}

`;
      r += `Die Rürup-Rente ist eine staatlich geförderte Altersvorsorge — du zahlst ein, setzt die Beiträge als Sonderausgaben ab, und zahlst im Rentenalter Einkommensteuer auf die Auszahlungen.

`;
      r += `**${y}: Beiträge bis ${_fmt(hb)} (Ledige) zu 100 % absetzbar.**
`;
      r += `(Verheiratete: ${_fmt(hb * 2)})

`;
      r += `**Für wen besonders geeignet:**
`;
      if (mod.selbstaendig) {
        r += `✅ **Selbständige & Freiberufler** — keine gesetzliche Rente → Rürup ist oft die beste Option
`;
      }
      r += `✅ Gutverdiener mit hohem Grenzsteuersatz (≥ 35 %) → maximale Steuerersparnis
`;
      r += `✅ Selbständige ohne Rentenpflicht
`;
      r += `❌ Weniger geeignet: Angestellte mit niedrigem Einkommen (Riester + bAV oft besser)

`;
      r += `**Wie die Steuerersparnis funktioniert:**
`;
      r += `Bei 42 % Grenzsteuersatz: 10.000 € Einzahlung → ~4.200 € Steuerersparnis im gleichen Jahr.

`;
      r += `**Nachteil:** Nicht vererbbar, nicht kündbar (nur beitragsfrei stellbar), Auszahlung nur als lebenslange Rente.`;
      r += follow(["Rürup berechnen", "Was ist Riester?", "Was ist bAV?", "Für wen lohnt sich Rürup?"]);
      return r + T;
    }

    // ── Riester Konzept ───────────────────────────────────────────────────
    case "riester_konzept": {
      let r = `**Riester-Rente — Mechanismus & für wen?** (§ 10a, §§ 79ff EStG)${situationsHinweis}

`;
      r += `Riester kombiniert **staatliche Zulagen** + **Steuervorteil** als Sonderausgaben:

`;
      r += `**Zulagen ${y}:**
`;
      r += `- Grundzulage: **175 €/Jahr** (automatisch wenn 4 % des Vorjahresbruttos eingezahlt)
`;
      r += `- Kinderzulage: **185 €/Kind** (vor 2008 geboren) / **300 €/Kind** (ab 2008)

`;
      r += `**Sonderausgaben-Abzug:** Bis 2.100 €/Jahr abzugsfähig. Das Finanzamt verrechnet die Zulagen gegen den Abzug (Günstigerprüfung automatisch).

`;
      r += `**Für wen lohnt sich Riester?**
`;
      r += `✅ Familien mit Kindern (viele Kinderzulagen)
`;
      r += `✅ Geringverdiener (Zulagen dominieren)
`;
      r += `❌ Gutverdiener ohne Kinder: Steuerersparnis oft geringer als bei Rürup
`;
      r += `❌ Selbständige: meistens nicht förderberechtigt (Ausnahmen: Beamte, Pflichtversicherte)

`;
      r += `**Mindesteinzahlung:** 4 % des Vorjahresbruttos minus Zulagen. Zahlst du weniger → Zulagen werden anteilig gekürzt.`;
      r += follow(["Riester berechnen", "Was ist Rürup?", "Was ist bAV?", "Riester vs. Rürup"]);
      return r + T;
    }

    // ── bAV Konzept ───────────────────────────────────────────────────────
    case "bav_konzept": {
      const bavMax = K ? Math.round((K.bbg_rv_monatlich || 8050) * 12 * 0.04) : 3864;
      let r = `**Betriebliche Altersvorsorge (bAV) — wie funktioniert Entgeltumwandlung?** (§ 3 Nr. 63 EStG)

`;
      r += `Bei der bAV zahlst du einen Teil deines **Bruttogehalts** direkt in die Betriebsrente ein — bevor Steuern und Sozialabgaben berechnet werden.

`;
      r += `**Steuervorteil ${y}:**
`;
      r += `Bis **${_fmt(bavMax)}/Jahr** (= 4 % der Beitragsbemessungsgrenze RV) sind Einzahlungen steuerfrei und sozialabgabenfrei.

`;
      r += `**Wie es funktioniert:**
`;
      r += `- Brutto 4.000 € → du wandelst 200 € um → Beitragsberechnung auf 3.800 €
`;
      r += `- Steuer & SV sparst du auf die 200 € → netto kostet dich der Beitrag viel weniger

`;
      r += `**Arbeitgeberzuschuss:** Seit 2022 ist der AG verpflichtet, 15 % Pflichtbeitrag obendrauf zu legen — mindest.

`;
      r += `**Nachteil:** Geringere Sozialversicherungsbeiträge → im Alter etwas niedrigere gesetzliche Rente. Und: im Rentenalter wird die bAV-Rente versteuert + KV-Beiträge fällig (über 2025: Freibetrag beachten).`;
      r += follow(["Was ist Rürup?", "Was ist Riester?", "Brutto-Netto Rechner"]);
      return r + T;
    }

    // ── Progressionsvorbehalt ─────────────────────────────────────────────
    case "progressionsvorbehalt": {
      let r = `**Progressionsvorbehalt — warum erhöhen Kurzarbeit/Elterngeld die Steuer?** (§ 32b EStG)

`;
      r += `Bestimmte Lohnersatzleistungen sind **selbst steuerfrei**, erhöhen aber trotzdem den Steuersatz auf deine anderen Einkünfte:

`;
      r += `**Betroffen sind u.a.:**
`;
      r += `- Kurzarbeitergeld
`;
      r += `- Elterngeld
`;
      r += `- Krankengeld
`;
      r += `- Arbeitslosengeld I
`;
      r += `- Insolvenzgeld

`;
      r += `**Wie es funktioniert:**
`;
      r += `Nehmen wir an, du verdienst 30.000 € und erhältst 5.000 € Kurzarbeitergeld:
`;
      r += `1. Die 5.000 € werden NICHT versteuert
`;
      r += `2. Aber: Das Finanzamt berechnet den Steuersatz so, als ob du 35.000 € verdient hättest
`;
      r += `3. Diesen (höheren) Satz wendet es dann auf deine 30.000 € an

`;
      r += `**Ergebnis:** Mehr Steuer auf dein normales Gehalt — daher oft Nachzahlung bei der nächsten Steuererklärung.

`;
      r += `**Pflicht zur Steuererklärung:** Wenn du Lohnersatzleistungen über 410 € erhalten hast, bist du verpflichtet, eine Steuererklärung abzugeben!`;
      r += follow(["Muss ich Steuererklärung abgeben?", "Steuernachzahlung vermeiden", "Was ist Brutto-Netto?"]);
      return r + T;
    }

    // ── Fünftelregelung / Abfindung ───────────────────────────────────────
    case "fuenftelregelung": {
      let r = `**Fünftelregelung bei Abfindungen** (§ 34 EStG)

`;
      r += `Abfindungen sind grundsätzlich steuerpflichtig — aber die Fünftelregelung mildert die Progression erheblich.

`;
      r += `**Wie es funktioniert:**
`;
      r += `Das Finanzamt berechnet die Steuer auf die Abfindung so, als ob sie gleichmäßig über 5 Jahre verteilt ausgezahlt worden wäre — also nur 1/5 pro Jahr.

`;
      r += `**Beispielrechnung (vereinfacht):**
`;
      r += `Abfindung: 50.000 € · Jahresgehalt: 40.000 €
`;
      r += `→ Steuer wird berechnet auf: 40.000 + 10.000 (= 1/5 von 50.000) = 50.000
`;
      r += `→ Differenz zu Normalsteuer × 5 = Abfindungssteuer

`;
      r += `**Vorteil:** Statt progressiv 42 % auf die vollen 50.000 € → effektiv deutlich niedrigerer Satz.

`;
      r += `**Bedingungen:** Die Abfindung muss für den Verlust des Arbeitsplatzes gezahlt werden und zusammengeballt in einem Jahr zufließen — keine Ratenzahlung über mehrere Jahre.`;
      r += follow(["Was ist die Steuerprogression?", "Brutto-Netto berechnen", "Was sind Sonderausgaben?"]);
      return r + T;
    }

    // ── Zusammenveranlagung ───────────────────────────────────────────────
    case "zusammenveranlagung_konzept": {
      let r = `**Zusammenveranlagung & Ehegattensplitting — was bringt das?** (§ 26 EStG)${situationsHinweis}

`;
      r += `Verheiratete und eingetragene Lebenspartner können gemeinsam veranlagt werden. Das Finanzamt addiert beide Einkünfte, halbiert sie fiktiv, berechnet die Steuer auf die Hälfte und verdoppelt das Ergebnis.

`;
      r += `**Wann lohnt sich Zusammenveranlagung?**
`;
      r += `Je größer der **Einkommensunterschied** zwischen den Partnern, desto mehr Vorteil:
`;
      r += `- Partner A verdient 80.000 €, Partner B 0 € → maximaler Splitting-Effekt
`;
      r += `- Partner A verdient 50.000 €, Partner B 48.000 € → minimaler Effekt (kaum Unterschied)

`;
      r += `**Vs. Einzelveranlagung:** Einzelveranlagung lohnt sich selten — nur in Ausnahmefällen z.B. wenn ein Partner hohe außergewöhnliche Belastungen hat.

`;
      r += `**Steuerklassen-Zusammenhang:** SK 3/5 setzt Zusammenveranlagung voraus. Aber Achtung: Die Steuerklasse beeinflusst nur den monatlichen Lohnsteuerabzug — die finale Steuerlast berechnet sich immer über die Jahressteuererklärung.`;
      r += follow(["Welche Steuerklasse ist besser — 3/5 oder 4/4?", "Steuerklasse wechseln", "Brutto-Netto berechnen"]);
      return r + T;
    }

    // ── Steuerklassen Konzept ─────────────────────────────────────────────
    case "steuerklassen_konzept": {
      let r = `**Steuerklassen in Deutschland — alle 6 erklärt** (§ 38b EStG)

`;
      r += `| SK | Für wen | Besonderheit |
|---|---|---|
`;
      r += `| **1** | Ledige, Geschiedene, Verwitwete (ab 2. Jahr) | Standard |
`;
      r += `| **2** | Alleinerziehende | Entlastungsbetrag ~4.260 €/Jahr |
`;
      r += `| **3** | Verheiratet, Besserverdiener | Geringe Lohnsteuer, hohe Abzüge für Partner (SK 5) |
`;
      r += `| **4** | Verheiratet, gleich hohes Einkommen | Wie SK 1, aber pro Kopf |
`;
      r += `| **5** | Verheiratet, Geringverdiener (Partner hat SK 3) | Hohe Lohnsteuer |
`;
      r += `| **6** | Zweiter Job, kein Freibetrag | Höchste Lohnsteuer |

`;
      r += `**Wichtig:** Die Steuerklasse ändert nur den monatlichen Lohnsteuerabzug — am Ende des Jahres wird die tatsächliche Steuer in der Steuererklärung exakt berechnet.

`;
      r += `**Faktorverfahren (Alternative zu 3/5):** Genauere Aufteilung für Paare — weniger Nachzahlung am Jahresende.`;
      r += follow(["Welche Steuerklasse für Verheiratete?", "Steuerklasse wechseln", "Brutto-Netto berechnen"]);
      return r + T;
    }

    // ── SK Verheiratet ────────────────────────────────────────────────────
    case "steuerklasse_verheiratet": {
      let r = `**Steuerklasse 3/5 vs. 4/4 vs. Faktorverfahren für Verheiratete**${situationsHinweis}

`;
      r += `**Kombination 3/5:**
`;
      r += `- Besserverdiener → SK 3 (sehr wenig Lohnsteuer)
`;
      r += `- Geringverdiener → SK 5 (viel Lohnsteuer)
`;
      r += `- Vorteil: mehr Netto monatlich für den Besserverdiener
`;
      r += `- Risiko: **meist Nachzahlung** am Jahresende (weil SK 5-Partner zu wenig abgeführt)

`;
      r += `**Kombination 4/4:**
`;
      r += `- Beide tragen SK 4 (wie Ledige, aber getrennt)
`;
      r += `- Besser bei ähnlichen Gehältern
`;
      r += `- Selten Nachzahlung oder Erstattung am Jahresende

`;
      r += `**Faktorverfahren (4/4 + Faktor):**
`;
      r += `- Teilt den Splittingvorteil genau auf beide auf
`;
      r += `- Monatlich exakt — kaum Nachzahlung oder Erstattung
`;
      r += `- Beste Wahl wenn unterschiedliche Gehälter, aber 3/5-Nachzahlungsrisiko vermieden werden soll

`;
      r += `**Steuerliche Gesamtlast** ist bei 3/5, 4/4 und Faktorverfahren **identisch** — nur der monatliche Abzug unterscheidet sich!`;
      r += follow(["Zusammenveranlagung erklärt", "Steuerklasse wechseln", "Brutto-Netto berechnen"]);
      return r + T;
    }

    // ── Student Steuer ────────────────────────────────────────────────────
    case "student_steuer_konzept": {
      let r = `**Steuern als Student — Erststudium vs. Zweitstudium** (§ 9, § 10 EStG)

`;
      r += `Das ist einer der häufigsten Irrtümer:

`;
      r += `**Erststudium (Bachelor, 1. Berufsausbildung):**
`;
      r += `Studiumskosten gelten als **Sonderausgaben** — max. **6.000 €/Jahr** absetzbar. Kein Verlustvortrag möglich!
`;
      r += `→ Problem: Wenn du kaum Einkommen hast, bringt dir der Abzug wenig.

`;
      r += `**Zweitstudium / nach Berufsausbildung:**
`;
      r += `Kosten gelten als **Werbungskosten** — unbegrenzt, und als **Verlustvortrag** nutzbar!
`;
      r += `→ Du kannst Verluste aus dem Studium in spätere Jahre vortragen und dann mit Gehalt verrechnen.

`;
      r += `**AfA im Studium:** Laptop, Bürostühle, Fachliteratur → gelten als Bildungsausgaben, absetzbar (AfA oder GWG).

`;
      r += `**Nebenjob als Student:**
`;
      r += `- Unter Grundfreibetrag (${_fmt(gfb)}/Jahr) → keine Einkommensteuer
`;
      r += `- Steuererklärung trotzdem sinnvoll → zu viel einbehaltene Lohnsteuer zurückholen
`;
      r += `- Werkstudent (< 20h/Woche) → keine RV-Beiträge

`;
      r += `**Fazit:** Immer Steuererklärung machen — auch ohne Steuerpflicht!`;
      r += follow(["Was ist Verlustvortrag?", "Laptop absetzen als Student", "Muss ich Steuererklärung machen?"]);
      return r + T;
    }

    // ── Azubi Steuer ──────────────────────────────────────────────────────
    case "azubi_steuer_konzept": {
      let r = `**Steuern als Azubi — was gilt?**${situationsHinweis}

`;
      r += `Als Auszubildender gelten ähnliche Regeln wie für Studenten — mit einem wichtigen Unterschied:

`;
      r += `**Erste Berufsausbildung (Azubi):**
Ausbildungskosten als **Sonderausgaben** (max. 6.000 €/Jahr) — kein Verlustvortrag.

`;
      r += `**Nach der Ausbildung (Weiterbildung / Zweitausbildung):**
Als **Werbungskosten** unbegrenzt abzugsfähig + Verlustvortrag möglich.

`;
      r += `**Was du als Azubi absetzen kannst:**
`;
      r += `- Fahrtkosten zur Berufsschule (Pendlerpauschale)
`;
      r += `- Arbeitsmittel: Laptop, Bücher, Werkzeug (AfA oder GWG)
`;
      r += `- Berufskleidung (sofern nicht privat tragbar)
`;
      r += `- Lernmaterial, Fachbücher

`;
      r += `**Gehalt unter Grundfreibetrag (${_fmt(gfb)}/Jahr)?**
Trotzdem Steuererklärung machen! Oft wurde zu viel Lohnsteuer abgezogen — du bekommst es zurück.

`;
      r += `**Pendlerpauschale:** Zur Berufsschule und zum Ausbildungsbetrieb — beide Wege absetzbar (je nach Arbeitsstätte-Regelung).`;
      r += follow(["Pendlerpauschale als Azubi", "Laptop absetzen", "Steuererklärung als Azubi"]);
      return r + T;
    }

    // ── Zumutbare Eigenbelastung ──────────────────────────────────────────
    case "zumutbare_eigenbelastung": {
      let r = `**Zumutbare Eigenbelastung — warum bekomme ich nicht alles erstattet?** (§ 33 EStG)

`;
      r += `Bei außergewöhnlichen Belastungen (z.B. Krankheitskosten) musst du erst einen bestimmten Betrag selbst tragen — die "zumutbare Eigenbelastung". Erst was darüber liegt, wird steuerlich anerkannt.

`;
      r += `**Warum gibt es das?** Das Finanzamt geht davon aus, dass jeder Haushalt gewisse außergewöhnliche Kosten selbst stemmen kann.

`;
      r += `**Wie hoch ist sie?** Hängt ab von Einkommen, Familienstand, Kinderzahl:
`;
      r += `| Einkommen | Ledig (0 Kinder) | Verheiratet (2 Kinder) |
|---|---|---|
`;
      r += `| bis 15.340 € | 5 % | 2 % |
`;
      r += `| 15.340–51.130 € | 6 % | 3 % |
`;
      r += `| über 51.130 € | 7 % | 4 % |

`;
      r += `**Beispiel:** Einkommen 40.000 €, ledig, keine Kinder → Eigenbelastung: 6 % × 40.000 = 2.400 €.
Arztkosten 3.000 € → Absetzbar: 3.000 − 2.400 = **600 €**

`;
      r += `**Tipp:** Kosten aus mehreren Jahren in einem Jahr bündeln (wenn möglich), um die Eigenbelastungsschwelle zu überschreiten.`;
      r += follow(["Krankheitskosten absetzen", "Was sind außergewöhnliche Belastungen?", "Was ist §33 EStG?"]);
      return r + T;
    }

    // ── Behinderten-Pauschbetrag ──────────────────────────────────────────
    case "behinderten_pauschbetrag_konzept": {
      let r = `**Behinderten-Pauschbetrag ${y}** (§ 33b EStG)

`;
      r += `Statt Einzelnachweis für behinderungsbedingte Kosten kannst du den Pauschbetrag pauschal abziehen — automatisch, ohne Belege:

`;
      r += `| GdB | Pauschbetrag/Jahr |
|---|---|
`;
      r += `| 20 | 384 € |
`;
      r += `| 30 | 620 € |
`;
      r += `| 40 | 860 € |
`;
      r += `| 50 | 1.140 € |
`;
      r += `| 60 | 1.440 € |
`;
      r += `| 70 | 1.780 € |
`;
      r += `| 80 | 2.120 € |
`;
      r += `| 90 | 2.460 € |
`;
      r += `| 100 | **2.840 €** |
`;
      r += `| Merkzeichen H oder Bl | **7.400 €** |

`;
      r += `**Beantragen:** Anlage "Außergewöhnliche Belastungen" in der Steuererklärung, Schwerbehindertenausweis als Nachweis.

`;
      r += `**Wichtig:** Der Pauschbetrag ist ein Werbungskosten-/Sonderausgaben-Äquivalent — er reduziert das zu versteuernde Einkommen direkt. Wenn deine tatsächlichen behinderungsbedingten Kosten höher sind, kannst du stattdessen Einzelnachweis führen.`;
      r += follow(["Pflegepauschbetrag", "Was sind außergewöhnliche Belastungen?", "Steuererklärung abgeben"]);
      return r + T;
    }

    // ── §35a Haushaltsnahe DL ─────────────────────────────────────────────
    case "haushaltsnahe_konzept": {
      let r = `**§ 35a EStG — Haushaltsnahe Dienstleistungen & Handwerker (Systematik)**

`;
      r += `§ 35a ist eine **Steuerermäßigung** (kein Abzug vom Einkommen, sondern direkt von der Steuerschuld!) — 20 % der Kosten werden von deiner Steuerlast abgezogen.

`;
      r += `**Drei Kategorien:**

`;
      r += `**1. Haushaltsnahe Dienstleistungen (§ 35a Abs. 2):**
`;
      r += `Max. Kosten: 20.000 € → max. **4.000 € Steuerersparnis**
`;
      r += `- Putzhilfe, Haushaltshilfe, Gärtner
`;
      r += `- Kinderbetreuung (sofern nicht schon als SA abgesetzt)
`;
      r += `- Pflege/Betreuung von Angehörigen

`;
      r += `**2. Handwerkerleistungen (§ 35a Abs. 3):**
`;
      r += `Max. Kosten: 6.000 € → max. **1.200 € Steuerersparnis**
`;
      r += `- Renovierung, Reparatur, Modernisierung
`;
      r += `- Heizungscheck, Schornsteinfeger, Malerarbeiten
`;
      r += `- NUR Lohnkosten (kein Material!)

`;
      r += `**3. Minijob im Haushalt (§ 35a Abs. 1):**
`;
      r += `Max. Kosten: 2.550 € → max. **510 € Steuerersparnis**

`;
      r += `**Bedingung für alle:** Rechnung + **Überweisung** (kein Bargeld!) · Leistung im Haushalt erbracht.`;
      r += follow(["§35a berechnen", "Putzhilfe absetzen", "Handwerker absetzen"]);
      return r + T;
    }

    // ── Sonderausgaben Konzept ────────────────────────────────────────────
    case "sonderausgaben_konzept": {
      let r = `**Sonderausgaben — was zählt dazu?** (§§ 10–10c EStG)

`;
      r += `Sonderausgaben sind private Ausgaben, die trotzdem steuerlich absetzbar sind — im Gegensatz zu Werbungskosten (die beruflich veranlasst sein müssen).

`;
      r += `**Hauptkategorien Sonderausgaben:**

`;
      r += `**Vorsorgeaufwendungen:**
`;
      r += `- Basisversorgung: Gesetzliche Rente, Rürup, berufsständische Versorgung
`;
      r += `- Kranken- & Pflegeversicherungsbeiträge (die "Basisabsicherung")
`;
      r += `- Private Krankenversicherung (Basisabsicherungs-Anteil)

`;
      r += `**Sonstige Sonderausgaben:**
`;
      r += `- Riester-Beiträge (§ 10a, max. 2.100 €)
`;
      r += `- Kirchensteuer
`;
      r += `- Spenden & Mitgliedsbeiträge
`;
      r += `- Unterhalt an Ex-Partner (Realsplitting, max. 13.805 €)
`;
      r += `- Schulgeld (30 % max. 5.000 €)
`;
      r += `- Kosten Erststudium (max. 6.000 €)

`;
      r += `**Sonderausgaben-Pauschbetrag:** 36 €/Jahr (lächerlich niedrig) — wird automatisch angesetzt, wenn du keine höheren Sonderausgaben nachweist.`;
      r += follow(["Was sind Werbungskosten?", "Rürup absetzen", "Riester absetzen", "Was kann ich optimieren?"]);
      return r + T;
    }

    // ── Verlustvortrag Konzept ────────────────────────────────────────────
    case "verlustvortrag_konzept": {
      let r = `**Verlustvortrag — wie funktioniert das?** (§ 10d EStG)

`;
      r += `Wenn deine Ausgaben in einem Jahr höher sind als deine Einnahmen, entsteht ein **steuerlicher Verlust**. Dieser kann in Folgejahre "vorgetragen" und dort mit Einkommen verrechnet werden.

`;
      r += `**Typische Situationen:**
`;
      r += `- Student (Zweitstudium) ohne Einkommen → Studiumskosten als Werbungskosten → Verlust → Vortrag
`;
      r += `- Selbständiger mit Anlaufverlusten
`;
      r += `- Vermieter mit hohen Anfangsinvestitionen

`;
      r += `**Wie es funktioniert:**
`;
      r += `Jahr 1: Einkommen 0 €, Kosten 8.000 € → Verlust 8.000 €
`;
      r += `Jahr 2: Gehalt 40.000 € → Zu versteuerndes Einkommen: 40.000 − 8.000 = **32.000 €**

`;
      r += `**Verlustrücktrag:** Verluste können auch ins Vorjahr zurückgetragen werden (max. 10 Mio. €, ergibt Erstattung).

`;
      r += `**Wichtig für Studenten:** Zweitstudium-Verluste sammeln und nach dem Studium mit dem ersten Gehalt verrechnen → signifikante Steuererstattung!`;
      r += follow(["Student und Steuern", "Was ist das Zuflussprinzip?", "Steuererklärung rückwirkend"]);
      return r + T;
    }

    // ── Festsetzungsverjährung ────────────────────────────────────────────
    case "festsetzungsverjaehrung_konzept": {
      let r = `**Festsetzungsverjährung — wie weit kann ich rückwirkend Steuern abgeben?** (§ 169 AO)

`;
      r += `Du kannst Steuererklärungen bis zu **4 Jahre rückwirkend** einreichen:

`;
      r += `**${y}: rückwirkend abgebbar bis Veranlagungsjahr ${y - 4}**

`;
      r += `**Für freiwillige Erklärungen** (keine Abgabepflicht): Die 4-Jahres-Frist läuft ab Ende des Veranlagungsjahres.

`;
      r += `**Für Pflichtveranlagung:** Grundsätzlich Frist 31. Juli des Folgejahres (mit Steuerberater: 28. Feb übernächstes Jahr) — aber auch hier gilt die 4-Jahres-Grenze als absolute Grenze.

`;
      r += `**Lohnt sich das?** Fast immer! Besonders wenn du in den vergangenen Jahren:
`;
      r += `- Homeoffice hattest (Pauschale rückwirkend ansetzbar)
`;
      r += `- Werbungskosten über ${_fmt(wkp)} hattest
`;
      r += `- Krankheitskosten, Spenden oder andere Sonderausgaben hattest

`;
      r += `**Keine Steuern zu zahlen = trotzdem Erklärung machen** → du bekommst möglicherweise zu viel abgezogene Lohnsteuer zurück.`;
      r += follow(["Steuererklärung rückwirkend", "Lohnt sich eine Steuererklärung?", "Fristen"]);
      return r + T;
    }

    // ── Einspruch Konzept ─────────────────────────────────────────────────
    case "einspruch_konzept": {
      let r = `**Einspruch gegen den Steuerbescheid — wie geht das?** (§ 347 AO)

`;
      r += `Wenn du mit deinem Steuerbescheid nicht einverstanden bist, hast du das Recht, Einspruch einzulegen.

`;
      r += `**Frist: 1 Monat** ab Bekanntgabe des Bescheids (Poststempel + 3 Tage Bekanntgabe-Fiktion).

`;
      r += `**Wie einlegen:**
`;
      r += `1. Schriftlich an das zuständige Finanzamt (Brief, Fax oder ELSTER)
`;
      r += `2. Bezeichnung "Einspruch gegen den Steuerbescheid vom [Datum]"
`;
      r += `3. Begründung — kann auch nachgereicht werden

`;
      r += `**Was prüfen?**
`;
      r += `- Wurden alle Werbungskosten/Sonderausgaben korrekt anerkannt?
`;
      r += `- Stimmen die Zahlen mit deiner Erklärung überein?
`;
      r += `- Gibt es ein Anhängigkeitsverfahren (Musterklage) zu einem relevanten Thema?

`;
      r += `**Tipp: Vorläufige Anerkennung** — manche Punkte werden vom Finanzamt "unter Vorbehalt" gestellt. Diese werden automatisch korrigiert wenn Bundesfinanzhof-Urteile vorliegen.

`;
      r += `**Nach dem Einspruch:** Finanzamt prüft erneut → Einspruchsentscheidung → ggf. Klage beim Finanzgericht.`;
      r += follow(["Was ist ein vorläufiger Bescheid?", "Was prüfe ich im Steuerbescheid?", "Fristen"]);
      return r + T;
    }

    // ── Vorläufiger Bescheid ──────────────────────────────────────────────
    case "vorlaeufiger_bescheid": {
      let r = `**Vorläufiger Bescheid — was bedeutet das?**

`;
      r += `Ein Steuerbescheid kann ganz oder teilweise "vorläufig" sein — das bedeutet: Das Finanzamt behält sich vor, diesen Punkt später zu ändern, sobald eine Rechtsfrage (z.B. durch den Bundesfinanzhof) geklärt ist.

`;
      r += `**Warum ist das gut für dich?**
`;
      r += `- Wenn der BFH später zu deinen Gunsten entscheidet → der Bescheid wird automatisch korrigiert
`;
      r += `- Du musst keinen Einspruch einlegen für den vorläufigen Punkt

`;
      r += `**Was steht vorläufig unter Vorbehalt?** Häufig z.B.:
`;
      r += `- Verfassungsmäßigkeit bestimmter Regelungen (z.B. Solidaritätszuschlag)
`;
      r += `- Anhängige BFH-Verfahren zu Werbungskosten, Sonderausgaben etc.

`;
      r += `**"Unter Vorbehalt der Nachprüfung"** (§ 164 AO) ist etwas anderes: Das FA kann den Bescheid jederzeit ändern — auch zu deinen Ungunsten.`;
      r += follow(["Wie lege ich Einspruch ein?", "Steuerbescheid prüfen", "Fristen"]);
      return r + T;
    }

    // ── Kinderfreibetrag vs Kindergeld ────────────────────────────────────
    case "kinderfreibetrag_konzept": {
      let r = `**Kinderfreibetrag vs. Kindergeld — was ist besser?** (§ 31, 32 EStG)

`;
      r += `Du bekommst nicht beides — das Finanzamt wählt automatisch, was günstiger ist (Günstigerprüfung).

`;
      r += `**Kindergeld ${y}:** **255 €/Monat** pro Kind (3.060 €/Jahr)

`;
      r += `**Kinderfreibetrag ${y}:** 6.672 € pro Kind (3.336 € je Elternteil × 2)
`;
      r += `+ Freibetrag Betreuung/Erziehung/Ausbildung: 2.928 € → **gesamt 9.600 €/Kind**

`;
      r += `**Wann lohnt sich der Freibetrag?**
`;
      r += `Steuerersparnis durch Freibetrag = 9.600 € × Grenzsteuersatz
`;
      r += `Bei 42 % Grenzsteuersatz: 9.600 × 42 % = **4.032 €** > 3.060 € Kindergeld
`;
      r += `→ Ab ca. **32 % Grenzsteuersatz** lohnt sich der Kinderfreibetrag mehr.

`;
      r += `**Praktisch:** Du beantragst Kindergeld (automatisch, Familienkasse). In der Steuererklärung wird Anlage Kind ausgefüllt — das FA verrechnet das Kindergeld gegen den Freibetrag und wählt das Günstigere automatisch.`;
      r += follow(["Kindergeld berechnen", "Was ist der Grundfreibetrag?", "Kinderbetreuung absetzen"]);
      return r + T;
    }

    // ── Übungsleiter-Freibetrag ───────────────────────────────────────────
    case "ubungsleiter_freibetrag_konzept": {
      let r = `**Übungsleiter-Freibetrag & Ehrenamtspauschale** (§ 3 Nr. 26 / Nr. 26a EStG)

`;
      r += `**Übungsleiter-Freibetrag (§ 3 Nr. 26): 3.000 €/Jahr steuerfrei**
`;
      r += `Für: Trainer, Betreuer, Ausbilder, Erzieher, Pflegekräfte in gemeinnützigen Org., Kirchen, Vereinen.
`;
      r += `Auch: Chorleiter, Musiklehrer, Rettungsschwimmer, Jugendgruppenleiter.

`;
      r += `**Ehrenamtspauschale (§ 3 Nr. 26a): 840 €/Jahr steuerfrei**
`;
      r += `Für: alle anderen ehrenamtlichen Tätigkeiten in gemeinnützigen Org. (z.B. Kassierer, Vorstand, Helfer).

`;
      r += `**Wichtig:**
`;
      r += `- Nur für nebenberufliche Tätigkeit (max. 1/3 der Arbeitszeit)
`;
      r += `- Ausschließlich in steuerbegünstigten Organisationen (gemeinnützig, mildtätig, kirchlich)
`;
      r += `- Kosten über dem Freibetrag → als Werbungskosten/Betriebsausgaben absetzbar
`;
      r += `- Beide Freibeträge können nicht gleichzeitig genutzt werden`;
      r += follow(["Was sind Sonderausgaben?", "Was sind Werbungskosten?", "Nebeneinnahmen versteuern"]);
      return r + T;
    }

    // ── Inflationsausgleich ───────────────────────────────────────────────
    case "inflationsausgleich_konzept": {
      let r = `**Inflationsausgleichsprämie — steuerfreie 3.000 €** (§ 3 Nr. 11c EStG)

`;
      r += `Arbeitgeber durften zwischen Oktober 2022 und Dezember 2024 einmalig bis zu **3.000 €** als Inflationsausgleich zahlen — steuerfrei und sozialabgabenfrei.

`;
      r += `**Gilt das noch?** Die Inflationsausgleichsprämie lief **bis 31.12.2024** — ab 2025 gibt es diesen Sonderstatus nicht mehr.

`;
      r += `**Falls du sie erhalten hast:** Wird auf der Lohnsteuerbescheinigung ausgewiesen, ist aber steuerfrei und muss nicht versteuert werden. Trotzdem in der Steuererklärung prüfen ob korrekt eingetragen.`;
      r += follow(["Welche Arbeitgeberleistungen sind steuerfrei?", "Was sind steuerfreie Zuschläge?"]);
      return r + T;
    }

    // ── Dienstwagen ───────────────────────────────────────────────────────
    case "dienstwagen_konzept": {
      let r = `**Dienstwagen — 1%-Regel vs. Fahrtenbuch**

`;
      r += `Wenn du einen Firmenwagen auch privat nutzen darfst, gilt das als **geldwerter Vorteil** — du musst ihn versteuern.

`;
      r += `**Methode 1: 1%-Regel (Standard)**
`;
      r += `Monatlicher geldwerter Vorteil = 1 % des Bruttolistenpreises
`;
      r += `+ 0,03 % × Listenpreis × km Arbeitsweg pro Monat (Pendelanteil)

`;
      r += `**Beispiel:** Auto Listenspreise 40.000 €, 20 km Arbeitsweg:
`;
      r += `- Privatanteil: 1 % × 40.000 = 400 €/Monat
`;
      r += `- Pendelanteil: 0,03 % × 40.000 × 20 = 240 €/Monat
`;
      r += `- Gesamt geldwerter Vorteil: 640 €/Monat → wird auf den Lohn aufgeschlagen und versteuert

`;
      r += `**Methode 2: Fahrtenbuch**
`;
      r += `Du führst lückenlos jede Fahrt auf → tatsächlicher Privatanteil wird berechnet.
`;
      r += `Lohnt sich wenn: Privatnutzung sehr gering (unter ~25–30 % der Gesamtfahrten).

`;
      r += `**Elektro-Vorteil:** Bei reinen E-Autos gilt nur **0,25 %** des Listenpreises (statt 1 %) — signifikante Steuerersparnis.`;
      r += follow(["Brutto-Netto Rechner", "Was sind geldwerte Vorteile?", "Pendlerpauschale mit Firmenwagen"]);
      return r + T;
    }

    // ── Doppelte Haushaltsführung Konzept ─────────────────────────────────
    case "doppelte_hh_konzept": {
      let r = `**Doppelte Haushaltsführung — Voraussetzungen & was absetzbar ist** (§ 9 Abs. 1 Nr. 5 EStG)${situationsHinweis}

`;
      r += `Du hast doppelte Haushaltsführung wenn du **beruflich** eine zweite Unterkunft am Arbeitsort brauchst und deinen Hauptwohnsitz beibehältst.

`;
      r += `**Voraussetzungen:**
`;
      r += `1. Eigener Hausstand am Heimatort (finanzielle Beteiligung an den Kosten!)
`;
      r += `2. Unterkunft am Beschäftigungsort
`;
      r += `3. Berufliche Veranlassung (Arbeitsort ≠ Heimatort)

`;
      r += `**Was du absetzen kannst:**
`;
      r += `- Miete am Arbeitsort: max. **1.000 €/Monat** (12.000 €/Jahr)
`;
      r += `- Verpflegungsmehraufwand: erste 3 Monate (24 €/Tag oder 12 €/Tag)
`;
      r += `- Wöchentliche Heimfahrt (Pendlerpauschale für eine Fahrt/Woche)
`;
      r += `- Erstausstattung der Zweitwohnung

`;
      r += `**Häufiger Fehler:** Der Haupthaushalt muss wirklich deiner sein — nicht Eltern-WG ohne eigene Kostenbeteiligung → wird abgelehnt.`;
      r += follow(["Doppelte Haushaltsführung berechnen", "Verpflegungsmehraufwand", "Pendlerpauschale"]);
      return r + T;
    }

    // ── Verpflegungsmehraufwand ───────────────────────────────────────────
    case "verpflegungsmehraufwand_konzept": {
      let r = `**Verpflegungsmehraufwand (VMA) — wann und wie viel?** (§ 9 Abs. 4a EStG)

`;
      r += `Wenn du beruflich auswärts tätig bist (Dienstreise, mobiler Einsatz, doppelte HHF), kannst du Verpflegungskosten pauschal absetzen — ohne Belege:

`;
      r += `**Pauschalen ${y} (Inland):**
`;
      r += `- Ab 8 Stunden Abwesenheit: **14 €/Tag**
`;
      r += `- Ab 24 Stunden / Übernachtung: **28 €/Tag**
`;
      r += `- An- und Abreisetag bei Übernachtung: **14 €/Tag** je

`;
      r += `**Nur für die ersten 3 Monate** an derselben Tätigkeitsstätte (dann gilt sie als "erste Tätigkeitsstätte").

`;
      r += `**Wichtig:** Wenn der Arbeitgeber Mahlzeiten stellt oder erstattet, kürzt sich die Pauschale:
`;
      r += `- Frühstück: −5,60 € · Mittag: −11,20 € · Abend: −11,20 €

`;
      r += `**Steuerfreie AG-Erstattung:** Der Arbeitgeber kann VMA steuerfrei auszahlen — dann kein Werbungskosten-Abzug mehr.`;
      r += follow(["Doppelte Haushaltsführung", "Reisekosten absetzen", "Was sind Werbungskosten?"]);
      return r + T;
    }

    // ── Photovoltaik ──────────────────────────────────────────────────────
    case "photovoltaik_konzept": {
      let r = `**Photovoltaik — steuerliche Behandlung** (§ 3 Nr. 72 EStG)

`;
      r += `Seit 2022/2023 gibt es erhebliche Vereinfachungen:

`;
      r += `**Einkommensteuer-Befreiung (seit 01.01.2022):**
`;
      r += `PV-Anlagen bis **30 kWp** (Einfamilienhaus, Gewerbegebäude), **15 kWp** bei Wohngebäuden → Einnahmen aus Einspeisevergütung **steuerfrei**. Kein Gewerbeschein, keine Steuererklärung für PV nötig.

`;
      r += `**Umsatzsteuer (seit 2023):**
`;
      r += `- Kauf und Installation von PV-Anlagen bis 30 kWp: **0 % USt** (auf Lieferung und Installation)
`;
      r += `- Kein Vorsteuerabzug mehr möglich (war früher ein Vorteil)

`;
      r += `**Bei größeren Anlagen (über 30 kWp):**
`;
      r += `→ Weiterhin steuerpflichtig, Gewerbeanmeldung, EÜR

`;
      r += `**Eigenverbrauch:** Bei steuerfreien Anlagen kein geldwerter Vorteil für Eigenverbrauch mehr anzusetzen.`;
      r += follow(["Kleinunternehmerregelung", "Was sind Betriebsausgaben?", "Steuerbefreiungen"]);
      return r + T;
    }

    // ── Minijob Konzept ───────────────────────────────────────────────────
    case "minijob_konzept": {
      let r = `**Minijob vs. Midijob — Unterschied und Steuer** (§ 8 SGB IV)

`;
      r += `**Minijob (geringfügige Beschäftigung):**
`;
      r += `- Verdienstgrenze: **538 €/Monat** (2024/2025)
`;
      r += `- Für den Arbeitnehmer: **keine Lohnsteuer, keine SV-Beiträge** (außer RV-Eigenbeitrag)
`;
      r += `- Arbeitgeber zahlt Pauschalabgaben (~31 %)
`;
      r += `- Kein automatischer Rentenanspruch (opt-out möglich, aber empfohlen: opt-in)

`;
      r += `**Midijob (Übergangsbereich):**
`;
      r += `- 538,01 € bis **2.000 €/Monat**
`;
      r += `- Reduzierte SV-Beiträge (gleitend steigend)
`;
      r += `- Voller Lohnsteuerabzug (nach normaler Steuerklasse)

`;
      r += `**Für Rentner:** Minijob möglich ohne Rentenkürzung (Hinzuverdienst geregelt).

`;
      r += `**Mehrere Minijobs:** Erste Stelle Minijob-Privileg, zweite Stelle → normal SV-pflichtig!

`;
      r += `**Tipp:** Überschreite 538 € nur selten versehentlich — schon ein Monat drüber macht die gesamte Stelle SV-pflichtig.`;
      r += follow(["Nebeneinnahmen versteuern", "Brutto-Netto berechnen", "Was ist Steuerklasse 6?"]);
      return r + T;
    }

    // ── Default: unbekanntes Konzept ──────────────────────────────────────
    default:
      return null; // Kein Konzept gefunden → weitergeben
  }
}

// ── 5. Simple-Keyword-Fallback (wenn Fragetyp erkannt, Konzept aber in anderer Reihenfolge) ──
function _detectKonzeptSimple(msg) {
  const m = msg.toLowerCase();
  if (/\bafa\b|absetzung.{0,10}abnutzung|abschreib/.test(m)) return "afa";
  if (/\bgwg\b|geringwert|sofortabschreib/.test(m)) return "gwg";
  if (/grenzsteuersatz/.test(m)) return "grenzsteuersatz";
  if (/effektiv.{0,10}steuersatz|durchschnittssteuersatz/.test(m)) return "effektivsteuersatz";
  if (/steuerprogression|progressive.{0,10}steuer/.test(m)) return "progression";
  if (/zuflussprinzip/.test(m)) return "zuflussprinzip";
  if (/pauschale.{0,30}(tatsächlich|real|nachweis)|über.{0,15}pauschale|unter.{0,15}pauschale|was.{0,15}pauschale.{0,15}bedeutet/.test(m)) return "pauschale_vs_real";
  if (/grundfreibetrag|existenzminimum|ab wann.{0,20}steuer/.test(m)) return "grundfreibetrag_konzept";
  if (/sparer.?pauschbetrag|sparer.?freibetrag/.test(m)) return "sparer_pauschbetrag_konzept";
  if (/arbeitnehmer.?pausch/.test(m)) return "arbeitnehmer_pauschbetrag_konzept";
  if (/pendlerpauschale|entfernungspauschale/.test(m)) return "pendlerpauschale_konzept";
  if (/abgeltungsteuer/.test(m)) return "abgeltungsteuer_konzept";
  if (/freistellungsauftrag|\bfsa\b/.test(m)) return "freistellungsauftrag_konzept";
  if (/verlustverrechnung/.test(m)) return "verlustverrechnung_konzept";
  if (/spekulationsfrist/.test(m)) return "spekulationsfrist_konzept";
  if (/teilfreistellung/.test(m)) return "teilfreistellung_konzept";
  if (/vorabpauschale/.test(m)) return "vorabpauschale_konzept";
  if (/günstigerprüfung|günstigerwahlrecht/.test(m)) return "guenstiger_pruefung_konzept";
  if (/\brürup\b|basisrente/.test(m)) return "ruerup_konzept";
  if (/\briester\b/.test(m)) return "riester_konzept";
  if (/\bbav\b|betriebliche altersvorsorge|entgeltumwandlung/.test(m)) return "bav_konzept";
  if (/progressionsvorbehalt/.test(m)) return "progressionsvorbehalt";
  if (/fünftelregel|abfindung.{0,20}steuer/.test(m)) return "fuenftelregelung";
  if (/zusammenveranlag|ehegattensplitting|splittingvorteil/.test(m)) return "zusammenveranlagung_konzept";
  if (/steuerklassen?.{0,20}(was|wie|erkl|alle|übersicht)/.test(m)) return "steuerklassen_konzept";
  if (/steuerklasse.{0,20}(verheiratet|3.{0,3}5|4.{0,3}4|faktor)/.test(m)) return "steuerklasse_verheiratet";
  if (/erststudium|zweitstudium|studium.{0,20}(steuer|kosten|abset)/.test(m)) return "student_steuer_konzept";
  if (/(azubi|auszubildende).{0,20}(steuer|kosten|abset)/.test(m)) return "azubi_steuer_konzept";
  if (/zumutbare.{0,10}eigenbelastung/.test(m)) return "zumutbare_eigenbelastung";
  if (/behinderten.?pauschbetrag/.test(m)) return "behinderten_pauschbetrag_konzept";
  if (/§.?35a|haushaltsnahe.{0,15}(dienst|systematik)/.test(m)) return "haushaltsnahe_konzept";
  if (/sonderausgaben.{0,20}(was|wie|systematik|unterschied)/.test(m)) return "sonderausgaben_konzept";
  if (/verlustvortrag/.test(m)) return "verlustvortrag_konzept";
  if (/festsetzungsverjähr|4.{0,5}jahre.{0,20}rückwirkend/.test(m)) return "festsetzungsverjaehrung_konzept";
  if (/einspruch.{0,20}bescheid/.test(m)) return "einspruch_konzept";
  if (/vorläufig.{0,10}bescheid/.test(m)) return "vorlaeufiger_bescheid";
  if (/kinderfreibetrag.{0,20}(vs|oder|gegen).{0,20}kindergeld/.test(m)) return "kinderfreibetrag_konzept";
  if (/übungsleiter.?freibetrag|§.?3.{0,5}nr.{0,5}26\b/.test(m)) return "ubungsleiter_freibetrag_konzept";
  if (/inflationsausgleich/.test(m)) return "inflationsausgleich_konzept";
  if (/dienstwagen|firmenwagen|1%.{0,5}regel/.test(m)) return "dienstwagen_konzept";
  if (/doppelte.{0,5}haushalt|zweitwohnung/.test(m)) return "doppelte_hh_konzept";
  if (/verpflegungsmehraufwand|\bvma\b/.test(m)) return "verpflegungsmehraufwand_konzept";
  if (/photovoltaik|einspeisevergütung/.test(m)) return "photovoltaik_konzept";
  if (/minijob.{0,20}(was|wie|unterschied|midi)|midijob/.test(m)) return "minijob_konzept";
  return null;
}

// ── 6. Haupt-Konzept-Dispatcher ──────────────────────────────────────────
function _tryKonzeptAntwort(userMsg, p, yr, K) {
  const ft  = _detectFragetyp(userMsg);
  const mod = _detectModifiers(userMsg);

  // Primäre Konzept-Erkennung (bidirektionale Muster)
  let konzept = _detectKonzept(userMsg);

  // Fallback: wenn Fragetyp erkannt aber Konzept in anderer Reihenfolge
  // z.B. "Wie funktioniert Rürup?" oder "Was ist die Günstigerprüfung?"
  if (!konzept && ft) {
    konzept = _detectKonzeptSimple(userMsg);
  }

  // Kein Konzept identifiziert → normaler Intent-Weg
  if (!konzept) return null;

  const antwort = _konzeptAntwort(konzept, ft, mod, p, yr, K);
  return antwort; // null wenn kein Handler → Intent-Weg
}

function _h_default(p, yr) {
  // Versuche thematische Hinweise aus dem Profil zu geben
  const hints = [];
  if (p.hoTage > 0)  hints.push(`Du hast **${p.hoTage} Homeoffice-Tage** — frag mich: *"Homeoffice berechnen"*`);
  if (p.pendlKm > 0) hints.push(`Du pendelst **${p.pendlKm} km** — frag mich: *"Pendlerpauschale berechnen"*`);
  if (p.brutto > 0 && p.gst !== null) hints.push(`Dein Grenzsteuersatz: **~${p.gst} %** — jeder abgesetzte Euro spart ~${p.gst} Cent`);

  let r = `Das habe ich leider nicht ganz verstanden — aber ich helfe dir gerne weiter.\n\n`;

  if (hints.length > 0) {
    r += `**Passend zu deinem Profil:**\n`;
    hints.forEach(h => r += `- ${h}\n`);
    r += `\n`;
  }

  r += `**Ich verstehe natürliche Fragen wie zum Beispiel:**\n`;
  r += `- *"Ich fahre jeden Tag 25 km ins Büro — was bringt mir das?"* → Pendlerpauschale\n`;
  r += `- *"Ich arbeite 3 Tage die Woche von zuhause"* → Homeoffice-Pauschale\n`;
  r += `- *"Was bleibt mir netto bei 55.000 € brutto?"* → Brutto-Netto-Rechner\n`;
  r += `- *"Ich hab Aktien verkauft — muss ich da Steuern zahlen?"* → Kapitalerträge\n`;
  r += `- *"Meine Putzfrau — kann ich die absetzen?"* → §35a Haushaltsnahe\n`;
  r += `- *"Ich habe einen Laptop für die Arbeit gekauft"* → Arbeitsmittel/GWG\n`;
  r += `- *"Was kann ich alles von der Steuer absetzen?"* → Vollständige Optimierungsanalyse\n\n`;

  r += `**Alle Themen auf einen Blick:**\n`;
  r += `Homeoffice · Pendler · Werbungskosten · Brutto/Netto · Steuerklassen · Grundfreibetrag\n`;
  r += `§35a Haushalt · Kapital/ETF · Kirchensteuer · Soli · Fristen · ELSTER\n`;
  r += `Riester · Rürup · bAV · Minijob · Kinder · Studenten · Außergew. Belastungen\n`;
  r += `Arbeitsmittel · Doppelte Haushaltsführung · Unterhalt · Verluste · Rückwirkend\n\n`;

  r += `Oder schreib einfach: **"Was kann ich optimieren?"** — dann zeige ich dir alle Sparpotenziale aus deinem Profil.`;

  if (!p.brutto) {
    r += `\n\n*Tipp: Füll das Interview (📋) aus — dann kann ich mit deinen echten Zahlen rechnen.*`;
  }
  return r + _TAG;
}


// ── Einzel-Dispatcher (Prio-2c: für Multi-Intent wiederverwendbar) ──────────
function _dispatchIntent(intent, p, yr, K, ia, tweaks, state, investments) {
  switch (intent) {
    case "hilfe":           return _h_hilfe();
    case "profil":          return _h_profil(p, yr, K, ia, tweaks, state, investments);
    case "optimieren":      return _h_optimieren(p, yr, K, ia, tweaks, state, investments);
    case "homeoffice":      return _h_homeoffice(p, yr, K);
    case "pendler":         return _h_pendler(p, yr, K);
    case "werbungskosten":  return _h_werbungskosten(p, yr, K, state);
    case "bruttoNetto":     return _h_bruttoNetto(p, yr, K);
    case "steuerklasse":    return _h_steuerklasse(p, yr);
    case "grundfreibetrag": return _h_grundfreibetrag(yr, K);
    case "sonderausgaben":  return _h_sonderausgaben(p, yr, K, ia);
    case "haushaltsnahe":   return _h_haushaltsnahe(p, yr, K, state);
    case "kapital":         return _h_kapital(p, yr, K, investments);
    case "guenstiger":      return _h_guenstiger(p, yr, K, investments);
    case "soli":            return _h_soli(yr, K);
    case "kirchensteuer":   return _h_kirchensteuer(p, yr);
    case "fristen":         return _h_fristen(yr);
    case "minijob":         return _h_minijob(yr, K);
    case "riester":         return _h_riester(p, yr, K, ia);
    case "ruerup":          return _h_ruerup(p, yr);
    case "bav":             return _h_bav(p, yr, K, ia);
    case "aussergewoehnlich": return _h_aussergewoehnlich(p, yr, K);
    case "studenten":       return _h_studenten(yr, K);
    case "verlust":         return _h_verlust(yr);
    case "arbeitsmittel":   return _h_arbeitsmittel(p, yr);
    case "doppelteHH":      return _h_doppelteHH(p, yr, K);
    case "unterhalt":       return _h_unterhalt(p, yr, K);
    case "kinder":          return _h_kinder(p, yr, K);
    case "rueckwirkend":    return _h_rueckwirkend(yr);
    case "elster":          return _h_elster(yr);
    default:                return _h_default(p, yr);
  }
}

// ── Haupt-Dispatcher v3: Slots + Dialog-Gedächtnis + Fuzzy + Szenarien ──────
function deterministicSteuerAntwort(userMsg, { tweaks = {}, state = {}, investments = {}, interviewAnswers = {} } = {}) {
  // 1. Slots aus der Nachricht ziehen (Zahlen, km, Tage, Brutto, SK, Jahr …)
  const slotsNew = _extractSlots(userMsg);

  // 2. Jahr: explizit genannt ("für 2025") > aktuelles Jahr
  let yr = new Date().getFullYear();
  let jahrHinweis = "";
  if (slotsNew.jahr && slotsNew.jahr !== yr) {
    yr = slotsNew.jahr;
    jahrHinweis = `📅 *Berechnung für Steuerjahr ${yr} (wie von dir genannt).*\n\n`;
  }

  const K = (typeof getK === "function") ? getK(yr) : null;
  if (!K) return "**Steuer-Konfiguration noch nicht geladen** — bitte kurz warten und erneut senden." + _TAG;

  const ia = interviewAnswers || {};

  // 3. Intents erkennen (Stufe 1 Regex + Stufe 2 Semantik)
  //    Negierte Themen ("kein Homeoffice …") vorher entfernen
  const intentMsg = _stripNegations(userMsg);
  let intents = _detectAllIntents(intentMsg);

  // 4. Folgefrage? ("und bei 30 km?", "was wenn 60k?") → letztes Thema
  let followUpVon = null;
  if (intents[0] === "default") {
    const fu = _resolveFollowUp(userMsg, slotsNew, intents);
    if (fu) { intents = [fu]; followUpVon = fu; }
  }

  // 4b. Parameter-Verfeinerung: "und mit Steuerklasse 3?" während
  //     Brutto-Netto-Thema → Thema beibehalten, nur Parameter ändern
  if (!followUpVon && _NLU_CTX.intent && Date.now() - _NLU_CTX.ts < 30 * 60 * 1000) {
    const mShort = String(userMsg).trim();
    const calcThemen = ["bruttoNetto", "pendler", "homeoffice", "kapital", "werbungskosten"];
    const nurParamIntents = intents.every((i) => i === "steuerklasse" || i === "kinder" || i === "default");
    if (mShort.length <= 70 && _FOLLOWUP_RE.test(mShort) && nurParamIntents &&
        (slotsNew.sk != null || slotsNew.kinder != null) && calcThemen.indexOf(_NLU_CTX.intent) !== -1) {
      intents = [_NLU_CTX.intent];
      followUpVon = _NLU_CTX.intent;
    }
  }

  // 4c. Folgefrage: nackte Zahlen dem Kontext-Thema zuordnen
  //     ("was wäre bei 65000?" nach Brutto-Netto → 65.000 € brutto)
  if (followUpVon && slotsNew._nums && slotsNew._nums.length > 0) {
    if (followUpVon === "bruttoNetto" && slotsNew.brutto == null) {
      const cand = slotsNew._nums.filter((v) => v >= 3000 && v <= 2000000);
      if (cand.length > 0) { slotsNew.brutto = cand[0]; slotsNew.bruttoList = cand; }
    }
    if (followUpVon === "pendler" && slotsNew.km == null) {
      const cand = slotsNew._nums.filter((v) => v >= 1 && v <= 400);
      if (cand.length > 0) { slotsNew.km = cand[0]; slotsNew.kmList = cand; }
    }
    if (followUpVon === "homeoffice" && slotsNew.ho_tage == null) {
      const cand = slotsNew._nums.filter((v) => v >= 1 && v <= 210);
      if (cand.length > 0) slotsNew.ho_tage = cand[0];
    }
  }

  // 5. Fuzzy-Stufe 3 (Tippfehler) — nur wenn immer noch nichts erkannt
  let fuzzyHinweis = "";
  if (intents[0] === "default") {
    const fz = _fuzzyIntents(userMsg);
    if (fz.length > 0) {
      intents = fz.slice(0, 3);
      fuzzyHinweis = `🔎 *Ich habe deine Frage als „${intents[0]}" interpretiert (Tippfehler-tolerant). Falls falsch: formuliere kurz um.*\n\n`;
    }
  }

  // 6. Slots mit Dialog-Gedächtnis mergen (neue Werte überschreiben alte)
  const slots = followUpVon
    ? Object.assign({}, _NLU_CTX.slots || {}, slotsNew, { _nums: slotsNew._nums })
    : slotsNew;

  // 7. Profil bauen + Slots anwenden (Frage-Zahlen schlagen Interview-Daten)
  const p = _applySlots(_profile(ia, tweaks, yr, K), slots, userMsg, yr, K);

  // 8. Konzept-/Verständnisfragen ("Was ist AfA?") zuerst
  const konzeptAntwort = _tryKonzeptAntwort(userMsg, p, yr, K);
  if (konzeptAntwort) {
    _NLU_CTX = { intent: intents[0] !== "default" ? intents[0] : _NLU_CTX.intent, slots, ts: Date.now() };
    return jahrHinweis + konzeptAntwort;
  }

  // 9. Szenario-Vergleich ("50.000 oder 60.000?", "20 oder 35 km?")
  const istVergleich = /\b(oder|vs\.?|versus|statt|im vergleich (zu|mit))\b/.test(String(userMsg).toLowerCase());
  if (istVergleich && slots.bruttoList && slots.bruttoList.length >= 2 && (intents.includes("bruttoNetto") || intents[0] === "default" || intents.includes("optimieren"))) {
    const cmp = _h_vergleichBrutto(slots.bruttoList, p, yr, K);
    if (cmp) { _NLU_CTX = { intent: "bruttoNetto", slots, ts: Date.now() }; return jahrHinweis + cmp; }
  }
  if (slots.bruttoList && slots.bruttoList.length >= 2 && intents.includes("steuerklasse")) {
    const cmpSK = _h_vergleichSK(slots.bruttoList[slots.bruttoList.length - 1], slots.bruttoList[0], p, yr, K);
    if (cmpSK) { _NLU_CTX = { intent: "steuerklasse", slots, ts: Date.now() }; return jahrHinweis + cmpSK; }
  }
  if (istVergleich && slots.kmList && slots.kmList.length >= 2 && (intents.includes("pendler") || intents[0] === "default")) {
    _NLU_CTX = { intent: "pendler", slots, ts: Date.now() };
    return jahrHinweis + _h_vergleichKm(slots.kmList, p, yr, K);
  }

  // 10. Präfixe: übernommene Zahlen + Follow-up-Bezug + ELSTER-Zeile
  let prefix = jahrHinweis + fuzzyHinweis;
  if (followUpVon) prefix += `↩️ *Folgefrage — ich beziehe das auf das vorige Thema.*\n\n`;
  if (p._slotInfo && p._slotInfo.length > 0 && intents[0] !== "default") {
    prefix += `🎯 *Aus deiner Nachricht übernommen: ${p._slotInfo.join(" · ")}*\n\n`;
  }
  const ft = _detectFragetyp(userMsg);
  const fragtWo = ft === "wo_eintragen" ||
    /wo\s+(trage|gebe|fülle|trägt)\b[\s\S]{0,60}\bein|welche[rs]?\s+(anlage|zeile|formular)|in\s+welche[rms]?\s+(anlage|zeile|formular)/i.test(userMsg);
  if (fragtWo) {
    const zIntent = intents.find((i) => _ELSTER_ZEILEN[i]);
    if (zIntent) prefix += `📌 **Direktantwort:** ${_ELSTER_ZEILEN[zIntent]}\n\n`;
  }

  // 11. Dispatch (Einzel- oder Multi-Intent)
  let antwort;
  if (intents.length === 1) {
    antwort = _dispatchIntent(intents[0], p, yr, K, ia, tweaks, state, investments);
  } else {
    const filtered = intents.filter((i) => i !== "default").slice(0, 3);
    const parts = filtered.map((intent) =>
      _dispatchIntent(intent, p, yr, K, ia, tweaks, state, investments).replace(_TAG, "").trimEnd()
    );
    const header = `*${filtered.length} Themen erkannt — ich beantworte sie der Reihe nach:*\n\n`;
    antwort = header + parts.join("\n\n---\n\n") + _TAG;
  }

  // 12. Kontext für Folgefragen merken
  const primary = intents[0];
  if (primary !== "default" && primary !== "hilfe") {
    _NLU_CTX = { intent: primary, slots, ts: Date.now() };
  }
  return prefix + antwort;
}

function titleFromMessages(messages) {
  const firstUser = (messages || []).find((m) => m.role === "user");
  if (!firstUser) return "Neuer Chat";
  const txt = (firstUser.content || "").trim().replace(/\s+/g, " ");
  return txt.length > 48 ? txt.slice(0, 45) + "…" : txt || "Neuer Chat";
}

function ChatListItem({ chat, active, onSelect, onDelete }) {
  const date = new Date(chat.updatedAt || chat.createdAt || Date.now());
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  return (
    <div
      className={`bot-chat-item ${active ? "active" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="bot-chat-item-main">
        <div className="bot-chat-item-title">{chat.title || "Neuer Chat"}</div>
        <div className="bot-chat-item-sub">
          {dateStr} · {(chat.messages || []).length} Nachrichten
        </div>
      </div>
      <button
        className="bot-chat-item-del"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Chat löschen"
        aria-label="Chat löschen"
      >
        <Icon.Trash />
      </button>
    </div>
  );
}

// ── Inline-Markdown-Renderer ──────────────────────────────────────────
// Rendert die häufigsten Markdown-Muster des deterministischen Fallbacks:
//   **fett**, `code`, Tabellen (|...|), Listen (- item), Code-Blöcke
//   (Zeilen mit 4 Leerzeichen Einrückung), Absätze.
// Kein externer Dependency — pure React.
function _renderMarkdown(text) {
  if (!text) return null;

  // Inline-Elemente (fett, code, →-Pfeile) auf einem String anwenden
  function inlineRender(str) {
    // Zerlege in Segmente: **bold**, `code`, Rest
    const parts = [];
    const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[0].startsWith("**")) {
        parts.push(React.createElement("strong", { key: m.index }, m[2]));
      } else {
        parts.push(React.createElement("code", {
          key: m.index,
          style: { background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", fontFamily: "var(--font-num, monospace)" }
        }, m[3]));
      }
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
  }

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Code-Block: Zeilen mit mind. 4 Leerzeichen Einrückung ────────
    if (/^    /.test(line)) {
      const codeLines = [];
      while (i < lines.length && (/^    /.test(lines[i]) || lines[i] === "")) {
        codeLines.push(lines[i].replace(/^    /, ""));
        i++;
      }
      // Trailing-Leerzeilen entfernen
      while (codeLines.length && codeLines[codeLines.length - 1] === "") codeLines.pop();
      elements.push(
        React.createElement("pre", {
          key: `pre-${i}`,
          style: {
            background: "var(--surface-2)", borderRadius: 8,
            padding: "10px 12px", margin: "6px 0",
            fontSize: "12.5px", lineHeight: 1.55, overflowX: "auto",
            fontFamily: "var(--font-num, 'JetBrains Mono', monospace)",
            color: "var(--text)", whiteSpace: "pre",
          }
        }, codeLines.join("\n"))
      );
      continue;
    }

    // ── Tabelle: Zeilen die mit | beginnen ────────────────────────────
    if (/^\s*\|/.test(line)) {
      const tableLines = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      // Separator-Zeilen (|---|) herausfiltern
      const dataRows = tableLines.filter((l) => !/^\s*\|[-:| ]+\|\s*$/.test(l));
      if (dataRows.length === 0) continue;

      const parseRow = (l) =>
        l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

      const headerRow = parseRow(dataRows[0]);
      const bodyRows = dataRows.slice(1);

      elements.push(
        React.createElement("div", { key: `tbl-${i}`, style: { overflowX: "auto", margin: "8px 0" } },
          React.createElement("table", {
            style: { borderCollapse: "collapse", width: "100%", fontSize: "13px" }
          },
            React.createElement("thead", null,
              React.createElement("tr", null,
                headerRow.map((h, ci) =>
                  React.createElement("th", {
                    key: ci,
                    style: {
                      padding: "5px 10px", textAlign: "left",
                      borderBottom: "2px solid var(--border)",
                      color: "var(--text-faint)", fontWeight: 700,
                      fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }
                  }, inlineRender(h))
                )
              )
            ),
            React.createElement("tbody", null,
              bodyRows.map((row, ri) =>
                React.createElement("tr", {
                  key: ri,
                  style: { borderBottom: "1px solid var(--border)" }
                },
                  parseRow(row).map((cell, ci) =>
                    React.createElement("td", {
                      key: ci,
                      style: { padding: "5px 10px", verticalAlign: "top", color: "var(--text)" }
                    }, inlineRender(cell))
                  )
                )
              )
            )
          )
        )
      );
      continue;
    }

    // ── Liste: Zeilen die mit "- " beginnen ───────────────────────────
    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        React.createElement("ul", {
          key: `ul-${i}`,
          style: { margin: "4px 0 4px 18px", padding: 0, lineHeight: 1.6, fontSize: "13.5px" }
        },
          items.map((item, ii) =>
            React.createElement("li", { key: ii, style: { marginBottom: 2 } }, inlineRender(item))
          )
        )
      );
      continue;
    }

    // ── Leerzeile: Abstand ────────────────────────────────────────────
    if (line.trim() === "") {
      elements.push(React.createElement("div", { key: `sp-${i}`, style: { height: 6 } }));
      i++;
      continue;
    }

    // ── Trennlinie ---  ───────────────────────────────────────────────
    if (/^---+$/.test(line.trim())) {
      elements.push(
        React.createElement("hr", {
          key: `hr-${i}`,
          style: { border: "none", borderTop: "1px solid var(--border)", margin: "8px 0" }
        })
      );
      i++;
      continue;
    }

    // ── Normaler Absatz ───────────────────────────────────────────────
    elements.push(
      React.createElement("p", {
        key: `p-${i}`,
        style: { margin: "2px 0", lineHeight: 1.6, fontSize: "13.5px" }
      }, inlineRender(line))
    );
    i++;
  }

  return elements;
}

function MessageBubble({ role, content }) {
  const isBot = role === "assistant";
  return (
    <div className={`bot-msg bot-msg-${role}`}>
      <div className="bot-msg-bubble">
        {isBot ? _renderMarkdown(content) : content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="bot-msg bot-msg-assistant">
      <div className="bot-msg-bubble bot-msg-typing">
        <span /><span /><span />
      </div>
    </div>
  );
}

function SuggestionChips({ onPick }) {
  const suggestions = [
    "Lohnt sich meine Steuererklärung?",
    "Kann ich meinen Laptop absetzen?",
    "Wie funktioniert die Homeoffice-Pauschale?",
    "Was ist der Unterschied zwischen Erst- und Zweitstudium?",
  ];
  return (
    <div className="bot-suggestions">
      <div className="bot-suggestions-label">Vorschläge zum Start</div>
      <div className="bot-suggestions-chips">
        {suggestions.map((s) => (
          <button key={s} className="bot-suggestion-chip" onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════
// Backend-Einstellungen Panel
// ════════════════════════════════════════════════════════════════════════
function BotSettingsPanel({ backend, onClose }) {
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
    { id: "llama3.1:8b",  label: "llama3.1:8b",  badge: "⭐ Empfohlen",   desc: "Beste Balance auf M5 · Deutsch + Englisch · ~5 GB" },
    { id: "mistral:7b",   label: "mistral:7b",   badge: "⚡ Schnell",     desc: "Sehr schnelle Antworten · gutes Deutsch · ~4 GB" },
    { id: "gemma3:12b",   label: "gemma3:12b",   badge: "🧠 Präzise",    desc: "Beste Qualität · langsamer · ~8 GB RAM nötig" },
    { id: "qwen2.5:7b",   label: "qwen2.5:7b",   badge: "🌐 Mehrsprachig", desc: "Sehr gutes Deutsch · Steuerbegriffe stark · ~4 GB" },
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
          <div className="bot-header-title-main">Backend</div>
          <div className="bot-header-title-sub">SteuerBot konfigurieren</div>
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

          {/* Ollama URL */}
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
            📱 iPhone im Heimnetz: URL = IP deines Mac, z.B.{" "}
            <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
              http://192.168.1.100:11434
            </code>
            {" "}— Ollama mit{" "}
            <code style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4 }}>
              OLLAMA_HOST=0.0.0.0 ollama serve
            </code>{" "}starten.
          </div>

          {/* Modell-Name */}
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            Modell-Name
          </div>
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

          {/* Empfohlene Modelle */}
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

        {/* ── Schritt-für-Schritt Installationsguide ─────────────────── */}
        <div style={{
          marginBottom: 20, borderRadius: 12,
          border: "1px solid var(--border)", overflow: "hidden",
        }}>
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
                <li>Terminal öffnen, Modell laden:
                  <code style={{ display: "block", background: "var(--surface)", padding: "4px 8px", borderRadius: 6, margin: "4px 0", fontFamily: "monospace" }}>ollama pull llama3.1:8b</code>
                </li>
                <li>Ollama läuft automatisch im Hintergrund. URL: <code>http://localhost:11434</code></li>
              </ol>
              <div style={{ fontWeight: 700, margin: "10px 0 4px", color: "var(--text)" }}>iPhone (Heimnetz):</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Mac-IP herausfinden: <code>ifconfig | grep "inet 192"</code></li>
                <li>Ollama mit Netzwerkzugriff starten:
                  <code style={{ display: "block", background: "var(--surface)", padding: "4px 8px", borderRadius: 6, margin: "4px 0", fontFamily: "monospace" }}>OLLAMA_HOST=0.0.0.0 ollama serve</code>
                </li>
                <li>URL oben eintragen: <code>http://192.168.x.x:11434</code> (deine Mac-IP)</li>
                <li>iPhone und Mac müssen im gleichen WLAN sein</li>
              </ol>
              <div style={{
                marginTop: 10, padding: "6px 10px", borderRadius: 8,
                background: "oklch(0.95 0.03 50)", color: "oklch(0.45 0.10 50)",
                fontSize: 11,
              }}>
                ⚠️ Kein Internet nötig — alles läuft lokal. Keine Daten verlassen dein Gerät.
              </div>
            </div>
          )}
        </div>

        {/* ── Offline-Modus Status ───────────────────────────────────── */}
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "oklch(0.95 0.03 145)", border: "1px solid oklch(0.82 0.07 145)",
          fontSize: 13, color: "oklch(0.34 0.10 145)", lineHeight: 1.55, marginBottom: 20,
        }}>
          <strong>⚡ Offline-Modus immer aktiv</strong><br/>
          Wenn Ollama nicht erreichbar ist, antwortet der SteuerBot direkt aus der
          Steuer-Engine — 28 Themenbereiche, echte Berechnungen, kein Backend nötig.
          Funktioniert auch komplett offline auf dem Handy.
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

// NEU: Feature B — interviewAnswers als Prop für personalisierten Kontext
function SteuerBotModal({ open, onClose, tweaks, state, investments, interviewAnswers = {} }) {
  const [chats, setChats]       = React.useState([]);
  const [activeId, setActiveId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [draft, setDraft]       = React.useState("");
  const [busy, setBusy]         = React.useState(false);
  const [error, setError]       = React.useState(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [backend, setBackend]           = React.useState(detectBackend);
  const scrollRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  // Initial laden
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      const list = await chatList();
      setChats(list);
      if (list.length === 0) {
        // direkt einen leeren Chat starten
        setActiveId(null);
        setMessages([]);
      } else if (!activeId) {
        setActiveId(list[0].id);
        setMessages(list[0].messages || []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-scroll bei neuen Nachrichten
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Escape zum Schließen
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  function selectChat(id) {
    const c = chats.find((x) => x.id === id);
    setActiveId(id);
    setMessages(c?.messages || []);
    setSidebarOpen(false);
    setError(null);
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function deleteChat(id) {
    if (!confirm("Diesen Chat wirklich löschen?")) return;
    await chatDelete(id);
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    if (activeId === id) {
      if (next.length > 0) selectChat(next[0].id);
      else newChat();
    }
  }

  async function persistChat(nextMessages) {
    let id = activeId;
    let createdAt = Date.now();
    if (id) {
      const existing = chats.find((c) => c.id === id);
      if (existing) createdAt = existing.createdAt;
    } else {
      id = "chat_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
    const chat = {
      id,
      title: titleFromMessages(nextMessages),
      messages: nextMessages,
      createdAt,
      updatedAt: Date.now(),
    };
    try {
      await chatPut(chat);
    } catch (e) {
      console.warn("Chat speichern fehlgeschlagen:", e);
    }
    setActiveId(id);
    setChats((prev) => {
      const others = prev.filter((c) => c.id !== id);
      return [chat, ...others];
    });
  }

  async function sendMessage(text) {
    // Defense-in-depth: zu lange Eingaben werden hart abgeschnitten
    if (!text || text.trim().length === 0) return;
    if (text.length > MAX_INPUT_CHARS) {
      text = text.slice(0, MAX_INPUT_CHARS);
    }
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const after   = [...messages, userMsg];
    setMessages(after);
    setDraft("");
    setBusy(true);
    setError(null);

    // Platzhalter-Nachricht sofort einfügen (für Streaming-Updates)
    const botTs  = Date.now();
    const botMsg = { role: "assistant", content: "…", ts: botTs, streaming: true };
    setMessages([...after, botMsg]);

    try {
      const userCtx     = buildUserContext({ tweaks, state, investments, interviewAnswers });
      const system      = STEUERBOT_SYSTEM_PROMPT + "\n\n" + userCtx;
      const apiMessages = after.map((m) => ({ role: m.role, content: m.content }));

      // ── Ollama Streaming (wenn konfiguriert) ─────────────────────────
      const cfg = (typeof window.getOllamaConfig === "function") ? window.getOllamaConfig() : {};
      let reply = "";

      if (cfg.model && typeof window.ollamaStream === "function") {
        try {
          reply = await window.ollamaStream(
            cfg.url,
            cfg.model,
            system,
            apiMessages,
            (token) => {
              // Token-by-Token UI-Update via funktionales setState
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
          console.warn("[SteuerBot] Ollama Streaming-Fehler:", ollamaErr?.message);
          // Fallback auf deterministischen Kern
          const lastMsg = apiMessages[apiMessages.length - 1]?.content || "";
          reply = deterministicSteuerAntwort(lastMsg, { tweaks, state, investments, interviewAnswers });
        }
      } else {
        // ── Deterministischer Fallback (immer verfügbar) ─────────────────
        const lastMsg = apiMessages[apiMessages.length - 1]?.content || "";
        reply = deterministicSteuerAntwort(lastMsg, { tweaks, state, investments, interviewAnswers });
      }

      const finalMsg = { role: "assistant", content: reply || "(leere Antwort)", ts: botTs };
      const next = [...after, finalMsg];
      setMessages(next);
      await persistChat(next);
    } catch (e) {
      const msg = e?.message || String(e);
      setMessages(after); // Platzhalter entfernen
      if (msg === "NO_BACKEND") {
        setError("NO_BACKEND");
      } else {
        setError(msg);
      }
      await persistChat(after);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    const t = draft.trim();
    if (!t || busy) return;
    sendMessage(t);
  }

  function handleKeyDown(e) {
    // Enter sendet, Shift+Enter fügt Zeilenumbruch ein
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="bot-backdrop" onClick={onClose}>
      <div className="bot-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="SteuerBot">
        {/* Header */}
        <div className="bot-header">
          <button
            className="bot-header-menu"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Chats anzeigen"
            title="Chat-Verlauf"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="bot-header-title">
            <div className="bot-header-title-main">SteuerBot</div>
            <div className="bot-header-title-sub">Fragen zur deutschen Einkommensteuer</div>
          </div>
          <button className="bot-header-settings" onClick={() => setSettingsOpen((v) => !v)} title="KI-Backend konfigurieren" aria-label="Einstellungen" style={{
            width: 32, height: 32, border: "1px solid var(--border)",
            background: backend.type === "none" ? "oklch(0.95 0.06 50)" : "var(--surface)",
            color: backend.type === "none" ? "oklch(0.55 0.16 50)" : "var(--text-muted)",
            borderRadius: 10, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className="bot-header-new" onClick={newChat} title="Neuer Chat" aria-label="Neuer Chat">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="bot-header-close" onClick={onClose} aria-label="Schließen">
            <Icon.Close />
          </button>
        </div>

        {/* Sidebar (overlays content on mobile) */}
        {sidebarOpen && (
          <div className="bot-sidebar" onClick={() => setSidebarOpen(false)}>
            <div className="bot-sidebar-inner" onClick={(e) => e.stopPropagation()}>
              <div className="bot-sidebar-header">
                <span>Gespeicherte Chats</span>
                <button className="bot-sidebar-new" onClick={newChat}>+ Neu</button>
              </div>
              {chats.length === 0 ? (
                <div className="bot-sidebar-empty">Noch keine gespeicherten Chats.</div>
              ) : (
                <div className="bot-chat-list">
                  {chats.map((c) => (
                    <ChatListItem
                      key={c.id}
                      chat={c}
                      active={c.id === activeId}
                      onSelect={() => selectChat(c.id)}
                      onDelete={() => deleteChat(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backend-Einstellungen */}
        {settingsOpen && (
          <BotSettingsPanel
            backend={backend}
            onClose={() => { setSettingsOpen(false); setBackend(detectBackend()); setError(null); }}
          />
        )}

        {/* Konversation */}
        <div className="bot-scroll" ref={scrollRef}>
          {empty ? (
            <div className="bot-empty">
              <div className="bot-empty-emoji">⚖️</div>
              <div className="bot-empty-title">SteuerBot DE</div>
              <div className="bot-empty-sub">
                Frag mich zu Werbungskosten, Homeoffice, Pendler­pauschale, ETFs,
                Steuererklärung oder Studenten-Sonderregeln. Ich kenne dein
                Steuer-Profil und deine erfassten Belege.
              </div>
              <SuggestionChips onPick={sendMessage} />
            </div>
          ) : (
            <div className="bot-msgs">
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} />
              ))}
              {busy && <TypingIndicator />}
            </div>
          )}
          {error ? (
            <div className="bot-error">
              <strong>Fehler:</strong> {error}
            </div>
          ) : null}
        </div>

        {/* Composer */}
        <form className="bot-composer" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="bot-input"
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length <= MAX_INPUT_CHARS) setDraft(v);
            }}
            onKeyDown={handleKeyDown}
            placeholder={busy ? "Antwort wird generiert…" : "Frag SteuerBot…"}
            rows={1}
            maxLength={MAX_INPUT_CHARS}
            disabled={busy}
          />
          {draft.length > MAX_INPUT_CHARS * 0.85 && (
            <div className="bot-input-counter" style={{
              position: "absolute",
              bottom: 54,
              right: 56,
              fontSize: "11px",
              color: draft.length >= MAX_INPUT_CHARS ? "oklch(0.50 0.18 25)" : "var(--text-faint)",
              fontVariantNumeric: "tabular-nums",
              pointerEvents: "none",
            }}>
              {draft.length}/{MAX_INPUT_CHARS}
            </div>
          )}
          <button
            type="submit"
            className="bot-send"
            disabled={busy || !draft.trim() || draft.length > MAX_INPUT_CHARS}
            aria-label="Senden"
            title="Senden (Enter)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>

        <div className="bot-disclaimer">
          Keine Steuerberatung. Bei wichtigen Entscheidungen Steuerberater konsultieren.
        </div>
      </div>
    </div>
  );
}

// Exports — nur die UI-Komponente wird global benötigt.
// buildUserContext, STEUERBOT_SYSTEM_PROMPT, chatList/Put/Delete
// sind interne Implementierungsdetails und bleiben im Modul-Scope.
(function _secureExport() {
  try {
    Object.defineProperty(window, "SteuerBotModal", {
      value: SteuerBotModal, writable: false, configurable: false, enumerable: true,
    });
  } catch { window.SteuerBotModal = SteuerBotModal; }
})();
