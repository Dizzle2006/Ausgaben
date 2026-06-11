/* global React, fmtEUR, getK, Icon, buildUserProfile, calcGrenzsteuersatz, calcZumutbareEigenbelastung */
//
// ════════════════════════════════════════════════════════════════════════
// tax-optimizer.jsx — Steuer-Schlupfloch-Finder
// ════════════════════════════════════════════════════════════════════════
//
// Proaktive Analyse aller Optimierungspotenziale eines Arbeitnehmers auf
// Basis echter App-Daten (receipts, tweaks, investments, interviewAnswers).
//
// Exporte (window):
//   • findOpportunities({ tweaks, receipts, investments, interviewAnswers, year })
//   • TaxOptimizer({ tweaks, receipts, investments, interviewAnswers, year, onClose, open })
//   • OptimizerFAB({ count, onClick })
//
// Alle Berechnungen sind vereinfacht (Grenzsteuersatz-Näherung) und
// dienen der Priorisierung — keine Steuerberatung.
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// CSS (alle neuen Klassen mit .opt- prefixed; wiederverwendete Klassen
// .lohnt/.action/.warn/.info kommen aus styles.css)
// ════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
// Hilfsfunktionen
// ════════════════════════════════════════════════════════════════════════

// Sicherer Receipt-Filter (Jahr + Kategorie)
function receiptsOf(receipts, year, predicate) {
  const y = String(year);
  return (receipts || []).filter(r => (r.datum || "").startsWith(y) && predicate(r));
}
function sumBetrag(rows) {
  return rows.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
}

// Round to whole Euro
const r0 = x => Math.round(Number(x) || 0);

// Standard-Disclaimer (in jeder Card)
const DISCLAIMER = "Für deinen konkreten Fall empfiehlt sich ein Steuerberater.";

// ════════════════════════════════════════════════════════════════════════
// Opportunity Engine — Profil-basiert, mit Gates
// ════════════════════════════════════════════════════════════════════════

// Pendlerpauschale berechnen (wiederverwendbar)
function _pendler(km, tage, K) {
  if (!km || !tage) return 0;
  const k1 = Math.min(km, 20);
  const k2 = Math.max(0, km - 20);
  return r0(tage * (k1 * K.entfernung_km_bis_20 + k2 * K.entfernung_km_ab_21));
}

// Grenzsteuersatz — präzise Berechnung mit echten Profildaten
// Nimmt das vollständige UserProfile entgegen (aus buildUserProfile).
// Fallback auf Brutto-only-Näherung wenn kein Profil vorhanden.
function _calcPreciseGST(profileOrBrutto, year) {
  // Backward-compat: direkter Brutto-Aufruf
  if (typeof profileOrBrutto === "number") {
    const brutto = profileOrBrutto;
    if (!brutto) return 0.14;
    if (typeof calcGrenzsteuersatz !== "function") return brutto < 20000 ? 0.20 : 0.30;
    const K = (typeof getK === "function" ? getK(year) : null) || {};
    const wkP = K.wk_pauschale;
    const zvE = Math.max(0, brutto * 0.80 - wkP);
    return Math.min(0.45, Math.max(0.14, calcGrenzsteuersatz(zvE, String(year))));
  }

  // Vollständiges Profil-Objekt
  const profile = profileOrBrutto;
  const brutto = profile?.brutto || 0;
  const ia = profile?._ia || {};
  if (!brutto) return 0.14;
  if (typeof calcGrenzsteuersatz !== "function") return brutto < 20000 ? 0.20 : 0.30;
  const yr = Number(year) || new Date().getFullYear();
  // getK() gibt immer ein gültiges Objekt zurück (INLINE_BOOTSTRAP als Fallback)
  const K = getK(yr);

  // Sozialversicherung: AN-Anteil mit BBG-Kappung
  // BBG-Werte kommen ausschließlich aus Config — kein hardcoded Fallback
  const bbg_kv = K.bbg_kv_monatlich * 12;
  const bbg_rv = K.bbg_rv_monatlich * 12;
  const kv_basis = Math.min(brutto, bbg_kv);
  const rv_basis = Math.min(brutto, bbg_rv);
  // SV-Sätze ausschließlich aus Config (keine hardcoded Werte)
  const _svCfg = (window.TAX_CONFIG_RAW || {}).sv_saetze_an || {};
  const _svKv = _svCfg.kv;
  const _svRvAlv = _svCfg.rv + _svCfg.alv; // RV + ALV
  const _svPv = _svCfg.pv; // Standard (mit Kindern)
  const sv = Math.round(kv_basis * _svKv + rv_basis * _svRvAlv + kv_basis * _svPv);

  // Abzüge: WK-Pauschale + SA-Pauschale
  const wkP = K.wk_pauschale;
  const saP = K.sonderausgaben_pauschale;
  const gf = K.grundfreibetrag;

  // Tatsächliche Vorsorgeaufwendungen wenn bekannt
  const kv_abzug = Number(ia.kv_beitrag_jahres) || 0;
  // Riester-Max aus Config (K enthält INLINE_BOOTSTRAP als Fallback — kein hardcoded Wert nötig)
  const _riesterMaxSA = K.riester_max_sa_abzug;
  const riester_abzug = Math.min(Number(ia.riester_eigenanteil) || 0, _riesterMaxSA);
  let zvE = brutto - sv - wkP - saP - kv_abzug - riester_abzug;
  zvE = Math.max(0, zvE - gf);
  const gst = calcGrenzsteuersatz(zvE, String(yr));
  return Math.min(0.45, Math.max(0.14, gst));
}

// Compat-Alias (alter Name, wird intern noch verwendet)
function _approxGST(brutto, year) {
  return _calcPreciseGST(brutto, year);
}

// NEU: Feature 1 — ROI-Score
// Formel: (ersparnis / aufwand_faktor) × konfidenz_faktor × status_mod
const AUFWAND_FAKTOR = {
  niedrig: 1.0,
  mittel: 1.8,
  hoch: 3.5
};
function calcROIScore(op) {
  if (op.status === "done") return -1;
  const basis = (op.ersparnis || 0) / (AUFWAND_FAKTOR[op.aufwand] || 1.8);
  const konfidenz = op.istGeschaetzt ? 0.4 : 1.0;
  const statusMod = op.status === "lohnt" ? 1.2 : op.status === "warn" ? 0.8 : 1.0;
  return Math.round(basis * konfidenz * statusMod);
}

/**
 * findOpportunities(profile, receipts, investments, year)
 *
 * Nimmt ein vollständiges UserProfile (aus buildUserProfile) entgegen.
 * Jede Opportunity prüft zuerst ob sie für dieses Profil gilt.
 * Nicht passende → in profile.ausgeschlossenePositionen (bereits gesetzt).
 */
