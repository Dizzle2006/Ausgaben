/* global React, fmtEUR, getK, buildUserProfile, findOpportunities */
// ────────────────────────────────────────────────────────────────────────
// tax-interview.jsx
// Geführter Frage-Flow für Persönliche Daten. Iteriert durch eine Liste
// gefilterter Fragen (Bedingungen werden bei jeder neuen Antwort neu
// ausgewertet) und generiert am Ende einen ELSTER-Vorbereitungs-Report
// mit konkreten Zahlen und Handlungsempfehlungen.
// ────────────────────────────────────────────────────────────────────────

const INTERVIEW_FRAGEN = [
// ── Block 1: Grunddaten ──────────────────────────────────────
{
  id: "beschaeftigung",
  block: "Grunddaten",
  frage: "Wie bist du hauptsächlich tätig?",
  typ: "choice",
  optionen: [{
    wert: "arbeitnehmer",
    label: "Angestellte/r (kein Studium)"
  }, {
    wert: "azubi",
    label: "Auszubildende/r"
  }, {
    wert: "student_dual",
    label: "Duales Studium (Uni + Betrieb + evtl. Berufsschule)"
  }, {
    wert: "student_trial",
    label: "Studienintegrierte Ausbildung (z.B. BHH PVA: Uni + BS + Betrieb)"
  }, {
    wert: "student_voll",
    label: "Vollzeit-Student/in (ohne Ausbildungsvertrag)"
  }, {
    wert: "selbststaendig",
    label: "Selbstständig / Freiberuflich"
  }, {
    wert: "beides",
    label: "Angestellt UND selbstständig"
  }, {
    wert: "rente",
    label: "Rente / Pension"
  }]
}, {
  id: "familienstand",
  block: "Grunddaten",
  frage: "Wie ist dein Familienstand?",
  typ: "choice",
  optionen: [{
    wert: "ledig",
    label: "Ledig"
  }, {
    wert: "verheiratet",
    label: "Verheiratet / eingetragene Partnerschaft"
  }, {
    wert: "geschieden",
    label: "Geschieden / getrennt"
  }]
},
// NEU: Feature 2 — Bundesland + Kirchenmitglied
{
  id: "bundesland",
  block: "Grunddaten",
  typ: "choice",
  frage: "In welchem Bundesland lebst du?",
  hinweis: "Relevant für Kirchensteuer (8 % Bayern/BW, 9 % sonst) und regionale Besonderheiten.",
  optionen: [{
    label: "Bayern",
    wert: "BY"
  }, {
    label: "Baden-Württemberg",
    wert: "BW"
  }, {
    label: "Berlin",
    wert: "BE"
  }, {
    label: "Brandenburg",
    wert: "BB"
  }, {
    label: "Bremen",
    wert: "HB"
  }, {
    label: "Hamburg",
    wert: "HH"
  }, {
    label: "Hessen",
    wert: "HE"
  }, {
    label: "Mecklenburg-Vorpommern",
    wert: "MV"
  }, {
    label: "Niedersachsen",
    wert: "NI"
  }, {
    label: "Nordrhein-Westfalen",
    wert: "NW"
  }, {
    label: "Rheinland-Pfalz",
    wert: "RP"
  }, {
    label: "Saarland",
    wert: "SL"
  }, {
    label: "Sachsen",
    wert: "SN"
  }, {
    label: "Sachsen-Anhalt",
    wert: "ST"
  }, {
    label: "Schleswig-Holstein",
    wert: "SH"
  }, {
    label: "Thüringen",
    wert: "TH"
  }]
}, {
  id: "kirchenmitglied",
  block: "Grunddaten",
  typ: "bool",
  frage: "Bist du Kirchenmitglied (kirchensteuerpflichtig)?",
  bedingung: () => true
}, {
  id: "kinder",
  block: "Grunddaten",
  frage: "Hast du Kinder (unter 18 oder in Ausbildung/Studium)?",
  typ: "bool"
},
// NEU: Feature 3 — Rückwirkende Steuererklärungen
{
  id: "offene_steuerjahre",
  block: "Grunddaten",
  typ: "choice",
  frage: "Für welche vergangenen Jahre hast du KEINE Steuererklärung abgegeben?",
  hinweis: "Freiwillig bis 4 Jahre rückwirkend möglich. Durchschnittliche Erstattung laut Statistischem Bundesamt: ~1.100 € / Jahr.",
  optionen: [{
    label: "Alle abgegeben (kein Nachholbedarf)",
    wert: "alle"
  }, {
    label: "1 Jahr offen",
    wert: "1"
  }, {
    label: "2 Jahre offen",
    wert: "2"
  }, {
    label: "3 Jahre offen",
    wert: "3"
  }, {
    label: "4 Jahre offen",
    wert: "4"
  }]
},
// ── Block 2: Studium ─────────────────────────────────────────
{
  id: "studium_typ",
  block: "Studium",
  frage: "Was für ein Studium ist es?",
  typ: "choice",
  optionen: [{
    wert: "erst",
    label: "Erststudium (Bachelor oder erstes Studium nach Schule)"
  }, {
    wert: "zweit",
    label: "Zweitstudium / Master (nach abgeschlossenem Erststudium)"
  }, {
    wert: "weiterbildung",
    label: "Berufsbegleitende Weiterbildung mit Abschluss"
  }],
  bedingung: a => ["student_dual", "student_trial", "student_voll"].includes(a.beschaeftigung)
}, {
  id: "betrieb_tage",
  block: "Studium",
  frage: "Wie viele Tage warst du im Betrieb (Unternehmen)?",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 365,
  hinweis: a => {
    const yr = new Date().getFullYear();
    const K = typeof getK === "function" ? getK(yr) : null;
    const satz = K ? yr >= 2026 ? "0,38 €/km (ab km 1)" : "0,30 €/km bis 20 km, 0,38 €/km ab km 21" : "0,38 €/km";
    return `Nur echte Betriebstage — nicht Uni, nicht Berufsschule. Pendlerpauschale ${yr}: ${satz}.`;
  },
  bedingung: a => ["student_dual", "student_trial"].includes(a.beschaeftigung)
}, {
  id: "berufsschule_tage",
  block: "Studium",
  frage: "Wie viele Tage warst du an der Berufsschule?",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 365,
  hinweis: a => {
    const yr = new Date().getFullYear();
    const K = typeof getK === "function" ? getK(yr) : null;
    const satz = K ? yr >= 2026 ? "0,38 €/km (ab km 1)" : "0,30 €/km bis 20 km, 0,38 €/km ab km 21" : "0,38 €/km";
    return `Berufsschulfahrten sind Werbungskosten (beruflich veranlasst). Pendlerpauschale ${yr}: ${satz}.`;
  },
  bedingung: a => ["student_dual", "student_trial", "azubi"].includes(a.beschaeftigung)
}, {
  id: "uni_tage",
  block: "Studium",
  frage: "Wie viele Tage warst du an der Hochschule / Uni?",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 365,
  bedingung: a => ["student_dual", "student_trial", "student_voll"].includes(a.beschaeftigung)
}, {
  id: "km_betrieb",
  block: "Studium",
  frage: "Einfache Entfernung zum Betrieb (km)?",
  typ: "number",
  einheit: "km",
  min: 0,
  max: 300,
  hinweis: a => {
    const yr = new Date().getFullYear();
    const K = typeof getK === "function" ? getK(yr) : null;
    const satz = K ? yr >= 2026 ? "0,38 €/km ab km 1" : "0,30 €/km bis 20 km · 0,38 €/km ab km 21" : "0,38 €/km";
    return `Pendlerpauschale (§ 9 EStG) — immer Werbungskosten. Satz ${yr}: ${satz}.`;
  },
  bedingung: a => ["student_dual", "student_trial"].includes(a.beschaeftigung)
}, {
  id: "km_berufsschule",
  block: "Studium",
  frage: "Einfache Entfernung zur Berufsschule (km)?",
  typ: "number",
  einheit: "km",
  min: 0,
  max: 300,
  hinweis: a => {
    const yr = new Date().getFullYear();
    const K = typeof getK === "function" ? getK(yr) : null;
    const satz = K ? yr >= 2026 ? "0,38 €/km ab km 1" : "0,30 €/km bis 20 km · 0,38 €/km ab km 21" : "0,38 €/km";
    return `Berufsschulfahrten: Werbungskosten (§ 9 EStG). Satz ${yr}: ${satz}.`;
  },
  bedingung: a => ["student_dual", "student_trial", "azubi"].includes(a.beschaeftigung)
}, {
  id: "km_uni",
  block: "Studium",
  frage: "Einfache Entfernung zur Hochschule / Uni (km)?",
  typ: "number",
  einheit: "km",
  min: 0,
  max: 300,
  hinweis: a => a.studium_typ === "erst" ? "Erststudium: Uni-Fahrtkosten sind Sonderausgaben (max. 6.000 € gesamt), nicht Werbungskosten." : "Zweitstudium/Master: Uni-Fahrtkosten sind Werbungskosten — voll absetzbar.",
  bedingung: a => ["student_dual", "student_trial", "student_voll"].includes(a.beschaeftigung)
},
// ── Block 3: Arbeit ──────────────────────────────────────────
{
  id: "brutto",
  block: "Arbeit",
  frage: "Wie hoch ist dein Jahresbrutto (aus Arbeitsverhältnis)?",
  typ: "number",
  einheit: "€",
  min: 0,
  max: 500000,
  hinweis: "Bei Studierenden/Azubis: Ausbildungsvergütung (Jahressumme). Bei Rente: Jahresrente brutto."
},
// NEU: Feature 2 — KV, Riester, bAV
{
  id: "kv_beitrag_jahres",
  block: "Arbeit",
  typ: "number",
  frage: "Wie hoch sind deine jährlichen Krankenversicherungs-Beiträge (Arbeitnehmeranteil)?",
  hinweis: "Steht auf deiner Lohnsteuerbescheinigung, Zeile 23 + 25. Für GKV ca. 7–8 % des Bruttos.",
  einheit: "€ / Jahr",
  min: 0,
  max: 20000,
  bedingung: a => !!a.brutto
}, {
  id: "riester_eigenanteil",
  block: "Arbeit",
  typ: "number",
  frage: "Wie viel zahlst du jährlich in deinen Riester-Vertrag (eigener Beitrag, ohne Zulage)?",
  hinweis: "Nur wenn du einen Riester-Vertrag hast. Beitragsquittung vom Anbieter.",
  einheit: "€ / Jahr",
  min: 0,
  max: 5000,
  bedingung: a => !!a.brutto
}, {
  id: "bav_beitrag_jahres",
  block: "Arbeit",
  typ: "number",
  frage: "Hast du eine betriebliche Altersvorsorge (bAV)? Wenn ja: jährlicher Eigenbeitrag?",
  hinweis: "bAV-Beiträge bis 4 % der Beitragsbemessungsgrenze sind steuerfrei (§3 Nr. 63 EStG).",
  einheit: "€ / Jahr",
  min: 0,
  max: 10000,
  bedingung: a => !!a.brutto
}, {
  id: "telefon_kosten_jahres",
  block: "Arbeit",
  typ: "number",
  frage: "Wie hoch sind deine jährlichen Telefon- und Internetkosten (privat + beruflich)?",
  hinweis: "20 % davon (max. 240 €/Jahr) sind ohne Einzelnachweis als Werbungskosten absetzbar.",
  einheit: "€ / Jahr",
  min: 0,
  max: 5000,
  bedingung: a => !!a.brutto
}, {
  id: "homeoffice_tage",
  block: "Arbeit",
  frage: "Wie viele Tage hast du im Homeoffice gearbeitet?",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 260,
  hinweis: "6 € pro Tag, max. 210 Tage = bis zu 1.260 €. Auch bei Studienintegrierter Ausbildung anwendbar.",
  bedingung: a => ["arbeitnehmer", "beides", "student_dual", "student_trial"].includes(a.beschaeftigung)
}, {
  id: "entfernung_km",
  block: "Arbeit",
  frage: "Wie weit ist dein Arbeitsweg (einfache Strecke in km)?",
  typ: "number",
  einheit: "km",
  min: 0,
  max: 300,
  hinweis: "Wird für die Pendlerpauschale (Anlage N) benötigt.",
  bedingung: a => ["arbeitnehmer", "beides"].includes(a.beschaeftigung)
}, {
  id: "arbeitstage",
  block: "Arbeit",
  frage: "An wie vielen Tagen bist du ins Büro gefahren?",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 260,
  bedingung: a => ["arbeitnehmer", "beides"].includes(a.beschaeftigung) && (Number(a.entfernung_km) || 0) > 0
}, {
  id: "zweiter_standort",
  block: "Arbeit",
  typ: "bool",
  frage: "Hast du einen weiteren regelmäßigen Arbeitsstandort (Kundenbüro, Zweigstelle, Außenstelle …)?",
  hinweis: "Die Pendlerpauschale gilt für jeden Standort separat — jeder Weg zählt.",
  bedingung: a => ["arbeitnehmer", "beides"].includes(a.beschaeftigung)
}, {
  id: "zweiter_standort_km",
  block: "Arbeit",
  typ: "number",
  einheit: "km",
  min: 0,
  max: 300,
  frage: "Einfache Entfernung zum zweiten Standort (km)?",
  hinweis: "Nur die einfache Strecke — die Pendlerpauschale rechnet immer mit der einfachen Entfernung.",
  bedingung: a => a.zweiter_standort === true
}, {
  id: "zweiter_standort_tage",
  block: "Arbeit",
  typ: "number",
  einheit: "Tage",
  min: 0,
  max: 260,
  frage: "Wie viele Tage pro Jahr bist du an diesem zweiten Standort?",
  bedingung: a => a.zweiter_standort === true && (Number(a.zweiter_standort_km) || 0) > 0
}, {
  id: "fortbildung",
  block: "Arbeit",
  frage: "Hattest du Ausgaben für Fortbildungen, Fachliteratur oder Arbeitsmittel?",
  typ: "bool",
  hinweis: "Kurse, Fachbücher, Laptop, Headset — Werbungskosten.",
  bedingung: a => ["arbeitnehmer", "beides"].includes(a.beschaeftigung)
}, {
  id: "gewerkschaft",
  block: "Arbeit",
  frage: "Bist du Gewerkschaftsmitglied?",
  typ: "bool",
  hinweis: "Beiträge vollständig absetzbar — ab 2026 zusätzlich zur WK-Pauschale.",
  bedingung: a => ["arbeitnehmer", "beides", "azubi"].includes(a.beschaeftigung)
},
// ── Block 4: Kapital ─────────────────────────────────────────
{
  id: "kapitalertraege",
  block: "Kapital",
  frage: "Hast du Kapitalerträge (Dividenden, realisierte Kursgewinne)?",
  typ: "bool",
  hinweis: "Sparerpauschbetrag: 1.000 € (Single) / 2.000 € (verheiratet)."
},
// ── Block 5: Wohnen ──────────────────────────────────────────
{
  id: "handwerker",
  block: "Wohnen",
  frage: "Hast du Handwerker oder haushaltsnahe Dienstleister bezahlt?",
  typ: "bool",
  hinweis: "20% der Lohnkosten absetzbar, max. 1.200 € / Jahr."
}, {
  id: "pflege_angehoerige",
  block: "Wohnen",
  typ: "bool",
  frage: "Pflegst du unentgeltlich einen Angehörigen (Pflegegrad 2 oder höher)?",
  hinweis: "Pflegepauschbetrag 924 € ohne Einzelnachweis absetzbar (§33b EStG).",
  bedingung: () => true
}, {
  id: "vermieter",
  block: "Wohnen",
  frage: "Vermietest du eine Immobilie?",
  typ: "bool",
  hinweis: "→ Anlage V+V erforderlich."
},
// ── Block 5b: Vermietung (§21 EStG / Anlage V+V) ───────────────
{
  id: "vv_mieteinnahmen",
  block: "Vermietung",
  frage: "Wie hoch sind deine jährlichen Mieteinnahmen (brutto, inkl. Nebenkosten)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 500000,
  hinweis: "Kaltmiete + Vorauszahlungen für Nebenkosten. Anlage V+V Zeile 7.",
  bedingung: a => a.vermieter === true
}, {
  id: "vv_schuldzinsen",
  block: "Vermietung",
  frage: "Wie hoch sind deine jährlichen Schuldzinsen (Immobiliendarlehen)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 100000,
  hinweis: "Zinsen (nicht Tilgung!) sind Werbungskosten. Anlage V+V Zeile 17.",
  bedingung: a => a.vermieter === true
}, {
  id: "vv_afa_betrag",
  block: "Vermietung",
  frage: "Wie hoch ist deine jährliche Abschreibung (AfA)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 50000,
  hinweis: "i.d.R. 2 % des Gebäudewerts p.a. (§ 7 Abs.4 EStG). Anlage V+V Zeile 33.",
  bedingung: a => a.vermieter === true
}, {
  id: "vv_instandhaltung",
  block: "Vermietung",
  frage: "Instandhaltungs- und Reparaturkosten (im Steuerjahr)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 200000,
  hinweis: "Kosten für Reparaturen, Renovierungen — sofort abzugsfähig wenn < 15 % der AK/HK.",
  bedingung: a => a.vermieter === true
}, {
  id: "vv_verwaltung",
  block: "Vermietung",
  frage: "Hausverwalter-, Kontoführungs- und Versicherungskosten?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 20000,
  hinweis: "Hausverwaltung, Gebäudeversicherung, Kontoführungsgebühren — alle Werbungskosten.",
  bedingung: a => a.vermieter === true
}, {
  id: "vv_sonstige_wk",
  block: "Vermietung",
  frage: "Sonstige Werbungskosten (Fahrtkosten, Rechtsberatung, …)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 50000,
  hinweis: "Fahrten zur Immobilie, Steuerberatungskosten, Inserate u.ä. Anlage V+V Zeile 40+.",
  bedingung: a => a.vermieter === true
},
// ── Block 5c: EÜR für Selbstständige (§4 Abs.3 EStG) ────────────
{
  id: "euer_einnahmen",
  block: "EÜR",
  frage: "Wie hoch sind deine Betriebseinnahmen (Jahresumsatz inkl. USt, falls keine Kleinunternehmer)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 2000000,
  hinweis: "Alle Einnahmen aus selbstständiger Tätigkeit im Steuerjahr. Anlage EÜR Zeile 14.",
  bedingung: a => ["selbststaendig", "beides"].includes(a.beschaeftigung)
}, {
  id: "euer_wareneinsatz",
  block: "EÜR",
  frage: "Wie hoch sind deine Wareneinsatz- und Materialkosten?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 1000000,
  hinweis: "Einkäufe, Material, Unterauftragnehmer — direkte Betriebsausgaben. Anlage EÜR Zeile 21ff.",
  bedingung: a => ["selbststaendig", "beides"].includes(a.beschaeftigung)
}, {
  id: "euer_sonstige_ba",
  block: "EÜR",
  frage: "Sonstige Betriebsausgaben (Büro, Software, Reisen, Fortbildung, …)?",
  typ: "number",
  einheit: "€ / Jahr",
  min: 0,
  max: 500000,
  hinweis: "Alle weiteren abzugsfähigen Betriebsausgaben. Bei Zweifel: lieber angeben und vom Steuerberater prüfen lassen.",
  bedingung: a => ["selbststaendig", "beides"].includes(a.beschaeftigung)
}, {
  id: "umzug",
  block: "Wohnen",
  frage: "Bist du aus beruflichen Gründen umgezogen?",
  typ: "bool",
  hinweis: "Umzugskosten als Werbungskosten absetzbar (§ 9 Abs. 1 Satz 3 Nr. 5 EStG).",
  bedingung: a => ["arbeitnehmer", "beides", "student_dual", "student_trial"].includes(a.beschaeftigung)
},
// ── Block 6: Gesundheit & Sonstiges ─────────────────────────
{
  id: "krankenkosten",
  block: "Gesundheit",
  frage: "Hattest du außergewöhnliche Krankheitskosten?",
  typ: "bool",
  hinweis: "Zahnarzt, Brille, Therapie — über zumutbarer Eigenbelastung absetzbar."
}, {
  id: "behinderung",
  block: "Gesundheit",
  frage: "Hast du einen anerkannten Behinderungsgrad (GdB)?",
  typ: "bool",
  hinweis: "Behinderten-Pauschbetrag 384–7.400 € je nach GdB."
}, {
  id: "behinderungsgrad",
  block: "Gesundheit",
  frage: "Wie hoch ist dein GdB (Grad der Behinderung)?",
  typ: "choice",
  optionen: [{
    wert: 20,
    label: "GdB 20"
  }, {
    wert: 30,
    label: "GdB 30"
  }, {
    wert: 50,
    label: "GdB 50"
  }, {
    wert: 70,
    label: "GdB 70"
  }, {
    wert: 80,
    label: "GdB 80"
  }, {
    wert: 100,
    label: "GdB 100"
  }],
  hinweis: "Der Pauschbetrag richtet sich nach deinem GdB (§33b EStG).",
  bedingung: a => a.behinderung === true
}, {
  id: "spenden",
  block: "Sonstiges",
  frage: "Hast du Spenden geleistet oder Mitgliedsbeiträge gezahlt?",
  typ: "bool",
  hinweis: "Spendenquittung erforderlich."
},
// NEU: Feature 2 — Unterhalt
{
  id: "unterhalt_zahler",
  block: "Sonstiges",
  typ: "bool",
  frage: "Zahlst du Unterhalt an einen Ex-Partner oder bedürftige Angehörige?",
  hinweis: "Bis zum Grundfreibetrag (§33a EStG) als außergewöhnliche Belastung absetzbar.",
  bedingung: () => true
}, {
  id: "unterhalt_betrag_jahres",
  block: "Sonstiges",
  typ: "number",
  frage: "Wie hoch sind deine jährlichen Unterhaltszahlungen?",
  einheit: "€ / Jahr",
  min: 0,
  max: 50000,
  bedingung: a => a.unterhalt_zahler === true
},
// ── Lohnsteuerbescheinigung ──────────────────────────────────
{
  id: "gezahlte_lohnsteuer",
  block: "Lohnsteuerbescheinigung",
  frage: "Wie viel Lohnsteuer wurde vom Arbeitgeber einbehalten? (Zeile 4)",
  typ: "number",
  einheit: "€",
  min: 0,
  max: 200000,
  hinweis: "Steht auf deiner Lohnsteuerbescheinigung — Zeile 4. Bei Studierenden/Azubis: Zeile 4.",
  bedingung: a => ["arbeitnehmer", "beides", "student_dual", "student_trial", "azubi"].includes(a.beschaeftigung)
}, {
  id: "gezahlter_soli",
  block: "Lohnsteuerbescheinigung",
  frage: "Wie viel Solidaritätszuschlag wurde einbehalten? (Zeile 5)",
  typ: "number",
  einheit: "€",
  min: 0,
  max: 20000,
  hinweis: "Zeile 5 der Lohnsteuerbescheinigung. Oft 0,00 € — dann einfach 0 eingeben.",
  bedingung: a => ["arbeitnehmer", "beides", "student_dual", "student_trial", "azubi"].includes(a.beschaeftigung)
}];

// ── Persönliche-Daten-Komponente ──────────────────────────────
function TaxInterview({
  receipts,
  investments,
  year,
  tweaks = {},
  onClose
}) {
  // Vor-Befüllung aus Steuer-Profil + persistierte Antworten aus localStorage
  const initial = React.useMemo(() => {
    const a = {};
    if (tweaks.berufstyp) a.beschaeftigung = tweaks.berufstyp;
    if (tweaks.familienstand) a.familienstand = tweaks.familienstand;
    try {
      const stored = window.__decryptedInterviewAnswers;
      if (stored && typeof stored === "object") Object.assign(a, stored);
    } catch {/* ignore */}
    return a;
  }, [tweaks.berufstyp, tweaks.familienstand]);
  const [answers, setAnswers] = React.useState(initial);
  const [current, setCurrent] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [showResult, setShowResult] = React.useState(false);

  // Persistiere Antworten in localStorage (für tax-optimizer.jsx und andere)
  React.useEffect(() => {
    try {
      if (typeof window.secureSetInterviewAnswers === "function") {
        window.secureSetInterviewAnswers(answers);
      }
      // Kein Klartext-Fallback — ohne secureSetInterviewAnswers (crypto.jsx) werden
      // sensible Daten nicht gespeichert. Ladereihenfolge in index.html stellt sicher,
      // dass crypto.jsx immer vor tax-interview.jsx geladen wird.
      window.dispatchEvent(new CustomEvent("interview-answers-updated", {
        detail: answers
      }));
    } catch {/* quota etc. */}
  }, [answers]);
  const fragen = React.useMemo(() => INTERVIEW_FRAGEN.filter(f => !f.bedingung || f.bedingung(answers)), [answers]);
  const frage = fragen[current];
  const progress = fragen.length > 0 ? current / fragen.length * 100 : 0;
  const answer = (key, val) => {
    setAnswers(a => ({
      ...a,
      [key]: val
    }));
    setTimeout(() => {
      setCurrent(c => {
        if (c < fragen.length - 1) return c + 1;
        setDone(true);
        return c;
      });
    }, 160);
  };
  const numInputRef = React.useRef(null);
  if (done && showResult) {
    return /*#__PURE__*/React.createElement(InterviewResult, {
      answers: answers,
      receipts: receipts,
      investments: investments,
      year: year,
      tweaks: tweaks,
      onRestart: () => {
        setAnswers(initial);
        setCurrent(0);
        setDone(false);
        setShowResult(false);
      },
      onClose: onClose
    });
  }
  if (done && !showResult) {
    return /*#__PURE__*/React.createElement(LohnsteuerUploadStep, {
      year: year,
      onContinue: () => setShowResult(true),
      onSkip: () => setShowResult(true)
    });
  }
  if (!frage) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-eyebrow"
  }, frage.block, " \xB7 Frage ", current + 1, " / ", fragen.length), (() => {
    const BLOCK_ORDER = ["Grunddaten", "Studium", "Arbeit", "Kapital", "Wohnen", "Vermietung", "EÜR", "Gesundheit", "Sonstiges", "Lohnsteuerbescheinigung"];
    const sichtbareBlocks = BLOCK_ORDER.filter(b => fragen.some(f => f.block === b));
    const curIdx = sichtbareBlocks.indexOf(frage.block);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        padding: "4px 0 2px"
      }
    }, sichtbareBlocks.map((b, i) => /*#__PURE__*/React.createElement("span", {
      key: b,
      style: {
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: b === frage.block ? "var(--text)" : i < curIdx ? "oklch(0.94 0.06 145)" : "var(--surface-2)",
        color: b === frage.block ? "var(--bg)" : i < curIdx ? "oklch(0.34 0.13 145)" : "var(--text-faint)"
      }
    }, i < curIdx ? "✓ " : "", b)));
  })(), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
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
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-progress"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-progress-fill",
    style: {
      width: `${progress}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-body"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "interview-frage"
  }, frage.frage), frage.hinweis && /*#__PURE__*/React.createElement("div", {
    className: "interview-hinweis"
  }, typeof frage.hinweis === "function" ? frage.hinweis(answers) : frage.hinweis), frage.typ === "choice" && /*#__PURE__*/React.createElement("div", {
    className: "interview-options"
  }, frage.optionen.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.wert,
    className: `interview-option ${answers[frage.id] === o.wert ? "active" : ""}`,
    onClick: () => answer(frage.id, o.wert)
  }, o.label))), frage.typ === "bool" && /*#__PURE__*/React.createElement("div", {
    className: "interview-bool"
  }, [["Ja", true], ["Nein", false]].map(([l, v]) => /*#__PURE__*/React.createElement("button", {
    key: l,
    className: `interview-option ${answers[frage.id] === v ? "active" : ""}`,
    onClick: () => answer(frage.id, v)
  }, l))), frage.typ === "number" && /*#__PURE__*/React.createElement("div", {
    className: "interview-number"
  }, /*#__PURE__*/React.createElement("div", {
    className: "interview-number-row"
  }, /*#__PURE__*/React.createElement("input", {
    ref: numInputRef,
    type: "number",
    min: frage.min ?? 0,
    max: frage.max ?? 9999,
    step: "1",
    defaultValue: answers[frage.id] ?? "",
    autoFocus: true,
    onKeyDown: e => {
      if (e.key === "Enter") {
        const v = Number(numInputRef.current?.value) || 0;
        answer(frage.id, v);
      }
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "interview-einheit"
  }, frage.einheit)), /*#__PURE__*/React.createElement("button", {
    className: "interview-next",
    onClick: () => {
      const v = Number(numInputRef.current?.value) || 0;
      answer(frage.id, v);
    }
  }, "Weiter")), current > 0 && /*#__PURE__*/React.createElement("button", {
    className: "interview-back",
    onClick: () => setCurrent(c => Math.max(0, c - 1))
  }, "\u2190 Zur\xFCck"))));
}

// ── Lohnsteuerbescheinigung-Status-Card ────────────────────────
function LohnsteuerBescheinigungCard({
  year
}) {
  const idbKey = `lohnsteuerbescheinigung-${year}`;
  const [hasImage, setHasImage] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    (async () => {
      try {
        const entry = await window.idbGetImage(idbKey);
        if (entry?.dataUrl) {
          setHasImage(true);
          setPreview(entry.dataUrl);
        }
      } catch {/* ignore */}
    })();
  }, [idbKey]);
  const handleFile = async file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      await window.idbPutImage(idbKey, dataUrl, file.type || "image/jpeg");
      setPreview(dataUrl);
      setHasImage(true);
    };
    reader.readAsDataURL(file);
  };
  const handleDelete = async () => {
    await window.idbDeleteImage(idbKey);
    setPreview(null);
    setHasImage(false);
    setExpanded(false);
  };
  const isPdf = preview?.startsWith("data:application/pdf");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14,
      background: hasImage ? "oklch(0.96 0.03 145)" : "var(--surface-2)",
      border: `1px solid ${hasImage ? "oklch(0.80 0.10 145)" : "var(--border)"}`,
      borderRadius: 12,
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      color: hasImage ? "oklch(0.52 0.14 145)" : "var(--text-faint)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: hasImage ? "oklch(0.34 0.13 145)" : "var(--text-muted)",
      fontWeight: 500
    }
  }, `Lohnsteuerbescheinigung ${year}${hasImage ? " — gespeichert ✓" : " — nicht hochgeladen"}`)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, hasImage && /*#__PURE__*/React.createElement("button", {
    onClick: () => setExpanded(v => !v),
    style: {
      fontSize: 11,
      padding: "3px 10px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--text-muted)"
    }
  }, expanded ? "Ausblenden" : "Anzeigen"), hasImage && /*#__PURE__*/React.createElement("button", {
    onClick: handleDelete,
    style: {
      fontSize: 11,
      padding: "3px 10px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--text-muted)"
    }
  }, "Löschen"), !hasImage && /*#__PURE__*/React.createElement("button", {
    onClick: () => inputRef.current?.click(),
    style: {
      fontSize: 11,
      padding: "3px 10px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--text-muted)"
    }
  }, "Hochladen"), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/*,application/pdf",
    style: {
      display: "none"
    },
    onChange: e => handleFile(e.target.files[0])
  }))), expanded && preview && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, isPdf ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      textAlign: "center",
      padding: 8
    }
  }, "PDF gespeichert (Vorschau nicht m\xF6glich)") : /*#__PURE__*/React.createElement("img", {
    src: preview,
    alt: "Lohnsteuerbescheinigung",
    style: {
      width: "100%",
      maxHeight: 200,
      objectFit: "contain",
      borderRadius: 8
    }
  })));
}

// ── Upload: Lohnsteuerbescheinigung ────────────────────────────
function LohnsteuerUploadStep({
  year,
  onContinue,
  onSkip
}) {
  const idbKey = `lohnsteuerbescheinigung-${year}`;
  const [preview, setPreview] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    (async () => {
      try {
        const entry = await window.idbGetImage(idbKey);
        if (entry?.dataUrl) setPreview(entry.dataUrl);
      } catch {/* ignore */}
    })();
  }, [idbKey]);
  const handleFile = async file => {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async e => {
        const dataUrl = e.target.result;
        const mediaType = file.type || "image/jpeg";
        await window.idbPutImage(idbKey, dataUrl, mediaType);
        setPreview(dataUrl);
        setSaved(true);
        setLoading(false);
      };
      reader.onerror = () => setLoading(false);
      reader.readAsDataURL(file);
    } catch {
      setLoading(false);
    }
  };
  const handleDelete = async () => {
    try {
      await window.idbDeleteImage(idbKey);
      setPreview(null);
      setSaved(false);
    } catch {/* ignore */}
  };
  const isPdf = preview?.startsWith("data:application/pdf");
  return /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-backdrop",
    onClick: onSkip
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-eyebrow"
  }, "Optional \xB7 Lohnsteuerbescheinigung"), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onSkip,
    "aria-label": "\xDCberspringen"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
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
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-body"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: "var(--text-muted)",
      marginBottom: 16,
      lineHeight: 1.5
    }
  }, "Lade deine Lohnsteuerbescheinigung als Foto oder PDF hoch \u2014 zur Archivierung. Sie wird lokal gespeichert und verl\xE4sst dein Ger\xE4t nicht."), !preview ? /*#__PURE__*/React.createElement("div", {
    className: "scanner-drop-zone",
    style: {
      minHeight: 120,
      cursor: "pointer"
    },
    onClick: () => inputRef.current?.click(),
    onDragOver: e => e.preventDefault(),
    onDrop: e => {
      e.preventDefault();
      handleFile(e.dataTransfer.files[0]);
    }
  }, loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-muted)",
      fontSize: 13
    }
  }, "Wird gespeichert\u2026") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "28",
    height: "28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      color: "var(--text-faint)",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 8 12 3 7 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "3",
    x2: "12",
    y2: "15"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, "Foto oder PDF ausw\xE4hlen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginTop: 4
    }
  }, "JPG, PNG oder PDF \xB7 wird nur lokal gespeichert")), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/*,application/pdf",
    style: {
      display: "none"
    },
    onChange: e => handleFile(e.target.files[0])
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, isPdf ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-2)",
      borderRadius: 10,
      padding: "24px 16px",
      textAlign: "center",
      color: "var(--text-muted)",
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "32",
    height: "32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      marginBottom: 8,
      display: "block",
      margin: "0 auto 8px"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  })), "PDF gespeichert ", "✓") : /*#__PURE__*/React.createElement("img", {
    src: preview,
    alt: "Lohnsteuerbescheinigung",
    style: {
      width: "100%",
      borderRadius: 10,
      maxHeight: 220,
      objectFit: "contain",
      background: "var(--surface-2)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleDelete,
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "4px 10px",
      fontSize: 11,
      color: "var(--text-muted)",
      cursor: "pointer"
    }
  }, "Entfernen"), saved && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: "oklch(0.52 0.14 145)",
      textAlign: "center"
    }
  }, "✓", " Lokal gespeichert")), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-actions",
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onSkip
  }, "\xDCberspringen"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: onContinue
  }, preview ? "Weiter zur Auswertung" : "Ohne Dokument weiter")))));
}

// ── Ausgeschlossene Positionen Accordion ────────────────────────
function AusgeschlossenesAccordion({
  positionen
}) {
  const [open, setOpen] = React.useState(false);
  if (!positionen || positionen.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      width: "100%",
      textAlign: "left",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "9px 14px",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-muted)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "inherit"
    }
  }, /*#__PURE__*/React.createElement("span", null, open ? "▲" : "▼"), /*#__PURE__*/React.createElement("span", null, positionen.length, " Position", positionen.length > 1 ? "en" : "", " gilt nicht f\xFCr dich")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, positionen.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text)",
      marginBottom: 4
    }
  }, p.titel), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "oklch(0.55 0.16 50)",
      lineHeight: 1.45
    }
  }, "\u26A0 ", p.grund)))));
}

// ── Ergebnis: situationsspezifischer Steuerberater-Report ────────
function InterviewResult({
  answers,
  receipts,
  investments,
  year,
  tweaks,
  onRestart,
  onClose
}) {
  const y = String(year);
  const profile = React.useMemo(() => typeof buildUserProfile === "function" ? buildUserProfile(answers, tweaks) : null, [answers, tweaks]);
  const ops = React.useMemo(() => {
    if (!profile || typeof findOpportunities !== "function") return [];
    const result = findOpportunities(profile, receipts, investments, year);
    if (result.length === 1 && result[0] && result[0].__noData) return [];
    return result;
  }, [profile, receipts, investments, year]);
  const ausgeschlossen = profile ? profile.ausgeschlossenePositionen : [];
  const ersparnisGesamt = ops.filter(o => !o.istGeschaetzt && (o.ersparnis || 0) > 0).reduce((s, o) => s + (o.ersparnis || 0), 0);
  const lohntEinzeln = ops.filter(o => o.status === "lohnt");
  const zuPruefen = ops.filter(o => o.status === "action" || o.status === "warn");
  const hinweise = ops.filter(o => o.status === "info");
  const exportCSV = () => {
    const lines = [];
    lines.push("﻿Steuerberatung;Steuerjahr " + y);
    lines.push("Erstellt;" + new Date().toLocaleDateString("de-DE"));
    lines.push("Profil;" + (profile ? profile.beschaeftigung : "-"));
    lines.push("Brutto;" + (profile ? profile.brutto : 0).toFixed(2).replace(".", ","));
    lines.push("");
    lines.push("Was du geltend machen kannst");
    for (const op of ops) {
      const eur = (op.ersparnis || 0) > 0 ? op.ersparnis.toFixed(2).replace(".", ",") : "(Prüfen)";
      lines.push(op.titel + ";" + eur + ";" + (op.paragraph || "") + ";" + (op.anlage || ""));
    }
    lines.push("");
    lines.push("Nicht anwendbar");
    for (const p of ausgeschlossen) {
      lines.push(p.titel + ";" + p.grund);
    }
    lines.push("");
    lines.push("HINWEIS;Diese Datei ersetzt keine Steuerberatung.");
    const csv = lines.join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "steuerberatung-" + y + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const OpCard = ({
    op
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "11px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--text)"
    }
  }, op.titel), (op.ersparnis || 0) > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "oklch(0.5 0.14 145)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap"
    }
  }, "+", fmtEUR(op.ersparnis))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)",
      marginTop: 3,
      lineHeight: 1.45
    }
  }, op.beschreibung), op.aktion && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--accent)",
      marginTop: 6,
      fontWeight: 600
    }
  }, "\u2192 ", op.aktion), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginTop: 3
    }
  }, op.paragraph, op.anlage ? " · " + op.anlage : ""));
  return /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-header"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "tax-modal-title"
  }, "Steuerberatung ", year), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
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
  })))), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-body"
  }, /*#__PURE__*/React.createElement(LohnsteuerBescheinigungCard, {
    year: year
  }), answers.vermieter === true && typeof window.VermietungCard === "function" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: 8
    }
  }, "Anlage V+V \u2014 Vermietung & Verpachtung"), React.createElement(window.VermietungCard, {
    interviewAnswers: answers,
    year
  })), ["selbststaendig", "beides"].includes(answers.beschaeftigung) && typeof window.EUERCard === "function" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: 8
    }
  }, "Anlage E\xDCR \u2014 Einnahmen-\xDCberschuss-Rechnung"), React.createElement(window.EUERCard, {
    interviewAnswers: answers,
    receipts,
    year
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-label"
  }, "Gesichertes Potenzial"), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-value success"
  }, ersparnisGesamt > 0 ? fmtEUR(ersparnisGesamt) : "—")), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric"
  }, /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-label"
  }, "Positionen"), /*#__PURE__*/React.createElement("div", {
    className: "opt-metric-value action"
  }, lohntEinzeln.length + zuPruefen.length))), lohntEinzeln.length + zuPruefen.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: 8
    }
  }, "Was du geltend machen kannst"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, [...lohntEinzeln, ...zuPruefen].map(op => /*#__PURE__*/React.createElement(OpCard, {
    key: op.id,
    op: op
  })))), hinweise.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--text-faint)",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      marginBottom: 8
    }
  }, "Hinweise & Optionen"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, hinweise.map(op => /*#__PURE__*/React.createElement("div", {
    key: op.id,
    style: {
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "9px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text)"
    }
  }, op.titel), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      marginTop: 2,
      lineHeight: 1.4
    }
  }, op.beschreibung))))), /*#__PURE__*/React.createElement(AusgeschlossenesAccordion, {
    positionen: ausgeschlossen
  }), ops.length === 0 && ausgeschlossen.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "28px 18px",
      color: "var(--text-muted)",
      fontSize: 14
    }
  }, "Keine Positionen gefunden. Gib mehr Daten ein oder erfasse Belege im Scanner-Tab."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: "10px 12px",
      background: "var(--surface-2)",
      borderRadius: 10,
      fontSize: 11.5,
      color: "var(--text-faint)",
      lineHeight: 1.5
    }
  }, "Alle Angaben vereinfacht \u2014 keine Steuerberatung. Werte manuell in ELSTER pr\xFCfen."), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-actions",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onRestart
  }, "Neu starten"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: exportCSV
  }, "CSV exportieren")))));
}
(function _secureExport() {
  const _defs = {
    TaxInterview
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