function findOpportunities(profile, receipts, investments, year) {
  // Backward-compat: altes Aufruf-Schema { tweaks, receipts, interviewAnswers, year }
  if (profile && typeof profile === "object" && (profile.tweaks !== undefined || profile.interviewAnswers !== undefined)) {
    const {
      tweaks = {},
      receipts: r2 = [],
      investments: i2 = {},
      interviewAnswers = {},
      year: y2
    } = profile;
    if (typeof buildUserProfile !== "function") return [{
      __noData: true
    }];
    const p = buildUserProfile(interviewAnswers, tweaks);
    return findOpportunities(p, r2, i2, y2 || year);
  }
  if (!profile || !profile.beschaeftigung) return [{
    __noData: true
  }];
  const yr = Number(year) || new Date().getFullYear();
  // getK() gibt immer ein gültiges Objekt zurück (INLINE_BOOTSTRAP als Fallback)
  const Kget = getK(yr);
  const {
    beschaeftigung,
    studium,
    einkunftsarten,
    familienstand,
    kinder,
    brutto,
    _ia: ia = {}
  } = profile;
  if (!brutto) return [{
    __noData: true
  }];

  // Präziser Grenzsteuersatz mit vollständigem Profil (SV-Kappung, tatsächl. Vorsorgeaufwendungen)
  const gst = _calcPreciseGST(profile, yr);
  const verheiratet = familienstand === "verheiratet";
  const istAN = einkunftsarten.lohnarbeit;
  const hatAusbildung = studium && studium.hatAusbildungsverhaeltnis;
  const istStudent = ["student_dual", "student_trial", "student_voll"].includes(beschaeftigung);
  const istSelbst = einkunftsarten.selbststaendig;
  const istRente = beschaeftigung === "rente";
  const istAzubi = beschaeftigung === "azubi";
  const ops = [];

  // NEU: Feature 3 — Mehrjahres-Analyse: Rückwirkende Steuererklärungen
  const offeneJahre = Number(ia.offene_steuerjahre) || 0;
  if (offeneJahre > 0 && ia.offene_steuerjahre !== "alle") {
    const DURCHSCHNITT_ERSTATTUNG = 1100;
    const geschaetztGesamt = offeneJahre * DURCHSCHNITT_ERSTATTUNG;
    const aktuellesJahr = new Date().getFullYear();
    const offeneJahresListe = Array.from({
      length: offeneJahre
    }, (_, i) => String(aktuellesJahr - 1 - i)).reverse();
    ops.push({
      id: "rueckwirkende_erklaerungen",
      kategorie: "mehrjahres",
      titel: `Rückwirkende Steuererklärungen (${offeneJahresListe.join(", ")})`,
      beschreibung: `${offeneJahre} Jahr${offeneJahre > 1 ? "e" : ""} noch offen → Ø-Erstattung ${fmtEUR(DURCHSCHNITT_ERSTATTUNG)}/Jahr = geschätzt ${fmtEUR(geschaetztGesamt)} Gesamt-Nacherstattung möglich.`,
      ersparnis: geschaetztGesamt,
      aufwand: "hoch",
      paragraph: "§ 46 EStG (Veranlagungsantrag)",
      anlage: "Alle relevanten Anlagen",
      status: "warn",
      aktion: `Sofort beginnen: ${offeneJahresListe.join(", ")} — Frist läuft jeweils 4 Jahre nach Ablauf des Steuerjahres. ELSTER.de nutzen.`,
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 0,
      istGeschaetzt: true,
      detail_zahlen: {
        "Offene Jahre": offeneJahresListe.join(", "),
        "Ø Erstattung": fmtEUR(DURCHSCHNITT_ERSTATTUNG) + " / Jahr",
        "Gesamt-Potenzial": fmtEUR(geschaetztGesamt),
        "Letzte Einreichmöglichkeit": `31.12.${aktuellesJahr + (4 - offeneJahre)}`
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // WERBUNGSKOSTEN / Anlage N
  // ──────────────────────────────────────────────────────────────────

  // (1) Pendlerpauschale — AN, Student_dual/trial, Azubi
  if (profile.abzugsfaehigePositionen.pendlerpauschale) {
    const km = Number(ia.entfernung_km) || 0;
    const at = Number(ia.arbeitstage) || 0;
    const ho = Number(ia.homeoffice_tage) || 0;
    if (km > 0 && at > 0) {
      const pendlertage = Math.max(0, at - ho);
      const pendler = _pendler(km, pendlertage, Kget);
      if (pendler > 0) {
        ops.push({
          id: "pendler_pauschale",
          kategorie: "werbungskosten",
          titel: "Pendlerpauschale",
          beschreibung: `${km} km × ${pendlertage} Pendlertage = ${fmtEUR(pendler)}.`,
          ersparnis: r0(pendler * gst),
          aufwand: "niedrig",
          paragraph: "§ 9 Abs. 1 Nr. 4 EStG",
          anlage: "Anlage N",
          status: pendler > Kget.wk_pauschale ? "lohnt" : "info",
          aktion: "Entfernung und Pendlertage in Anlage N, Zeile 31 ff. eintragen.",
          belege_noetig: false,
          bereits_erfasst: false,
          prioritaet: 1,
          istGeschaetzt: false,
          detail_zahlen: {
            "Entfernung": km + " km",
            "Pendlertage": String(pendlertage),
            "Summe": fmtEUR(pendler)
          }
        });
      }
    }
  }

  // (2) Homeoffice-Pauschale — AN, beides, student_dual/trial
  if (profile.abzugsfaehigePositionen.homeoffice) {
    const hoTage = Number(ia.homeoffice_tage) || 0;
    if (hoTage > 0) {
      const anrechenbar = Math.min(hoTage, Kget.homeoffice_max_tage);
      const ho = r0(anrechenbar * Kget.homeoffice_pro_tag);
      ops.push({
        id: "homeoffice_pauschale",
        kategorie: "werbungskosten",
        titel: "Homeoffice-Pauschale",
        beschreibung: `${hoTage} HO-Tage × ${Kget.homeoffice_pro_tag} € = ${fmtEUR(ho)}.${hoTage > Kget.homeoffice_max_tage ? " (auf " + Kget.homeoffice_max_tage + " Tage gekürzt)" : ""}`,
        ersparnis: r0(ho * gst),
        aufwand: "niedrig",
        paragraph: "§ 4 Abs. 5 Satz 1 Nr. 6c EStG",
        anlage: "Anlage N",
        status: "lohnt",
        aktion: "HO-Tage in Anlage N, Zeile 44 eintragen.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: false,
        detail_zahlen: {
          "HO-Tage": String(hoTage),
          "Anrechenbar": anrechenbar + " Tage",
          "Summe": fmtEUR(ho)
        }
      });
    }
  }

  // ── STUDENTEN: Fahrtkosten 3-Orte-Logik ──────────────────────────────
  if (studium) {
    const {
      typ,
      tageImBetrieb,
      tageBerufsschule,
      tageUni,
      kmZumBetrieb,
      kmZurBerufsschule,
      kmZurUni
    } = studium;
    const saMax = window.TAX_CONFIG_RAW?.studenten?.erststudium_sonderausgaben_max ?? 6000;
    let saVerbraucht = 0;

    // (3a) Betrieb-Fahrtkosten → immer WK (Pendlerpauschale)
    if (kmZumBetrieb > 0 && tageImBetrieb > 0) {
      const betriebPendler = _pendler(kmZumBetrieb, tageImBetrieb, Kget);
      if (betriebPendler > 0) {
        ops.push({
          id: "betrieb_fahrtkosten",
          kategorie: "werbungskosten",
          titel: "Fahrtkosten zum Betrieb",
          beschreibung: `${kmZumBetrieb} km × ${tageImBetrieb} Betriebstage = ${fmtEUR(betriebPendler)} — immer Werbungskosten (§ 9 EStG), unabhängig vom Studiumstyp.`,
          ersparnis: r0(betriebPendler * gst),
          aufwand: "niedrig",
          paragraph: "§ 9 Abs. 1 Nr. 4 EStG",
          anlage: "Anlage N",
          status: "lohnt",
          aktion: "Betriebstage und km in Anlage N eintragen.",
          belege_noetig: false,
          bereits_erfasst: false,
          prioritaet: 1,
          istGeschaetzt: false,
          detail_zahlen: {
            "Betriebstage": String(tageImBetrieb),
            "km": String(kmZumBetrieb),
            "Summe": fmtEUR(betriebPendler)
          }
        });
      }
    }

    // (3b) Berufsschule-Fahrtkosten → WK (beruflich veranlasst)
    if (kmZurBerufsschule > 0 && tageBerufsschule > 0) {
      const bsPendler = _pendler(kmZurBerufsschule, tageBerufsschule, Kget);
      if (bsPendler > 0) {
        ops.push({
          id: "berufsschule_fahrtkosten",
          kategorie: "werbungskosten",
          titel: "Fahrtkosten zur Berufsschule",
          beschreibung: `${kmZurBerufsschule} km × ${tageBerufsschule} BS-Tage = ${fmtEUR(bsPendler)}.` + (istAzubi ? " Beachte: Berufsschule kann erste Tätigkeitsstätte sein (BFH) → Pendlerpauschale, kein Reisekostenrecht." : " Beruflich veranlasst → Werbungskosten (§ 9 EStG)."),
          ersparnis: r0(bsPendler * gst),
          aufwand: "niedrig",
          paragraph: "§ 9 Abs. 1 Nr. 4 EStG",
          anlage: "Anlage N",
          status: "lohnt",
          aktion: "Berufsschultage und km in Anlage N eintragen.",
          belege_noetig: false,
          bereits_erfasst: false,
          prioritaet: 2,
          istGeschaetzt: false,
          detail_zahlen: {
            "BS-Tage": String(tageBerufsschule),
            "km": String(kmZurBerufsschule),
            "Summe": fmtEUR(bsPendler)
          }
        });
      }
    }

    // (3c) Uni-Fahrtkosten: nach Studiumstyp
    if (kmZurUni > 0 && tageUni > 0) {
      const uniPendler = _pendler(kmZurUni, tageUni, Kget);
      if (uniPendler > 0) {
        if (typ === "erst") {
          const saBetrag = Math.min(uniPendler, Math.max(0, saMax - saVerbraucht));
          saVerbraucht += saBetrag;
          ops.push({
            id: "uni_fahrtkosten_sa",
            kategorie: "sonderausgaben",
            titel: "Uni-Fahrtkosten (Sonderausgaben — Erststudium)",
            beschreibung: `${fmtEUR(uniPendler)} Fahrtkosten, als Sonderausgaben ansetzbar (max. ${fmtEUR(saMax)} Gesamtlimit Studienkosten). Erststudium: kein WK-Abzug.`,
            ersparnis: r0(saBetrag * gst),
            aufwand: "niedrig",
            paragraph: "§ 10 Abs. 1 Nr. 7 EStG",
            anlage: "Mantelbogen",
            status: saBetrag > 0 ? "lohnt" : "info",
            aktion: "Studienkosten-Sonderausgaben im Mantelbogen eintragen (Gesamtlimit 6.000 €).",
            belege_noetig: false,
            bereits_erfasst: false,
            prioritaet: 3,
            istGeschaetzt: false,
            detail_zahlen: {
              "Uni-Tage": String(tageUni),
              "km": String(kmZurUni),
              "Fahrtkosten": fmtEUR(uniPendler),
              "Als SA anrechenbar": fmtEUR(saBetrag)
            }
          });
        } else {
          ops.push({
            id: "uni_fahrtkosten_wk",
            kategorie: "werbungskosten",
            titel: "Uni-Fahrtkosten (Werbungskosten — Zweitstudium/WB)",
            beschreibung: `${fmtEUR(uniPendler)} voll absetzbar als Werbungskosten. Zweitstudium/Weiterbildung: kein Deckel, Verlustvortrag möglich.`,
            ersparnis: r0(uniPendler * gst),
            aufwand: "niedrig",
            paragraph: "§ 9 Abs. 1 EStG",
            anlage: "Anlage N",
            status: "lohnt",
            aktion: "Uni-Tage und km in Anlage N eintragen. Bei negativem zvE: Verlustvortrag beantragen.",
            belege_noetig: false,
            bereits_erfasst: false,
            prioritaet: 2,
            istGeschaetzt: false,
            detail_zahlen: {
              "Uni-Tage": String(tageUni),
              "km": String(kmZurUni),
              "Summe": fmtEUR(uniPendler)
            }
          });
        }
      }
    }

    // (3d) Studienmaterial / Lehrmittel
    const wkStudiBelege = sumBetrag(receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten"));
    if (wkStudiBelege > 0) {
      const kategorie = typ === "erst" ? "sonderausgaben" : "werbungskosten";
      const saStudiBetrag = typ === "erst" ? Math.min(wkStudiBelege, Math.max(0, saMax - saVerbraucht)) : wkStudiBelege;
      saVerbraucht += typ === "erst" ? saStudiBetrag : 0;
      ops.push({
        id: "studium_material",
        kategorie,
        titel: typ === "erst" ? "Studienmaterial (Sonderausgaben)" : "Studienmaterial (Werbungskosten)",
        beschreibung: `${fmtEUR(wkStudiBelege)} Belege.${typ === "erst" ? " Als Sonderausgaben (Gesamtlimit 6.000 €)" : " Voll als Werbungskosten absetzbar."}`,
        ersparnis: r0(saStudiBetrag * gst),
        aufwand: "niedrig",
        paragraph: typ === "erst" ? "§ 10 Abs. 1 Nr. 7 EStG" : "§ 9 Abs. 1 EStG",
        anlage: typ === "erst" ? "Mantelbogen" : "Anlage N",
        status: "lohnt",
        aktion: "Belege aufbewahren und in der richtigen Anlage eintragen.",
        belege_noetig: true,
        bereits_erfasst: true,
        prioritaet: 3,
        istGeschaetzt: false
      });
    }

    // (3e) Verlustvortrag-Hinweis bei Zweitstudium
    if ((typ === "zweit" || typ === "weiterbildung") && brutto < 15000) {
      ops.push({
        id: "verlustvortrag_student",
        kategorie: "werbungskosten",
        titel: "Verlustvortrag prüfen (Zweitstudium)",
        beschreibung: "Bei Zweit-/Weiterbildungsstudium können Werbungskosten > Einnahmen einen Verlust ergeben, der bis zu 7 Jahre rückwirkend vorgetragen werden kann.",
        ersparnis: 0,
        aufwand: "mittel",
        paragraph: "§ 10d EStG, § 9 EStG",
        anlage: "Anlage N / Feststellungserklärung",
        status: "action",
        aktion: "Feststellungserklärung abgeben wenn zvE negativ. Verlustvortrag entsteht automatisch.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 3,
        istGeschaetzt: false
      });
    }

    // (3f) Anteilige Arbeitstage-Hinweis
    if (tageImBetrieb + tageBerufsschule + tageUni > 0) {
      const gesamtTage = tageImBetrieb + tageBerufsschule + tageUni;
      ops.push({
        id: "arbeitstage_anteilig",
        kategorie: "werbungskosten",
        titel: "Arbeitstage korrekt aufteilen",
        beschreibung: `Nicht pauschal 220 Tage, sondern exakt: ${tageImBetrieb} Betrieb + ${tageBerufsschule} Berufsschule + ${tageUni} Uni = ${gesamtTage} Tage. Jeder Lernort hat eigene steuerliche Einordnung.`,
        ersparnis: 0,
        aufwand: "niedrig",
        paragraph: "§ 9 Abs. 1 Nr. 4 EStG",
        anlage: "Anlage N",
        status: "info",
        aktion: "Tage-Aufteilung im Kalender oder aus Stundenplan/Ausbildungsplan dokumentieren.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 9,
        istGeschaetzt: false
      });
    }
  }

  // ── STUDENTEN MIT AUSBILDUNG: WK-Pauschalen-Vergleich ────────────────
  if (hatAusbildung && studium) {
    const betriebPendler = studium.kmZumBetrieb > 0 && studium.tageImBetrieb > 0 ? _pendler(studium.kmZumBetrieb, studium.tageImBetrieb, Kget) : 0;
    const bsPendler = studium.kmZurBerufsschule > 0 && studium.tageBerufsschule > 0 ? _pendler(studium.kmZurBerufsschule, studium.tageBerufsschule, Kget) : 0;
    const hoTage = Number(ia.homeoffice_tage) || 0;
    const hoSum = r0(Math.min(hoTage, Kget.homeoffice_max_tage) * Kget.homeoffice_pro_tag);
    const wkBelege = sumBetrag(receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten"));
    const uniWK = studium.typ !== "erst" && studium.kmZurUni > 0 && studium.tageUni > 0 ? _pendler(studium.kmZurUni, studium.tageUni, Kget) : 0;
    const wkGesamt = r0(betriebPendler + bsPendler + hoSum + uniWK + wkBelege);
    const ueber = wkGesamt - Kget.wk_pauschale;
    if (ueber > 0) {
      ops.push({
        id: "student_wk_einzelabrechnung",
        kategorie: "werbungskosten",
        titel: "Einzelabrechnung lohnt sich (Ausbildung)",
        beschreibung: `Deine Werbungskosten (${fmtEUR(wkGesamt)}) übersteigen die Pauschale (${fmtEUR(Kget.wk_pauschale)}) um ${fmtEUR(ueber)}. Einzeln abrechnen bringt mehr.`,
        ersparnis: r0(ueber * gst),
        aufwand: "mittel",
        paragraph: "§ 9a Satz 1 Nr. 1a EStG",
        anlage: "Anlage N",
        status: "lohnt",
        aktion: "Alle Einzelposten (Betrieb, Berufsschule, Homeoffice, Belege) in Anlage N eintragen statt Pauschale.",
        belege_noetig: wkBelege > 0,
        bereits_erfasst: wkBelege > 0,
        prioritaet: 1,
        istGeschaetzt: false,
        detail_zahlen: {
          "Betrieb-Fahrtkosten": fmtEUR(betriebPendler),
          "BS-Fahrtkosten": fmtEUR(bsPendler),
          "Homeoffice-Pauschale": fmtEUR(hoSum),
          "Uni-Fahrtkosten (WK)": fmtEUR(uniWK),
          "Belege WK": fmtEUR(wkBelege),
          "Summe": fmtEUR(wkGesamt),
          "vs. Pauschale": `+ ${fmtEUR(ueber)}`
        }
      });
    } else if (wkGesamt > 0) {
      ops.push({
        id: "student_wk_pauschale_reicht",
        kategorie: "werbungskosten",
        titel: "WK-Pauschale reicht (Ausbildung)",
        beschreibung: `Deine WK (${fmtEUR(wkGesamt)}) liegen unter der Pauschale (${fmtEUR(Kget.wk_pauschale)}). Du bekommst die Pauschale automatisch — Einzelabrechnung lohnt nicht. Noch ${fmtEUR(Kget.wk_pauschale - wkGesamt)} bis der Vorteil beginnt.`,
        ersparnis: 0,
        aufwand: "niedrig",
        paragraph: "§ 9a EStG",
        anlage: "Anlage N",
        status: "info",
        aktion: "Keine Aktion nötig — Pauschale wird automatisch gewährt.",
        belege_noetig: false,
        bereits_erfasst: true,
        prioritaet: 9,
        istGeschaetzt: false
      });
    }
  }

  // ── MINIJOB-GRENZE: Hinweis bei Ausbildungsvergütung unter Freigrenze ──
  if (hatAusbildung || istAN) {
    const minijobGrenze = window.TAX_CONFIG_RAW?.minijob_grenze_monatlich?.[String(yr)] || Kget.minijob_grenze;
    const monatsBrutto = brutto / 12;
    if (monatsBrutto > 0 && monatsBrutto <= minijobGrenze) {
      ops.push({
        id: "minijob_grenze_hinweis",
        kategorie: "bonus",
        titel: "Ausbildungsvergütung im Minijob-Bereich",
        beschreibung: `Dein monatliches Brutto (${fmtEUR(Math.round(monatsBrutto))}) liegt unter der Minijob-Grenze (${fmtEUR(minijobGrenze)}/Monat für ${yr}). Damit bist du sozialversicherungsfrei — kein AN-Anteil KV/RV/ALV/PV. Du kannst aber freiwillig in die Rentenversicherung einzahlen (Mindestbeitrag ~${fmtEUR(Math.round(minijobGrenze * 0.186))}/Monat) um Wartezeiten zu erfüllen.`,
        ersparnis: 0,
        aufwand: "niedrig",
        paragraph: "§ 8 SGB IV, § 7 SGB VI",
        anlage: "—",
        status: "info",
        aktion: "Sozialversicherungsfreiheit beim Arbeitgeber bestätigen lassen. Bei Interesse an freiwilliger RV: Deutsche Rentenversicherung kontaktieren.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 4,
        istGeschaetzt: false,
        detail_zahlen: {
          "Monatsbrutto": fmtEUR(Math.round(monatsBrutto)),
          "Minijob-Grenze": fmtEUR(minijobGrenze) + "/Monat",
          "Jahr": String(yr),
          "Freiwillige RV": `möglich ab ~${fmtEUR(Math.round(minijobGrenze * 0.186))}/Monat`
        }
      });
    } else if (monatsBrutto > minijobGrenze && monatsBrutto <= minijobGrenze * 1.5) {
      ops.push({
        id: "midijob_hinweis",
        kategorie: "bonus",
        titel: "Midijob-Übergangsbereich",
        beschreibung: `Dein Brutto liegt im Übergangsbereich (${fmtEUR(minijobGrenze)}–${fmtEUR(Math.round(minijobGrenze * 1.5))}/Monat). Dort gelten reduzierte AN-SV-Beiträge (gleitende Skala). Dein Netto ist höher als bei vollem SV-Beitrag.`,
        ersparnis: 0,
        aufwand: "niedrig",
        paragraph: "§ 20 SGB IV",
        anlage: "—",
        status: "info",
        aktion: "Keine Aktion nötig — AG rechnet automatisch korrekt ab. Auf Gehaltsabrechnung als 'Übergangsbereich' ausgewiesen.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 6,
        istGeschaetzt: false
      });
    }
  }

  // ── SELBSTSTÄNDIGE: Betriebsausgaben ─────────────────────────────────
  if (istSelbst) {
    const km = Number(ia.entfernung_km) || 0;
    const at = Number(ia.arbeitstage) || 0;
    if (km > 0 && at > 0) {
      // Km-Satz aus Config (jahresabhängig: ab 2026 einheitlich 0,38 €/km)
      const _kmSatzBA = yr >= 2026 ? Kget.entfernung_km_ab_21 : Kget.entfernung_km_bis_20;
      const fahrtkostenBA = r0(km * 2 * at * _kmSatzBA);
      ops.push({
        id: "selbst_fahrtkosten_ba",
        kategorie: "werbungskosten",
        titel: "Fahrtkosten als Betriebsausgaben",
        beschreibung: `${km} km × 2 × ${at} Tage × ${_kmSatzBA.toFixed(2).replace(".", ",")} € = ${fmtEUR(fahrtkostenBA)} Betriebsausgaben (§ 4 Abs. 4 EStG). Nicht Pendlerpauschale!`,
        ersparnis: r0(fahrtkostenBA * gst),
        aufwand: "niedrig",
        paragraph: "§ 4 Abs. 4 EStG, § 4 Abs. 5 Nr. 6 EStG",
        anlage: "Anlage G / S",
        status: "lohnt",
        aktion: "Fahrten-Nachweis führen (Fahrtenbuch oder Schätzung mit Beleg).",
        belege_noetig: true,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: false,
        detail_zahlen: {
          "km (einfach)": String(km),
          "Tage": String(at),
          "Satz": "0,30 €/km",
          "Summe": fmtEUR(fahrtkostenBA)
        }
      });
    }
    const hoTage = Number(ia.homeoffice_tage) || 0;
    if (hoTage > 0) {
      const hoBA = r0(Math.min(hoTage, Kget.homeoffice_max_tage) * Kget.homeoffice_pro_tag);
      ops.push({
        id: "selbst_homeoffice",
        kategorie: "werbungskosten",
        titel: "Homeoffice-Tagespauschale (Betriebsausgaben)",
        beschreibung: `${Math.min(hoTage, Kget.homeoffice_max_tage)} Tage × ${Kget.homeoffice_pro_tag} € = ${fmtEUR(hoBA)} als Betriebsausgaben.`,
        ersparnis: r0(hoBA * gst),
        aufwand: "niedrig",
        paragraph: "§ 4 Abs. 5 Satz 1 Nr. 6c EStG",
        anlage: "Anlage G / S",
        status: "lohnt",
        aktion: "Tage in Anlage G/S eintragen (alternativ: dediziertes Arbeitszimmer als BA).",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: false
      });
    }
    const baBelege = sumBetrag(receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten"));
    if (baBelege > 0) {
      ops.push({
        id: "betriebsausgaben",
        kategorie: "werbungskosten",
        titel: "Betriebsausgaben (Belege erfasst)",
        beschreibung: `${fmtEUR(baBelege)} als Betriebsausgaben erfasst — mindern Gewinn direkt.`,
        ersparnis: r0(baBelege * gst),
        aufwand: "niedrig",
        paragraph: "§ 4 Abs. 4 EStG",
        anlage: "Anlage G / S",
        status: "lohnt",
        aktion: "Alle Belege in EÜR-Rechnung unter Betriebsausgaben aufführen.",
        belege_noetig: true,
        bereits_erfasst: true,
        prioritaet: 1,
        istGeschaetzt: false
      });
    }
    ops.push({
      id: "selbst_ust_hinweis",
      kategorie: "bonus",
      titel: "Umsatzsteuer-Voranmeldung prüfen",
      beschreibung: "Selbstständige mit Umsatz > 22.000 € / Jahr sind umsatzsteuerpflichtig und müssen monatlich/quartalsweise Voranmeldungen abgeben.",
      ersparnis: 0,
      aufwand: "mittel",
      paragraph: "§ 18 UStG",
      anlage: "USt-Voranmeldung (ELSTER)",
      status: "info",
      aktion: "Fristen im Kalender eintragen: Voranmeldung bis 10. des Folgemonats/-quartals.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 8,
      istGeschaetzt: true
    });
  }

  // ── RENTNER ──────────────────────────────────────────────────────────
  if (istRente) {
    ops.push({
      id: "besteuerungsanteil_rente",
      kategorie: "werbungskosten",
      titel: "Besteuerungsanteil der Rente",
      beschreibung: "Für Renteneintritt 2023: 83 % der Rente steuerpflichtig. Steigt jährlich um 0,5 Prozentpunkt bis 100 % (2058). Werbungskosten-Pauschale: nur 102 €.",
      ersparnis: 0,
      aufwand: "niedrig",
      paragraph: "§ 22 Nr. 1 EStG, § 9a Satz 1 Nr. 3 EStG",
      anlage: "Anlage R",
      status: "info",
      aktion: "Rentenbescheid und Mitteilung der Rentenversicherung aufbewahren.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 1,
      istGeschaetzt: false
    });
    ops.push({
      id: "altersentlastungsbetrag",
      kategorie: "werbungskosten",
      titel: "Altersentlastungsbetrag",
      beschreibung: "Arbeitnehmer/Rentner ab 64 Jahren: Freibetrag auf Nebeneinkünfte (§ 24a EStG). Bis zu 19,2 % der Einkünfte, max. 912 € (2026).",
      ersparnis: r0(912 * gst),
      aufwand: "niedrig",
      paragraph: "§ 24a EStG",
      anlage: "Mantelbogen",
      status: "action",
      aktion: "Geburtsjahr im Mantelbogen prüfen — wird meist automatisch angesetzt.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: true
    });
  }

  // ── ARBEITNEHMER: WK-Einzelabrechnung ────────────────────────────────
  if (istAN && !istStudent) {
    const wkBelege = sumBetrag(receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten"));
    const km = Number(ia.entfernung_km) || 0;
    const at = Number(ia.arbeitstage) || 0;
    const ho = Number(ia.homeoffice_tage) || 0;
    const pendlertage = Math.max(0, at - ho);
    const pendler = km > 0 ? _pendler(km, pendlertage, Kget) : 0;
    const hoSum = r0(Math.min(ho, Kget.homeoffice_max_tage) * Kget.homeoffice_pro_tag);
    const wkGesamt = r0(wkBelege + pendler + hoSum);
    const ueber = wkGesamt - Kget.wk_pauschale;
    if (ueber > 0) {
      ops.push({
        id: "wk_einzelabrechnung",
        kategorie: "werbungskosten",
        titel: "Einzelabrechnung lohnt sich",
        // NEU: Feature A — Grenzsteuersatz in Beschreibung
        beschreibung: `Deine WK-Belege (${fmtEUR(wkGesamt)}) übersteigen die Pauschale (${fmtEUR(Kget.wk_pauschale)}) um ${fmtEUR(ueber)}. Bei deinem Grenzsteuersatz von ca. ${Math.round(gst * 100)} % ergibt das ca. ${fmtEUR(r0(ueber * gst))} Steuerersparnis.`,
        ersparnis: r0(ueber * gst),
        aufwand: "mittel",
        paragraph: "§ 9a Satz 1 Nr. 1a EStG",
        anlage: "Anlage N",
        status: "lohnt",
        aktion: "Alle Einzelposten in Anlage N eintragen statt Pauschale.",
        belege_noetig: true,
        bereits_erfasst: wkBelege > 0,
        prioritaet: 1,
        istGeschaetzt: false,
        detail_zahlen: {
          "Belege": fmtEUR(wkBelege),
          "Pendler": fmtEUR(pendler),
          "Homeoffice": fmtEUR(hoSum),
          "Summe": fmtEUR(wkGesamt),
          "vs. Pauschale": "+ " + fmtEUR(ueber),
          "Grenzsteuersatz": Math.round(gst * 100) + " %"
        }
      });
    } else if (wkGesamt > 0) {
      ops.push({
        id: "wk_pauschale_reicht",
        kategorie: "werbungskosten",
        titel: "WK-Pauschale reicht",
        beschreibung: `Deine WK (${fmtEUR(wkGesamt)}) liegen unter der Pauschale (${fmtEUR(Kget.wk_pauschale)}). Einzelabrechnung bringt nichts. Es fehlen noch ${fmtEUR(Kget.wk_pauschale - wkGesamt)} bis der Vorteil beginnt.`,
        ersparnis: 0,
        aufwand: "niedrig",
        paragraph: "§ 9a EStG",
        anlage: "Anlage N",
        status: "info",
        aktion: "Keine Aktion nötig — Pauschale wird automatisch gewährt.",
        belege_noetig: false,
        bereits_erfasst: true,
        prioritaet: 9,
        istGeschaetzt: false
      });
    }

    // NEU: Feature A — §35a vs. WK: Expliziter Vergleich wenn Nutzer beides hat
    const hat35aBelege = receiptsOf(receipts, yr, r => r.steuerkat === "haushaltsnahe").length > 0;
    const hatWKBelege = wkBelege > Kget.wk_pauschale;
    if (hat35aBelege && hatWKBelege) {
      const ermaessigung35a = r0(receiptsOf(receipts, yr, r => r.steuerkat === "haushaltsnahe").reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0) * 0.20);
      const wkVorteil = r0((wkBelege - Kget.wk_pauschale) * gst);
      ops.push({
        id: "35a_vs_wk_vergleich",
        kategorie: "35a",
        titel: "§35a (direkt) vs. Werbungskosten — optimale Kombination",
        beschreibung: `Beide Positionen lohnen sich und sind unabhängig voneinander: §35a bringt ${fmtEUR(ermaessigung35a)} (direkte Steuerermäßigung), WK-Einzelabstellung bringt ${fmtEUR(wkVorteil)} (Grenzsteuersatz ${Math.round(gst * 100)} %). Beides gleichzeitig beantragen — sie konkurrieren nicht!`,
        ersparnis: ermaessigung35a + wkVorteil,
        aufwand: "mittel",
        paragraph: "§35a + §9 EStG",
        anlage: "Anlage N + Anlage Haushaltsnahe",
        status: "lohnt",
        aktion: "Beide Anlagen ausfüllen. §35a NUR per Überweisung (kein Bargeld). WK mit allen Belegen.",
        belege_noetig: true,
        bereits_erfasst: false,
        prioritaet: 1,
        istGeschaetzt: false,
        detail_zahlen: {
          "§35a-Ermäßigung": fmtEUR(ermaessigung35a),
          "WK-Mehrvorteil": fmtEUR(wkVorteil),
          "Grenzsteuersatz": Math.round(gst * 100) + " %",
          "Gesamt": fmtEUR(ermaessigung35a + wkVorteil)
        }
      });
    }
  }

  // (4) Arbeitsmittel GWG
  if (istAN || hatAusbildung || istSelbst) {
    const gwgGrenze = window.TAX_CONFIG_RAW?.gwg_grenze_brutto ?? 952;
    const amBelege = receiptsOf(receipts, yr, r => ["elektronik", "arbeitsmittel", "büro", "buero"].includes(String(r.kategorie || "").toLowerCase()));
    const gwg = amBelege.filter(r => (Number(r.gesamtbetrag) || 0) <= gwgGrenze);
    const gwgSum = r0(sumBetrag(gwg));
    if (gwgSum > 0) {
      ops.push({
        id: "arbeitsmittel_gwg",
        kategorie: "werbungskosten",
        titel: "GWG-Sofortabschreibung",
        beschreibung: `${gwg.length} Arbeitsmittel unter ${fmtEUR(gwgGrenze)} netto — im Kaufjahr voll absetzbar.`,
        ersparnis: r0(gwgSum * gst),
        aufwand: "niedrig",
        paragraph: "§ 6 Abs. 2 EStG",
        anlage: istSelbst ? "Anlage G / S" : "Anlage N",
        status: "action",
        aktion: "Als WK in Anlage N eintragen — keine AfA nötig.",
        belege_noetig: true,
        bereits_erfasst: true,
        prioritaet: 3,
        istGeschaetzt: false
      });
    }
  }

  // (5) Fortbildung (AN)
  if (istAN && !istStudent && !!ia.fortbildung) {
    const fbBelege = receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten" && ["fortbildung", "bildung", "kurs", "seminar", "fachbuch", "literatur"].includes(String(r.kategorie || "").toLowerCase()));
    const wkAlle = receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten");
    const hasBelege = fbBelege.length > 0 || wkAlle.length > 0;
    const basis = hasBelege ? fbBelege.length > 0 ? sumBetrag(fbBelege) : sumBetrag(wkAlle) : 0;
    ops.push({
      id: "fortbildung_check",
      kategorie: "werbungskosten",
      titel: hasBelege ? "Fortbildungskosten erfasst" : "Fortbildungsbelege fehlen",
      beschreibung: hasBelege ? `${fmtEUR(basis)} als Werbungskosten erfasst.` : "Fortbildungsausgaben angegeben, aber keine Belege erfasst. Kurse, Fachbücher, Laptop absetzbar.",
      ersparnis: hasBelege ? r0(basis * gst) : 0,
      aufwand: "niedrig",
      paragraph: "§ 9 Abs. 1 EStG",
      anlage: "Anlage N",
      status: hasBelege ? "lohnt" : "warn",
      aktion: hasBelege ? "Beträge in Anlage N eintragen." : "Belege im Scanner-Tab erfassen.",
      belege_noetig: true,
      bereits_erfasst: hasBelege,
      prioritaet: 2,
      istGeschaetzt: false
    });
  }

  // (6) Gewerkschaft
  if (!!ia.gewerkschaft && (istAN || istAzubi)) {
    const annahme = 360;
    ops.push({
      id: "gewerkschaft_abzug",
      kategorie: "werbungskosten",
      titel: "Gewerkschaftsbeiträge absetzen",
      beschreibung: yr >= 2026 ? "Ab 2026 zusätzlich zur WK-Pauschale absetzbar." : "In voller Höhe als Werbungskosten absetzbar.",
      ersparnis: r0(annahme * gst),
      aufwand: "niedrig",
      paragraph: "§ 9 Abs. 1 EStG",
      anlage: "Anlage N",
      status: "action",
      aktion: "Jahresbeitragsbescheinigung anfordern und in Anlage N, Zeile 41 eintragen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 3,
      istGeschaetzt: false
    });
  }

  // (7) Doppelte Haushaltsführung
  const kmFahrweg = Number(ia.entfernung_km) || 0;
  if ((istAN || hatAusbildung) && kmFahrweg > 50) {
    ops.push({
      id: "doppelte_haushaltsfuehrung",
      kategorie: "werbungskosten",
      titel: "Doppelte Haushaltsführung prüfen",
      beschreibung: `Bei ${kmFahrweg} km Arbeitsweg könnte eine Zweitwohnung am Arbeitsort lohnen — Miete bis 1.000 €/Monat absetzbar.`,
      ersparnis: r0(2000 * gst),
      aufwand: "hoch",
      paragraph: "§ 9 Abs. 1 Satz 3 Nr. 5 EStG",
      anlage: "Anlage N",
      status: "info",
      aktion: "Voraussetzungen prüfen: eigener Hausstand + beruflich veranlasste Zweitwohnung.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 7,
      istGeschaetzt: true
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // SONDERAUSGABEN — Mantelbogen
  // ──────────────────────────────────────────────────────────────────

  // (8) Riester
  if (!ia.riester && !(profile.riester_eigenanteil > 0) && !istSelbst && !istRente) {
    ops.push({
      id: "riester_check",
      kategorie: "sonderausgaben",
      titel: "Riester-Rente erwägen",
      beschreibung: `Bis ${fmtEUR(Kget.riester_max_sa_abzug)}/Jahr absetzbar (§ 10a EStG) + ${fmtEUR(Kget.riester_grundzulage)} Grundzulage + ${fmtEUR(Kget.riester_kinderzulage_ab_2008)}/Kind. Günstigerprüfung durch Finanzamt.`,
      ersparnis: r0(Kget.riester_max_sa_abzug * gst * 0.5),
      aufwand: "hoch",
      paragraph: "§ 10a EStG",
      anlage: "Anlage AV",
      status: "info",
      aktion: "Riester-Vertrag beantragen; Zulagenantrag jährlich stellen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 8,
      istGeschaetzt: true
    });
  }

  // (9) BAV
  if (!ia.bav && !(profile.bav_beitrag_jahres > 0) && profile.abzugsfaehigePositionen.bav) {
    ops.push({
      id: "bav_check",
      kategorie: "sonderausgaben",
      titel: "Betriebliche Altersvorsorge",
      beschreibung: "Bis 4 % der BBG sozialabgaben- und steuerfrei via Gehaltsumwandlung.",
      ersparnis: r0(2400 * gst),
      aufwand: "mittel",
      paragraph: "§ 3 Nr. 63 EStG",
      anlage: "—",
      status: "info",
      aktion: "Personalabteilung ansprechen; mind. 15 % AG-Zuschuss erfragen.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 5,
      istGeschaetzt: true
    });
  }

  // (10) Spenden
  if (!!ia.spenden) {
    const spendenBelege = receiptsOf(receipts, yr, r => ["spende", "spenden"].includes(String(r.kategorie || "").toLowerCase()));
    const spendenSum = sumBetrag(spendenBelege);
    const hasBelege = spendenBelege.length > 0;
    ops.push({
      id: "spenden_check",
      kategorie: "sonderausgaben",
      titel: hasBelege ? "Spendenbelege erfasst" : "Spendenbelege fehlen",
      beschreibung: hasBelege ? `${fmtEUR(spendenSum)} erfasst — als Sonderausgaben absetzbar.` : "Spenden angegeben, aber keine Quittungen erfasst. Bis 20 % des Einkommens absetzbar.",
      ersparnis: hasBelege ? r0(spendenSum * gst) : 0,
      aufwand: "niedrig",
      paragraph: "§ 10b EStG",
      anlage: "Mantelbogen",
      status: "warn",
      aktion: "Zuwendungsbestätigungen anfordern (> 300 €) — Kontoauszug reicht darunter.",
      belege_noetig: true,
      bereits_erfasst: hasBelege,
      prioritaet: 3,
      istGeschaetzt: false
    });
  }

  // (11) KV-Beiträge
  ops.push({
    id: "krankenversicherung_opt",
    kategorie: "sonderausgaben",
    titel: "Basis-Krankenversicherung",
    beschreibung: "Beiträge zur gesetzl./privaten Basisabsicherung unbegrenzt absetzbar — meist automatisch aus Lohnsteuerbescheinigung.",
    ersparnis: 0,
    aufwand: "niedrig",
    paragraph: "§ 10 Abs. 1 Nr. 3 EStG",
    anlage: "Anlage Vorsorgeaufwand",
    status: "info",
    aktion: "Lohnsteuerbescheinigung hochladen — Werte werden meist automatisch übernommen.",
    belege_noetig: false,
    bereits_erfasst: true,
    prioritaet: 10,
    istGeschaetzt: true
  });

  // NEU: Feature 2 — Kirchensteuer auf Kapitalerträge als Sonderausgabe
  if (profile.kirchenmitglied && einkunftsarten?.kapitalertraege) {
    ops.push({
      id: "kist_kapital_sonderausgabe",
      kategorie: "sonderausgaben",
      titel: "Kirchensteuer auf Kapitalerträge → Sonderausgabe",
      beschreibung: "Kirchensteuer, die auf Kapitalerträge abgeführt wurde, ist als Sonderausgabe absetzbar — wird oft vergessen.",
      ersparnis: r0((profile.kv_beitrag_jahres || 0) * 0.01 * gst),
      aufwand: "niedrig",
      paragraph: "§ 10 Abs. 1 Nr. 4 EStG",
      anlage: "Anlage KAP + SA",
      status: "lohnt",
      aktion: "Jahressteuerbescheinigung der Bank prüfen — Zeile 'Kirchensteuer auf Abgeltungsteuer'. Betrag in Anlage KAP Zeile 14 + Anlage SA eintragen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 3,
      istGeschaetzt: true,
      detail_zahlen: {}
    });
  }

  // NEU: Feature 2 — Unterhalt als außergewöhnliche Belastung
  if (profile.unterhalt_betrag > 0) {
    const max_absetzbar = Math.min(profile.unterhalt_betrag, Kget.grundfreibetrag);
    const ersparnis_unterhalt = r0(max_absetzbar * gst);
    ops.push({
      id: "unterhalt_agB",
      kategorie: "sonderausgaben",
      titel: "Unterhaltszahlungen (außergewöhnliche Belastung)",
      beschreibung: `${fmtEUR(profile.unterhalt_betrag)} Unterhalt → max. ${fmtEUR(max_absetzbar)} absetzbar (bis Grundfreibetrag). Ersparnis ca. ${fmtEUR(ersparnis_unterhalt)}.`,
      ersparnis: ersparnis_unterhalt,
      aufwand: "mittel",
      paragraph: "§ 33a Abs. 1 EStG",
      anlage: "Anlage Unterhalt",
      status: "lohnt",
      aktion: "Anlage Unterhalt ausfüllen. Banküberweisungen als Belege. Bei Bargeld: Quittung vom Empfänger.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: false,
      detail_zahlen: {
        "Gezahlt": fmtEUR(profile.unterhalt_betrag),
        "Max. absetzbar": fmtEUR(max_absetzbar),
        "Ersparnis ca.": fmtEUR(ersparnis_unterhalt)
      }
    });
  }

  // NEU: Feature 2 — Kirchensteuer-Schätzung (wenn Bundesland bekannt)
  if (profile.kirchenmitglied && profile.bundesland && profile.bundesland !== "default" && brutto) {
    const _kstMap = Kget.kirchensteuer_satz ?? {};
    const kistSatz = _kstMap[profile.bundesland] ?? _kstMap.default ?? 0.09;
    const _wkP = Kget.wk_pauschale;
    const estGrob = typeof calcESt === "function" ? calcESt(Math.max(0, brutto * 0.72 - _wkP), String(yr)) : 0;
    const kistGrob = r0(estGrob * kistSatz);
    if (kistGrob > 0) {
      ops.push({
        id: "kist_absetzbar",
        kategorie: "sonderausgaben",
        titel: "Kirchensteuer als Sonderausgabe",
        beschreibung: `Geschätzte Kirchensteuer ${fmtEUR(kistGrob)} (${(kistSatz * 100).toFixed(0)} % auf ESt, ${profile.bundesland}) ist vollständig als Sonderausgabe absetzbar.`,
        ersparnis: r0(kistGrob * gst),
        aufwand: "niedrig",
        paragraph: "§ 10 Abs. 1 Nr. 4 EStG",
        anlage: "Anlage SA",
        status: "lohnt",
        aktion: "Kirchensteuerbescheinigung vom Arbeitgeber (Lohnsteuerbescheinigung Zeile 6) in Anlage SA, Zeile 7 eintragen.",
        belege_noetig: true,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: true,
        detail_zahlen: {
          "Bundesland": profile.bundesland,
          "KiSt-Satz": kistSatz * 100 + " %",
          "Kirchensteuer ca.": fmtEUR(kistGrob)
        }
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // KAPITALERTRÄGE — Anlage KAP
  // ──────────────────────────────────────────────────────────────────
  const trades = investments && Array.isArray(investments.trades) ? investments.trades : [];
  const yearTrades = trades.filter(tr => (tr.date || "").startsWith(String(yr)));
  if (!!ia.kapitalertraege) {
    const fb = verheiratet ? Kget.sparerpauschbetrag_verheiratet : Kget.sparerpauschbetrag_single;
    ops.push({
      id: "freistellungsauftrag",
      kategorie: "kapital",
      titel: "Freistellungsauftrag prüfen",
      beschreibung: `Bis ${fmtEUR(fb)} Kapitalerträge steuerfrei. Ohne Auftrag zieht Bank automatisch Abgeltungsteuer ab.`,
      ersparnis: r0(fb * Kget.kapest_satz),
      aufwand: "niedrig",
      paragraph: "§ 44a EStG",
      anlage: "—",
      status: "action",
      aktion: "Bei deiner Bank online einrichten — auf mehrere Banken aufteilen.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: true
    });
  }
  const verluste = yearTrades.filter(tr => Number(tr.amount) < 0);
  if (verluste.length > 0) {
    const verlustSum = r0(verluste.reduce((s, tr) => s + Math.abs(Number(tr.amount)), 0));
    ops.push({
      id: "verlustverrechnung",
      kategorie: "kapital",
      titel: "Verlustverrechnungstopf nutzen",
      beschreibung: `${verluste.length} Verluste (${fmtEUR(verlustSum)}) können mit Gewinnen verrechnet werden.`,
      ersparnis: r0(verlustSum * Kget.kapest_satz),
      aufwand: "mittel",
      paragraph: "§ 20 Abs. 6 EStG",
      anlage: "Anlage KAP",
      status: "lohnt",
      aktion: "Verlustbescheinigung bei der Bank bis 15.12. anfordern.",
      belege_noetig: true,
      bereits_erfasst: true,
      prioritaet: 1,
      istGeschaetzt: false
    });
  }
  if (!!ia.kapitalertraege && brutto < Kget.grundfreibetrag + 5000) {
    ops.push({
      id: "guenstigerpruefung",
      kategorie: "kapital",
      titel: "Günstigerprüfung beantragen",
      beschreibung: `Bei Brutto ${fmtEUR(brutto)} ist dein Steuersatz ggf. < 25 % — Günstigerprüfung kann Kapitalertragsteuer reduzieren.`,
      ersparnis: r0(Math.max(0, r0(yearTrades.filter(tr => Number(tr.amount) > 0).reduce((s, tr) => s + Number(tr.amount), 0))) * 0.10),
      aufwand: "niedrig",
      paragraph: "§ 32d Abs. 6 EStG",
      anlage: "Anlage KAP",
      status: "lohnt",
      aktion: "In Anlage KAP, Zeile 4 Kreuz bei Günstigerprüfung setzen.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: false
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // HAUSHALTSNAHE DIENSTLEISTUNGEN — § 35a EStG
  // ──────────────────────────────────────────────────────────────────
  // ── §35a Abs.2: Haushaltsnahe Dienstleistungen (Reinigung, Gärtner, Haushaltshilfe) ──
  // Max: 20% von 20.000 € Aufwendungen = 4.000 €/Jahr Steuerermäßigung
  const dlBelege = receiptsOf(receipts, yr, r => r.steuerkat === "haushaltsnahe");
  const dlSum = r0(sumBetrag(dlBelege));
  const maxDlErm = window.TAX_CONFIG_RAW?.haushaltsnahe_dienstleistungen?.max_ermaessigung ?? 4000;
  const maxDlAufw = window.TAX_CONFIG_RAW?.haushaltsnahe_dienstleistungen?.max_aufwendungen ?? 20000;

  // ── §35a Abs.3: Handwerkerleistungen (Renovierung, Reparatur, Modernisierung) ──
  // Max: 20% von 6.000 € Arbeitskosten = 1.200 €/Jahr Steuerermäßigung
  const hwkBelege = receiptsOf(receipts, yr, r => r.steuerkat === "handwerker");
  const hwkSum = r0(sumBetrag(hwkBelege));
  const maxHwkErm = window.TAX_CONFIG_RAW?.handwerkerleistungen?.max_ermaessigung ?? 1200;
  const maxHwkAufw = window.TAX_CONFIG_RAW?.handwerkerleistungen?.max_arbeitskosten ?? 6000;

  // Kombinierter §35a-Hinweis wenn Frage bejaht aber keine Belege
  const hatKeineDlBelege = dlBelege.length === 0;
  const hatKeineHwkBelege = hwkBelege.length === 0;
  if (!!ia.handwerker && hatKeineDlBelege && hatKeineHwkBelege) {
    ops.push({
      id: "35a_belege_fehlen",
      kategorie: "haushaltsnahe",
      titel: "§35a-Belege erfassen (DL + Handwerker)",
      beschreibung: "Haushaltsnahe DL (Reinigung, Gärtner): max. 4.000 €/Jahr direkt von der Steuer. Handwerker (Renovierung, Reparatur): max. 1.200 €/Jahr. Belege im Scanner-Tab unter der richtigen Kategorie erfassen.",
      ersparnis: 1200,
      aufwand: "niedrig",
      paragraph: "§ 35a Abs. 2 + 3 EStG",
      anlage: "Mantelbogen",
      status: "warn",
      aktion: "Rechnungen müssen per Überweisung bezahlt sein (kein Bargeld!). Haushaltsnahe DL und Handwerker getrennt erfassen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 1,
      istGeschaetzt: false
    });
  }

  // §35a Abs.2 — Haushaltsnahe DL: Berechnung
  if (dlSum > 0) {
    const dlArbeitsanteil = r0(Math.min(dlSum, maxDlAufw) * 0.6);
    const dlErm = Math.min(maxDlErm, r0(dlArbeitsanteil * 0.20));
    ops.push({
      id: "haushaltsnahe_dl_bonus",
      kategorie: "haushaltsnahe",
      titel: "Haushaltsnahe DL — §35a Abs.2",
      beschreibung: `${fmtEUR(dlSum)} Belege (Reinigung, Gärtner…). Arbeitsanteil ~${fmtEUR(dlArbeitsanteil)} × 20 % = ${fmtEUR(dlErm)} direkt von der Steuerschuld (max. ${fmtEUR(maxDlErm)}/Jahr).`,
      ersparnis: dlErm,
      aufwand: "niedrig",
      paragraph: "§ 35a Abs. 2 EStG",
      anlage: "Mantelbogen",
      status: "lohnt",
      aktion: "Lohnanteil der Rechnung in Mantelbogen, Zeile 72–73 eintragen. Nur per Überweisung!",
      belege_noetig: true,
      bereits_erfasst: true,
      prioritaet: 1,
      istGeschaetzt: false,
      detail_zahlen: {
        "Belege §35a Abs.2": fmtEUR(dlSum),
        "Arbeitsanteil (~60 %)": fmtEUR(dlArbeitsanteil),
        "Steuerermäßigung (20 %)": fmtEUR(dlErm),
        "Jahresmaximum Ermäßigung": fmtEUR(maxDlErm),
        "Hinweis": "20 % direkt von der Steuerschuld — unabhängig vom Grenzsteuersatz"
      }
    });
    // Splitting: Jahresgrenze ausschöpfen / ins Folgejahr verschieben
    const dlAusgeschoepft = dlArbeitsanteil >= maxDlAufw * 0.6;
    const dlRestKap = Math.max(0, maxDlAufw * 0.6 - dlArbeitsanteil);
    if (dlAusgeschoepft) {
      ops.push({
        id: "35a_dl_naechstes_jahr",
        kategorie: "35a",
        titel: "§35a DL-Maximum erreicht — Rest ins Folgejahr",
        beschreibung: `Du hast das §35a Abs.2-Maximum (${fmtEUR(maxDlErm)} Ermäßigung) für DL erreicht. Weitere Aufträge auf ${yr + 1} verschieben — dann wieder volle ${fmtEUR(maxDlErm)} verfügbar.`,
        ersparnis: maxDlErm,
        aufwand: "niedrig",
        paragraph: "§ 35a Abs. 2 EStG",
        anlage: "Mantelbogen",
        status: "lohnt",
        aktion: `Neue DL-Verträge erst ab Januar ${yr + 1} abrechnen lassen.`,
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 1,
        istGeschaetzt: true
      });
    } else if (dlRestKap > 500) {
      ops.push({
        id: "35a_dl_kapazitaet",
        kategorie: "35a",
        titel: `Noch ${fmtEUR(r0(dlRestKap * 0.20))} §35a-DL-Potenzial bis Jahresende`,
        beschreibung: `Noch ${fmtEUR(dlRestKap)} Arbeitskosten-Spielraum bei §35a Abs.2 (DL). Weitere Aufträge bis ${yr} bringen noch ca. ${fmtEUR(r0(dlRestKap * 0.20))} Steuerermäßigung.`,
        ersparnis: r0(dlRestKap * 0.20),
        aufwand: "mittel",
        paragraph: "§ 35a Abs. 2 EStG",
        anlage: "Mantelbogen",
        status: "lohnt",
        aktion: `Haushaltsnahe DL bis Jahresende ${yr} beauftragen und per Überweisung bezahlen.`,
        belege_noetig: true,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: false,
        detail_zahlen: {
          "Bereits genutzt (Arb.-Anteil)": fmtEUR(dlArbeitsanteil),
          "Max. Arbeitsanteil": fmtEUR(maxDlAufw * 0.6),
          "Restkapazität": fmtEUR(dlRestKap),
          "Mögliche Zusatz-Ermäßigung": fmtEUR(r0(dlRestKap * 0.20))
        }
      });
    }
  }

  // §35a Abs.3 — Handwerkerleistungen: Berechnung
  if (hwkSum > 0) {
    const hwkArbeitsanteil = r0(Math.min(hwkSum, maxHwkAufw) * 0.6);
    const hwkErm = Math.min(maxHwkErm, r0(hwkArbeitsanteil * 0.20));
    ops.push({
      id: "handwerker_bonus",
      kategorie: "haushaltsnahe",
      titel: "Handwerkerleistungen — §35a Abs.3",
      beschreibung: `${fmtEUR(hwkSum)} Belege (Renovierung, Reparatur…). Arbeitsanteil ~${fmtEUR(hwkArbeitsanteil)} × 20 % = ${fmtEUR(hwkErm)} direkt von der Steuerschuld (max. ${fmtEUR(maxHwkErm)}/Jahr).`,
      ersparnis: hwkErm,
      aufwand: "niedrig",
      paragraph: "§ 35a Abs. 3 EStG",
      anlage: "Mantelbogen",
      status: "lohnt",
      aktion: "Lohnanteil getrennt ausweisen lassen. Mantelbogen Zeile 74–75. Nur per Überweisung!",
      belege_noetig: true,
      bereits_erfasst: true,
      prioritaet: 1,
      istGeschaetzt: false,
      detail_zahlen: {
        "Belege §35a Abs.3": fmtEUR(hwkSum),
        "Arbeitsanteil (~60 %)": fmtEUR(hwkArbeitsanteil),
        "Steuerermäßigung (20 %)": fmtEUR(hwkErm),
        "Jahresmaximum Ermäßigung": fmtEUR(maxHwkErm),
        "Hinweis": "20 % direkt von der Steuerschuld — unabhängig vom Grenzsteuersatz"
      }
    });
    // Splitting Handwerker
    const hwkAusgeschoepft = hwkArbeitsanteil >= maxHwkAufw;
    const hwkRestKap = Math.max(0, maxHwkAufw - hwkArbeitsanteil);
    if (hwkAusgeschoepft) {
      ops.push({
        id: "35a_hwk_naechstes_jahr",
        kategorie: "35a",
        titel: "§35a Handwerker-Maximum erreicht — Rest ins Folgejahr",
        beschreibung: `Du hast das §35a Abs.3-Maximum (${fmtEUR(maxHwkErm)} Ermäßigung) für Handwerker erreicht. Weitere Arbeiten auf ${yr + 1} verschieben.`,
        ersparnis: maxHwkErm,
        aufwand: "niedrig",
        paragraph: "§ 35a Abs. 3 EStG",
        anlage: "Mantelbogen",
        status: "lohnt",
        aktion: `Handwerkerarbeiten erst ab Januar ${yr + 1} beauftragen oder Zahlung verschieben.`,
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 1,
        istGeschaetzt: true
      });
    } else if (hwkRestKap > 300) {
      ops.push({
        id: "35a_hwk_kapazitaet",
        kategorie: "35a",
        titel: `Noch ${fmtEUR(r0(hwkRestKap * 0.20))} Handwerker-Potenzial bis Jahresende`,
        beschreibung: `Noch ${fmtEUR(hwkRestKap)} Arbeitskosten-Spielraum bei §35a Abs.3. Weitere Reparaturen / Renovierungen bis ${yr} beauftragen.`,
        ersparnis: r0(hwkRestKap * 0.20),
        aufwand: "mittel",
        paragraph: "§ 35a Abs. 3 EStG",
        anlage: "Mantelbogen",
        status: "lohnt",
        aktion: `Handwerkerarbeiten bis ${yr} beauftragen und per Überweisung bezahlen.`,
        belege_noetig: true,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: false
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // AUßERGEWÖHNLICHE BELASTUNGEN
  // ──────────────────────────────────────────────────────────────────
  if (!!ia.krankenkosten) {
    const abBelege = receiptsOf(receipts, yr, r => r.steuerkat === "aussergewoehnlich");
    const abSum = r0(sumBetrag(abBelege));
    const kinderAnzahl = !!ia.kinder ? 1 : 0;
    const zumutbar = typeof calcZumutbareEigenbelastung === "function" ? calcZumutbareEigenbelastung(brutto, familienstand, kinderAnzahl) : r0(brutto * 0.04);
    const ueberzumutbar = Math.max(0, abSum - zumutbar);
    ops.push({
      id: "krankheitskosten_check",
      kategorie: "aussergewoehnlich",
      titel: "Krankheitskosten als außergew. Belastung",
      beschreibung: ueberzumutbar > 0 ? `${fmtEUR(abSum)} − zumutbare Eigenbelastung ${fmtEUR(zumutbar)} (§ 33 Abs. 3 EStG, gestaffelt) = ${fmtEUR(ueberzumutbar)} absetzbar.` : `${fmtEUR(abSum)} liegen unter zumutbarer Eigenbelastung (${fmtEUR(zumutbar)}) — kein Abzug möglich.`,
      ersparnis: r0(ueberzumutbar * gst),
      aufwand: "mittel",
      paragraph: "§ 33 EStG",
      anlage: "Mantelbogen",
      status: ueberzumutbar > 0 ? "lohnt" : "info",
      aktion: "Rezepte, Zuzahlungen, Brillen, Arztfahrten sammeln.",
      belege_noetig: true,
      bereits_erfasst: abBelege.length > 0,
      prioritaet: ueberzumutbar > 0 ? 2 : 8,
      istGeschaetzt: false,
      detail_zahlen: {
        "AB-Belege": fmtEUR(abSum),
        "Zumutbare Belastung": fmtEUR(zumutbar),
        "Abziehbar": fmtEUR(ueberzumutbar)
      }
    });
  }
  if (!!ia.behinderung) {
    // §33b EStG — Pauschbeträge nach GdB (Stand 2021+)
    const _GDB_PAUSCH = {
      20: 384,
      30: 620,
      50: 1140,
      70: 1780,
      80: 2120,
      100: 2840
    };
    const _gdb = Number(ia.behinderungsgrad) || 50;
    // Nächsten gültigen GdB-Stufen-Wert wählen (abwärts, min 20)
    const _gdbKey = [100, 80, 70, 50, 30, 20].find(k => k <= _gdb) || 20;
    const _pausch = _GDB_PAUSCH[_gdbKey] ?? 1140;
    ops.push({
      id: "behinderung_pauschbetrag",
      kategorie: "aussergewoehnlich",
      titel: "Behinderten-Pauschbetrag",
      beschreibung: `GdB ${_gdb} → Pauschbetrag ${_pausch.toLocaleString("de-DE")} € p.a.`,
      ersparnis: r0(_pausch * gst),
      aufwand: "niedrig",
      paragraph: "§ 33b EStG",
      anlage: "Mantelbogen",
      status: "action",
      aktion: "GdB + Merkzeichen aus Schwerbehindertenausweis in Mantelbogen eintragen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: false
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // BONUS-CHECKS
  // ──────────────────────────────────────────────────────────────────
  const steuerklasse = profile.steuerklasse || 1;
  if (verheiratet && steuerklasse === 4) {
    ops.push({
      id: "steuerklassen_check",
      kategorie: "bonus",
      titel: "Steuerklasse III/V prüfen",
      beschreibung: "Bei deutlich unterschiedlichen Einkommen kann SK III/V mehr Liquidität bringen.",
      ersparnis: 0,
      aufwand: "mittel",
      paragraph: "§ 38b EStG",
      anlage: "—",
      status: "info",
      aktion: "Wechselantrag beim Finanzamt — einmal pro Jahr möglich.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 7,
      istGeschaetzt: true
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE-4: OFT ÜBERSEHENE STEUERVORTEILE
  // ════════════════════════════════════════════════════════════════════

  // ── 1. Kontoführungsgebühren-Pauschale ──
  if (istAN || istAzubi) {
    ops.push({
      id: "kontofuehrung_pauschale",
      kategorie: "werbungskosten",
      titel: "Kontoführungsgebühren-Pauschale",
      beschreibung: "16 € Pauschale für Kontoführung absetzbar — kein Beleg nötig, wird von >80 % nicht beantragt.",
      ersparnis: r0(16 * gst),
      aufwand: "niedrig",
      paragraph: "§ 9 Abs. 1 Nr. 1 EStG (R 9.1 LStR)",
      anlage: "Anlage N, Zeile 46 (Sonstiges)",
      status: "lohnt",
      aktion: "Einfach 16 € in Anlage N unter 'Sonstige Werbungskosten' eintragen. Kein Beleg notwendig.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: false,
      detail_zahlen: {
        "Pauschale": "16 €",
        "Steuerersparnis ca.": fmtEUR(r0(16 * gst)),
        "Beleg nötig": "Nein"
      }
    });
  }

  // ── 2. Telefon/Internet beruflich (20 %-Regel) ──
  if (istAN || istAzubi || istSelbst) {
    const telPauschale = Math.min(240, r0((Number(ia.telefon_kosten_jahres) || 600) * 0.20));
    const wkBelegeJahr = sumBetrag(receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten"));
    const hatTelBeleg = receiptsOf(receipts, yr, r => r.steuerkat === "werbungskosten" && ["telefon", "internet", "handy"].some(k => (r.haendler || "").toLowerCase().includes(k))).length > 0;
    if (!hatTelBeleg) {
      ops.push({
        id: "telefon_internet_beruflich",
        kategorie: "werbungskosten",
        titel: "Telefon & Internet — beruflicher Anteil",
        beschreibung: `20 % der privaten Telefon-/Internetkosten absetzbar ohne Einzelnachweis — max. 20 €/Monat (240 €/Jahr). Ersparnis ca. ${fmtEUR(r0(telPauschale * gst))}.`,
        ersparnis: r0(telPauschale * gst),
        aufwand: "niedrig",
        paragraph: "§ 9 Abs. 1 Nr. 1 EStG (BMF-Schreiben)",
        anlage: "Anlage N, Zeile 46",
        status: "lohnt",
        aktion: "20 % der Jahreskosten (max. 240 €) als Werbungskosten eintragen. Alternativ Einzelnachweis wenn beruflicher Anteil höher.",
        belege_noetig: false,
        bereits_erfasst: false,
        prioritaet: 2,
        istGeschaetzt: true,
        detail_zahlen: {
          "Angenommene Jahreskosten": fmtEUR(Number(ia.telefon_kosten_jahres) || 600),
          "Absetzbarer Anteil (20 %)": fmtEUR(telPauschale),
          "Ersparnis ca.": fmtEUR(r0(telPauschale * gst)),
          "Maximaler Abzug": "240 €/Jahr"
        }
      });
    }
  }

  // ── 3. Steuersoftware absetzbar ──
  if (istAN || istAzubi) {
    ops.push({
      id: "steuersoftware_absetzbar",
      kategorie: "werbungskosten",
      titel: "Steuersoftware als Werbungskosten",
      beschreibung: "Kosten für Steuersoftware (WISO, Taxman, Smartsteuer etc.) sind voll als Werbungskosten absetzbar — wird häufig vergessen.",
      ersparnis: r0(35 * gst),
      aufwand: "niedrig",
      paragraph: "§ 9 Abs. 1 Nr. 1 EStG",
      anlage: "Anlage N, Zeile 46",
      status: "info",
      aktion: "Kaufbeleg der Steuersoftware aufheben und unter sonstige Werbungskosten eintragen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 4,
      istGeschaetzt: true,
      detail_zahlen: {
        "Typischer Preis": "~35 €",
        "Ersparnis ca.": fmtEUR(r0(35 * gst))
      }
    });
  }

  // ── 4. Rürup-Prüfung (Selbstständige ohne GRV) ──
  if (istSelbst && !ia.riester_eigenanteil) {
    ops.push({
      id: "ruerup_check",
      kategorie: "sonderausgaben",
      titel: "Rürup-Rente (Basisrente) für Selbstständige",
      beschreibung: "Selbstständige ohne gesetzliche Rentenversicherung können Rürup-Beiträge bis zum Höchstbetrag als Sonderausgaben absetzen — oft die größte Steuerspar-Option für Selbstständige.",
      ersparnis: r0(3000 * gst),
      aufwand: "hoch",
      paragraph: "§ 10 Abs. 1 Nr. 2b EStG",
      anlage: "Anlage Vorsorgeaufwand",
      status: "warn",
      aktion: "Rürup-Vertrag prüfen oder abschließen. Höchstbetrag 2026: ca. 29.344 € (Einzelveranlagung). Steuerberater hinzuziehen.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 2,
      istGeschaetzt: true,
      detail_zahlen: {
        "Abzugsfähig bis": "~29.344 €/Jahr",
        "Ersparnis (Schätzung)": fmtEUR(r0(3000 * gst)),
        "Hinweis": "Individuell sehr verschieden — Steuerberater empfohlen"
      }
    });
  }

  // ── 5. Pflegepauschbetrag ──
  if (ia.pflege_angehoerige) {
    const pflegePausch = 924;
    ops.push({
      id: "pflegepauschbetrag",
      kategorie: "aussergewoehnlich",
      titel: "Pflegepauschbetrag (Angehörige)",
      beschreibung: `${fmtEUR(pflegePausch)} Pauschbetrag für unentgeltliche Pflege von Angehörigen (Pflegegrad 2+) — ohne Einzelnachweis. Ersparnis ca. ${fmtEUR(r0(pflegePausch * gst))}.`,
      ersparnis: r0(pflegePausch * gst),
      aufwand: "niedrig",
      paragraph: "§ 33b Abs. 6 EStG",
      anlage: "Anlage agB",
      status: "lohnt",
      aktion: "Pflegebescheinigung (Pflegegrad 2+) aufheben. Pauschbetrag in Anlage agB eintragen — wird oft jahrelang nicht beantragt.",
      belege_noetig: true,
      bereits_erfasst: false,
      prioritaet: 1,
      istGeschaetzt: false,
      detail_zahlen: {
        "Pauschbetrag": fmtEUR(pflegePausch),
        "Ersparnis ca.": fmtEUR(r0(pflegePausch * gst)),
        "Nachweis": "Pflegebescheid (Pflegegrad 2 oder höher)"
      }
    });
  }

  // ── 6. Faktor-Verfahren für Verheiratete (statt III/V) ──
  if (verheiratet && (ia.steuerklasse === "3" || ia.steuerklasse === 3 || ia.steuerklasse === "5" || ia.steuerklasse === 5)) {
    ops.push({
      id: "faktor_verfahren",
      kategorie: "sonderausgaben",
      titel: "Faktor-Verfahren statt Steuerklasse III/V",
      beschreibung: "Das Faktor-Verfahren (Klasse IV/IV mit Faktor) verteilt die Steuerlast gerechter zwischen Partnern — verhindert hohe Nachzahlungen und ist oft günstiger als III/V.",
      ersparnis: 0,
      aufwand: "niedrig",
      paragraph: "§ 39f EStG",
      anlage: "Antrag beim Finanzamt (Formular Steuerklassenwechsel)",
      status: "info",
      aktion: "Beim Finanzamt Antrag auf Faktor-Verfahren stellen (kostenlos, jederzeit möglich). Lohnsteuerrechner nutzen um III/V vs. IV/IV-Faktor zu vergleichen.",
      belege_noetig: false,
      bereits_erfasst: false,
      prioritaet: 5,
      istGeschaetzt: true,
      detail_zahlen: {
        "Vorteil": "Weniger Nachzahlung, gerechtere Verteilung",
        "Aufwand": "Einmaliger Antrag beim FA",
        "Hinweis": "Lohnsteuerrechner unter bmf-steuerrechner.de nutzen"
      }
    });
  }

  // NEU: Feature 1 — ROI-Score berechnen + nach Score absteigend sortieren
  const scoredOps = ops.filter(o => (o.ersparnis || 0) > 0 || o.status === "warn" || o.status === "action" || o.status === "info").map(op => ({
    ...op,
    roi_score: calcROIScore(op)
  }));
  scoredOps.sort((a, b) => (b.roi_score || 0) - (a.roi_score || 0));
  return scoredOps;
}

// ════════════════════════════════════════════════════════════════════════
// UI-Komponenten
// ════════════════════════════════════════════════════════════════════════

const KATEGORIE_LABELS = {
  werbungskosten: "Werbungskosten",
  sonderausgaben: "Sonderausgaben",
  kapital: "Kapitalerträge",
  haushaltsnahe: "Haushaltsnah",
  aussergewoehnlich: "Außergewöhnlich",
  bonus: "Sonstiges",
  mehrjahres: "Mehrjahres",
  "35a": "§35a Splitting"
};
const AUFWAND_LABEL = {
  niedrig: "leicht",
  mittel: "mittel",
  hoch: "aufwändig"
};
function OpportunityCard({
  op,
  expanded,
  onToggle
}) {
  const ersparnisStr = (op.ersparnis || 0) > 0 ? `+ ${fmtEUR(op.ersparnis)}` : "—";
  return /*#__PURE__*/React.createElement("div", {
    className: `opt-card ${expanded ? "expanded" : ""} ${op.bereits_erfasst && op.status !== "warn" ? "done" : ""}`,
    onClick: onToggle,
    role: "button",
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: `opt-badge ${op.status}`
  }, op.status), op.roi_score > 0 && /*#__PURE__*/React.createElement("span", {
    className: "opt-roi-badge",
    title: "ROI-Score: Ersparnis \xF7 Aufwand \xD7 Konfidenz",
    style: {
      fontSize: "10px",
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: "4px",
      marginLeft: "6px",
      background: op.roi_score > 200 ? "oklch(0.94 0.06 145)" : "var(--surface-2)",
      color: op.roi_score > 200 ? "oklch(0.34 0.13 145)" : "var(--text-faint)"
    }
  }, "\u2B06 ", op.roi_score), op.istGeschaetzt && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "9px",
      fontWeight: 600,
      padding: "2px 6px",
      borderRadius: "4px",
      marginLeft: "4px",
      background: "var(--surface-2)",
      color: "var(--text-faint)",
      border: "1px solid var(--border)"
    },
    title: "Gesch\xE4tzte Ersparnis \u2014 kein konkreter Beleg vorhanden"
  }, "~Sch\xE4tzung"), /*#__PURE__*/React.createElement("span", {
    className: "opt-para"
  }, op.paragraph), /*#__PURE__*/React.createElement("span", {
    className: `opt-chip-aufwand ${op.aufwand}`
  }, AUFWAND_LABEL[op.aufwand] || op.aufwand)), /*#__PURE__*/React.createElement("div", {
    className: "opt-card-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-titel"
  }, op.titel, op.bereits_erfasst && op.status !== "warn" && /*#__PURE__*/React.createElement("span", {
    className: "opt-done-mark"
  }, " \xB7 \u2713 Belege da")), /*#__PURE__*/React.createElement("div", {
    className: `opt-ersparnis ${(op.ersparnis || 0) === 0 ? "muted" : ""}`
  }, ersparnisStr)), /*#__PURE__*/React.createElement("div", {
    className: "opt-beschreibung"
  }, op.beschreibung), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-label"
  }, "Anlage"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-value"
  }, op.anlage || "—"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-label"
  }, "Paragraph"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-value"
  }, op.paragraph), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-label"
  }, "Belege n\xF6tig"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-value"
  }, op.belege_noetig ? "ja" : "nein"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-label"
  }, "Bereits erfasst"), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-value"
  }, op.bereits_erfasst ? "ja" : "nein"), op.detail_zahlen && Object.entries(op.detail_zahlen).map(([k, v]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-label"
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "opt-detail-value"
  }, v)))), /*#__PURE__*/React.createElement("div", {
    className: "opt-aktion"
  }, "\u2192 ", op.aktion), /*#__PURE__*/React.createElement("div", {
    className: "opt-disclaimer"
  }, DISCLAIMER)));
}
function TaxOptimizer({
  tweaks = {},
  receipts = [],
  investments = {},
  interviewAnswers = {},
  year,
  open = true,
  onClose
}) {
  const yr = Number(year) || new Date().getFullYear();
  const [filter, setFilter] = React.useState("alle");
  const [expandedId, setExpanded] = React.useState(null);
  const _rawOps = React.useMemo(() => {
    if (typeof buildUserProfile !== "function") return [{
      __noData: true
    }];
    const profile = buildUserProfile(interviewAnswers, tweaks);
    return findOpportunities(profile, receipts, investments, yr);
  }, [tweaks, receipts, investments, interviewAnswers, yr]);
  const noData = _rawOps.length === 1 && _rawOps[0]?.__noData;
  const ops = noData ? [] : _rawOps;

  // Eindeutige Kategorien für Filter
  const kategorien = React.useMemo(() => {
    const set = new Set(ops.map(o => o.kategorie));
    return ["alle", ...Array.from(set)];
  }, [ops]);

  // NEU: Feature D — Gesichert-Filter
  const visible = React.useMemo(() => {
    if (!filter || filter === "alle") return ops;
    if (filter === "__gesichert") return ops.filter(o => !o.istGeschaetzt && (o.ersparnis || 0) > 0);
    return ops.filter(o => o.kategorie === filter);
  }, [ops, filter]);

  // Metriken — echte vs. geschätzte Ersparnisse trennen
  const gesamtEcht = ops.filter(o => !o.istGeschaetzt).reduce((s, o) => s + (o.ersparnis || 0), 0);
  const gesamtGeschaetzt = ops.filter(o => o.istGeschaetzt).reduce((s, o) => s + (o.ersparnis || 0), 0);
  const gesamtpotenzial = gesamtEcht + gesamtGeschaetzt; // für interne Nutzung
  const sofort = ops.filter(o => o.aufwand === "niedrig" && (o.ersparnis || 0) > 0).length;
  const belegeFehlen = ops.filter(o => !o.bereits_erfasst && (o.status === "action" || o.status === "warn") && o.belege_noetig).length;

  // Escape schließt Modal
  React.useEffect(() => {
    if (!open) return;
    const h = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal opt-modal",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-header-title"
  }, "Steuer-Optimierer \xB7 ", yr, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "11px",
      color: "var(--text-faint)",
      marginTop: "2px"
    }
  }, "Sortiert nach ROI-Score (Ersparnis \xF7 Aufwand)")), (gesamtEcht > 0 || gesamtGeschaetzt > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 2
    }
  }, gesamtEcht > 0 && /*#__PURE__*/React.createElement("span", {
    className: "opt-header-pot"
  }, "+ ", fmtEUR(gesamtEcht)), gesamtGeschaetzt > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      fontVariantNumeric: "tabular-nums"
    }
  }, "+ ", fmtEUR(gesamtGeschaetzt), " (Sch\xE4tzung)")), /*#__PURE__*/React.createElement("button", {
    className: "opt-header-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, typeof Icon !== "undefined" && Icon.Close ? /*#__PURE__*/React.createElement(Icon.Close, null) : /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
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
  })))), /*#__PURE__*/React.createElement("div", {
    className: "opt-metrics"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-label"
  }, "Gesichert"), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-value success"
  }, fmtEUR(gesamtEcht))), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-label"
  }, "Sofort umsetzbar"), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-value action"
  }, sofort)), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-label"
  }, "Belege fehlen"), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-value warn"
  }, belegeFehlen))), /*#__PURE__*/React.createElement("div", {
    className: "opt-filters",
    role: "tablist"
  }, /*#__PURE__*/React.createElement("button", {
    className: `opt-filter ${filter === "__gesichert" ? "active" : ""}`,
    onClick: () => setFilter(filter === "__gesichert" ? "alle" : "__gesichert"),
    role: "tab",
    "aria-selected": filter === "__gesichert"
  }, "\u2713 Gesichert (", ops.filter(o => !o.istGeschaetzt && (o.ersparnis || 0) > 0).length, ")"), kategorien.map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: `opt-filter ${filter === k ? "active" : ""}`,
    onClick: () => setFilter(k),
    role: "tab",
    "aria-selected": filter === k
  }, k === "alle" ? `Alle (${ops.length})` : `${KATEGORIE_LABELS[k] || k} (${ops.filter(o => o.kategorie === k).length})`))), /*#__PURE__*/React.createElement("div", {
    className: "opt-list"
  }, noData ? /*#__PURE__*/React.createElement("div", {
    className: "opt-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-empty-emoji"
  }, "\uD83D\uDC64"), /*#__PURE__*/React.createElement("strong", {
    style: {
      display: "block",
      marginBottom: 8,
      color: "var(--text)"
    }
  }, "Pers\xF6nliche Daten fehlen"), "Ohne dein Jahresbruttogehalt kann der Optimierer keine realistischen Steuerersparnisse berechnen. Bitte f\xFClle zuerst deine pers\xF6nlichen Daten aus \u2014 \xFCber den", " ", /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      verticalAlign: "middle"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 20c0-4 3.6-7 8-7s8 3 8 7"
  })), " ", "Button oben rechts im Steuer-Tab.") : visible.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "opt-empty"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-empty-emoji"
  }, "\uD83C\uDFAF"), "Keine offenen Optimierungen in dieser Kategorie. Wechsle den Filter oder erfasse mehr Daten in deinen pers\xF6nlichen Daten.") : visible.map(op => /*#__PURE__*/React.createElement(OpportunityCard, {
    key: op.id,
    op: op,
    expanded: expandedId === op.id,
    onToggle: () => setExpanded(expandedId === op.id ? null : op.id)
  }))))));
}
function OptimizerFAB({
  count = 0,
  onClick
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: `opt-fab ${count > 0 ? "pulse" : ""}`,
    onClick: onClick,
    "aria-label": "Steuer-Optimierer \xF6ffnen",
    title: count > 0 ? `${count} Optimierungs-Chance${count > 1 ? "n" : ""}` : "Steuer-Optimierer"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "2",
    x2: "12",
    y2: "5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "19",
    x2: "12",
    y2: "22"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "12",
    x2: "5",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "19",
    y1: "12",
    x2: "22",
    y2: "12"
  })), count > 0 && /*#__PURE__*/React.createElement("span", {
    className: "opt-fab-badge"
  }, count > 99 ? "99+" : count)));
}

// ════════════════════════════════════════════════════════════════════════
// ── Sicherheits-Export: nicht überschreibbar ────────────────────────────
// ════════════════════════════════════════════════════════════════════════
(function _secureExport() {
  const defs = {
    findOpportunities,
    TaxOptimizer,
    OptimizerFAB
  };
  for (const [k, v] of Object.entries(defs)) {
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
