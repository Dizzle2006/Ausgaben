/* global React, fmtEUR, getK, calcGrenzsteuersatz, calcZumutbareEigenbelastung */
// ────────────────────────────────────────────────────────────────────────
// tax-einspruch.jsx
// Generator für einen formgerechten Einspruchs-Brief nach § 347 AO.
// Liest absetzbare Beträge aus state.receipts vor, kombiniert sie mit
// freitext-Begründung und gibt einen kopier­fertigen Brief aus.
// ────────────────────────────────────────────────────────────────────────

function EinspruchsGenerator({
  receipts,
  year,
  tweaks = {},
  onClose
}) {
  const y = String(year);
  const [bescheiddatum, setBescheiddatum] = React.useState("");
  const [festgesetzt, setFestgesetzt] = React.useState("");
  const [begruendung, setBegruendung] = React.useState("");
  const [brief, setBrief] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  // getK() gibt immer ein gültiges Objekt zurück
  const K = getK(Number(year) || new Date().getFullYear());
  const wkPauschale = K.wk_pauschale;

  // Summen aus Belegen
  const wkSumme = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const saSumme = (receipts || []).filter(r => r.steuerkat === "sonderausgaben" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const abSumme = (receipts || []).filter(r => r.steuerkat === "aussergewoehnlich" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const hdlSumme = (receipts || []).filter(r => r.steuerkat === "haushaltsnahe" && (r.datum || "").startsWith(y)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const heuteDE = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const fristDE = bescheiddatum ? new Date(new Date(bescheiddatum).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }) : "[Datum + 1 Monat]";
  const generiereEinspruch = () => {
    const belegListe = [];
    if (wkSumme > wkPauschale) belegListe.push(`  • Werbungskosten: ${fmtEUR(wkSumme)} (Belege vorhanden)`);
    if (saSumme > 0) belegListe.push(`  • Sonderausgaben: ${fmtEUR(saSumme)}`);
    if (abSumme > 0) belegListe.push(`  • Außergewöhnliche Belastungen: ${fmtEUR(abSumme)}`);
    if (hdlSumme > 0) belegListe.push(`  • Haushaltsnahe Dienstleistungen: ${fmtEUR(hdlSumme)} (20 % Lohnanteil)`);
    const bDatumDE = bescheiddatum ? new Date(bescheiddatum).toLocaleDateString("de-DE") : "[Bescheiddatum]";
    const text = [`Einspruch gemäß § 347 AO`, ``, `Steuernummer: [Steuernummer eintragen]`, `Datum: ${heuteDE}`, `Einspruchsfrist: ${fristDE}`, ``, `Sehr geehrte Damen und Herren,`, ``, `gegen den Einkommensteuer-Bescheid vom ${bDatumDE} für das Steuerjahr ${y} erhebe ich hiermit form- und fristgerecht`, ``, `E I N S P R U C H.`, ``, `Begründung:`, ``, begruendung ? begruendung : `Der Bescheid berücksichtigt folgende absetzbare Aufwendungen nicht vollständig:`, ``, ...belegListe, ``, `Die entsprechenden Belege und Nachweise liegen mir vor und können auf Anforderung eingereicht werden.`, ``, `Ich beantrage, den Bescheid dahingehend zu ändern, dass die oben genannten Aufwendungen steuermindernd berücksichtigt werden.`, ``, `Festgesetzte Steuer lt. Bescheid: ${festgesetzt ? fmtEUR(Number(festgesetzt)) : "[Betrag lt. Bescheid]"}`, ``, `Mit freundlichen Grüßen`, ``, `[Name]`, `[Anschrift]`, `[Telefon / E-Mail]`].join("\n");
    setBrief(text);
  };
  const handleCopy = () => {
    if (!brief) return;
    navigator.clipboard?.writeText(brief).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
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
  }, "Einspruchs-Generator ", year), /*#__PURE__*/React.createElement("button", {
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
  }, !brief ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "einspruch-intro"
  }, "F\xFClle die Felder aus \u2014 der Brief wird automatisch generiert. Einspruchsfrist: ", /*#__PURE__*/React.createElement("strong", null, "1 Monat ab Bescheid-Datum (\xA7 355 AO)"), "."), /*#__PURE__*/React.createElement("div", {
    className: "einspruch-form"
  }, /*#__PURE__*/React.createElement("label", {
    className: "bn-field"
  }, /*#__PURE__*/React.createElement("span", null, "Datum des Steuerbescheids"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: bescheiddatum,
    onChange: e => setBescheiddatum(e.target.value)
  })), /*#__PURE__*/React.createElement("label", {
    className: "bn-field"
  }, /*#__PURE__*/React.createElement("span", null, "Festgesetzte Steuer lt. Bescheid (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    placeholder: "0,00",
    value: festgesetzt,
    onChange: e => setFestgesetzt(e.target.value)
  })), /*#__PURE__*/React.createElement("label", {
    className: "bn-field",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Erg\xE4nzende Begr\xFCndung (optional)"), /*#__PURE__*/React.createElement("textarea", {
    rows: 4,
    placeholder: "z. B. \u201EDie Werbungskosten wurden nicht ber\xFCcksichtigt \u2026\"",
    value: begruendung,
    onChange: e => setBegruendung(e.target.value)
  }))), (wkSumme > wkPauschale || saSumme > 0 || abSumme > 0 || hdlSumme > 0) && /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview-label"
  }, "Aus deinen Belegen vorausgef\xFCllt"), wkSumme > wkPauschale && /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview-row"
  }, "\u2713 Werbungskosten: ", fmtEUR(wkSumme)), saSumme > 0 && /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview-row"
  }, "\u2713 Sonderausgaben: ", fmtEUR(saSumme)), abSumme > 0 && /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview-row"
  }, "\u2713 Au\xDFergew. Belastungen: ", fmtEUR(abSumme)), hdlSumme > 0 && /*#__PURE__*/React.createElement("div", {
    className: "einspruch-preview-row"
  }, "\u2713 Haushaltsnahe DL: ", fmtEUR(hdlSumme))), /*#__PURE__*/React.createElement("button", {
    className: "einspruch-generate",
    onClick: generiereEinspruch
  }, "Brief generieren")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("pre", {
    className: "einspruch-brief"
  }, brief), /*#__PURE__*/React.createElement("div", {
    className: "tax-modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: () => setBrief(null)
  }, "Bearbeiten"), /*#__PURE__*/React.createElement("button", {
    className: `receipt-btn primary ${copied ? "copied" : ""}`,
    onClick: handleCopy
  }, copied ? "Kopiert ✓" : "Text kopieren")), /*#__PURE__*/React.createElement("div", {
    className: "einspruch-footnote"
  }, "Einspruch per Post (Einschreiben) oder per ELSTER einreichen. Frist: 1 Monat ab Bescheiddatum (\xA7 355 AO).")))));
}

// ════════════════════════════════════════════════════════════════════════
// NEU: Feature 5 — Steuerbescheid-Prüfer
// ════════════════════════════════════════════════════════════════════════

function runBescheidCheck(profile, receipts, bescheid = {}, year) {
  if (!profile || !profile.beschaeftigung) return [];
  const yr = Number(year) || new Date().getFullYear();
  const K = typeof getK === "function" ? getK(yr) : {};
  const Kget = K || {};
  const gst = typeof calcGrenzsteuersatz === "function" ? calcGrenzsteuersatz(Math.max(0, (profile.brutto || 0) * 0.72), yr) : 0.35;
  const r0 = x => Math.round(Number(x) || 0);
  const pruefpunkte = [];

  // 1. Werbungskosten
  const wkBelege = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(String(yr))).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const wkVomFA = Number(bescheid.werbungskosten_angesetzt) || 0;
  const wkPausch = Kget.wk_pauschale;
  if (wkBelege > wkPausch && wkVomFA <= wkPausch) {
    pruefpunkte.push({
      nr: 1,
      status: "fehler",
      titel: "Werbungskosten zu niedrig angesetzt",
      befund: `Deine erfassten WK-Belege (${fmtEUR(wkBelege)}) übersteigen die Pauschale (${fmtEUR(wkPausch)}), das FA hat aber nur die Pauschale angesetzt.`,
      empfehlung: `Einspruch: Einzelnachweis ${fmtEUR(wkBelege)} WK geltend machen → Mehrrückerstattung ca. ${fmtEUR(r0((wkBelege - wkPausch) * gst))}.`,
      paragraph: "§ 9 EStG"
    });
  } else {
    pruefpunkte.push({
      nr: 1,
      status: "ok",
      titel: "Werbungskosten",
      befund: wkVomFA > wkPausch ? `FA hat ${fmtEUR(wkVomFA)} angesetzt — korrekt (über Pauschale).` : `Pauschale ${fmtEUR(wkPausch)} angesetzt — in Ordnung (keine höheren Belege erfasst).`,
      empfehlung: null,
      paragraph: "§ 9 EStG"
    });
  }

  // 2. §35a-Ermäßigungen
  const hdlBelege = (receipts || []).filter(r => r.steuerkat === "haushaltsnahe" && (r.datum || "").startsWith(String(yr)));
  const hdlSumme = hdlBelege.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const ermaessigung35a = r0(hdlSumme * 0.20);
  if (hdlSumme > 0) {
    pruefpunkte.push({
      nr: 2,
      status: ermaessigung35a > 0 ? "pruefen" : "ok",
      titel: "§35a Haushaltsnahe Leistungen / Handwerker",
      befund: `${fmtEUR(hdlSumme)} Belege vorhanden → 20 % Ermäßigung = ${fmtEUR(ermaessigung35a)} direkt von der Steuerschuld.`,
      empfehlung: "Prüfe ob Bescheid die §35a-Ermäßigung enthält (separate Zeile 'Steuerermäßigung §35a'). Falls nicht → Einspruch.",
      paragraph: "§ 35a EStG"
    });
  }

  // 3. Kinderfreibetrag Günstigerprüfung
  if (profile.kinder) {
    const raw = window.TAX_CONFIG_RAW || {};
    const kgMonatlich = yr >= 2026 ? raw.kindergeld_monatlich?.ab_2026 ?? K.kindergeld_monatlich : raw.kindergeld_monatlich?.bis_2025 ?? K.kindergeld_monatlich;
    const kindergeld_jahres = 12 * kgMonatlich;
    const kinderfreibetrag = raw.kinderfreibetrag_gesamt_2026 ?? getK(yr).kinderfreibetrag_gesamt;
    const vorteilFreibetrag = r0(kinderfreibetrag * gst);
    pruefpunkte.push({
      nr: 3,
      status: vorteilFreibetrag > kindergeld_jahres ? "pruefen" : "ok",
      titel: "Kinderfreibetrag / Kindergeld Günstigerprüfung",
      befund: `Kindergeld ${fmtEUR(kindergeld_jahres)}/Jahr. Vorteil Freibetrag ca. ${fmtEUR(vorteilFreibetrag)}. ${vorteilFreibetrag > kindergeld_jahres ? "Freibetrag wäre günstiger!" : "Kindergeld ist günstiger (OK)."}`,
      empfehlung: vorteilFreibetrag > kindergeld_jahres ? "Anlage Kind muss ausgefüllt sein — Finanzamt macht Günstigerprüfung automatisch." : null,
      paragraph: "§ 31 / § 32 EStG"
    });
  }

  // 4. Soli-Freigrenze
  const soliFrei = Kget.soli_freigrenze;
  const estFestgesetzt = Number(bescheid.festgesetzte_est) || 0;
  if (estFestgesetzt > 0 && estFestgesetzt < soliFrei) {
    pruefpunkte.push({
      nr: 4,
      status: "pruefen",
      titel: "Solidaritätszuschlag fälschlicherweise berechnet",
      befund: `ESt ${fmtEUR(estFestgesetzt)} liegt unter Freigrenze ${fmtEUR(soliFrei)} — kein SolZ sollte anfallen.`,
      empfehlung: "Prüfe ob SolZ im Bescheid ausgewiesen ist. Falls ja → Einspruch.",
      paragraph: "§ 3 SolZG"
    });
  }

  // 5. Kirchensteuer-Verrechnung
  if (profile.kirchenmitglied) {
    const kistVomFA = Number(bescheid.kirchensteuer_verrechnet) || 0;
    pruefpunkte.push({
      nr: 5,
      status: kistVomFA > 0 ? "ok" : "pruefen",
      titel: "Kirchensteuer-Verrechnung",
      befund: kistVomFA > 0 ? `FA hat ${fmtEUR(kistVomFA)} KiSt verrechnet.` : "Kirchensteuerpflicht laut Profil, aber keine KiSt-Verrechnung im Bescheid erkennbar.",
      empfehlung: kistVomFA === 0 ? "Prüfe Bescheid auf separate KiSt-Position und Anlage KiSt." : null,
      paragraph: "§ 51a EStG"
    });
  }

  // 6. Lohnsteuer-Anrechnung
  const lohnsteuerIA = Number((profile._ia || {}).lohnsteuer_einbehalten || (profile._ia || {}).gezahlte_lohnsteuer) || 0;
  const lohnsteuerDesc = Number(bescheid.angerechnete_lohnsteuer) || 0;
  if (lohnsteuerIA > 0 && lohnsteuerDesc > 0 && Math.abs(lohnsteuerIA - lohnsteuerDesc) > 10) {
    pruefpunkte.push({
      nr: 6,
      status: "fehler",
      titel: "Lohnsteuer-Anrechnung Abweichung",
      befund: `Interview-Angabe ${fmtEUR(lohnsteuerIA)} vs. Bescheid ${fmtEUR(lohnsteuerDesc)} — Differenz ${fmtEUR(Math.abs(lohnsteuerIA - lohnsteuerDesc))}.`,
      empfehlung: "Lohnsteuerbescheinigung mit Bescheid abgleichen. Bei Abweichung → Einspruch.",
      paragraph: "§ 36 Abs. 2 EStG"
    });
  }

  // 7. Homeoffice-Pauschale
  const hoTage = Number((profile._ia || {}).homeoffice_tage) || 0;
  if (hoTage > 0 && wkVomFA <= wkPausch) {
    const hoPauschale = r0(Math.min(hoTage, Kget.homeoffice_max_tage || 210) * (Kget.homeoffice_pro_tag || 6));
    pruefpunkte.push({
      nr: 7,
      status: hoPauschale > 50 ? "pruefen" : "ok",
      titel: "Homeoffice-Pauschale",
      befund: `${hoTage} HO-Tage → ${fmtEUR(hoPauschale)} Pauschale. FA hat ggf. nur AN-Pauschale angesetzt.`,
      empfehlung: "Prüfe ob Anlage N, Zeile 45 (Homeoffice) vom FA anerkannt wurde.",
      paragraph: "§ 4 Abs. 5 Nr. 6c EStG"
    });
  }

  // 8. Persönliche Daten
  pruefpunkte.push({
    nr: 8,
    status: "info",
    titel: "Persönliche Daten im Bescheid prüfen",
    befund: "Steuerklasse, Konfession, Kinderzahl, Familienstand — immer manuell auf der ersten Seite des Bescheids verifizieren.",
    empfehlung: "Abweichung → sofort schriftlich ans Finanzamt melden.",
    paragraph: "§ 139b AO"
  });
  const ORD = {
    fehler: 0,
    pruefen: 1,
    info: 2,
    ok: 3
  };
  return pruefpunkte.sort((a, b) => (ORD[a.status] ?? 9) - (ORD[b.status] ?? 9));
}
function SteuerbescheidPruefer({
  profile,
  receipts,
  year,
  onEinspruch
}) {
  const [bescheid, setBescheid] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const STATUS_ICON = {
    fehler: "✗",
    pruefen: "?",
    ok: "✓",
    info: "ℹ"
  };
  const STATUS_COLOR = {
    fehler: "var(--danger, #e24b4a)",
    pruefen: "oklch(0.55 0.16 50)",
    ok: "oklch(0.52 0.14 145)",
    info: "var(--text-faint)"
  };
  function runCheck() {
    if (!profile || !profile.beschaeftigung) return;
    setResult(runBescheidCheck(profile, receipts, bescheid, year));
  }
  const fehlerzahl = (result || []).filter(p => p.status === "fehler").length;
  const pruefzahl = (result || []).filter(p => p.status === "pruefen").length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "14px 16px",
      marginBottom: "12px"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: "15px",
      fontWeight: 700,
      marginBottom: "12px",
      color: "var(--text)"
    }
  }, "Steuerbescheid-Pr\xFCfer"), !showForm ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowForm(true),
    style: {
      width: "100%",
      padding: "10px",
      marginBottom: "12px",
      background: "var(--accent)",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: "inherit"
    }
  }, "Bescheid-Daten eingeben & pr\xFCfen") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "10px",
      marginBottom: "14px"
    }
  }, [{
    key: "festgesetzte_est",
    label: "Festgesetzte ESt (€)"
  }, {
    key: "angerechnete_lohnsteuer",
    label: "Angerechnete Lohnsteuer (€)"
  }, {
    key: "werbungskosten_angesetzt",
    label: "WK angesetzt vom FA (€)"
  }, {
    key: "kirchensteuer_verrechnet",
    label: "KiSt verrechnet (€)"
  }].map(({
    key,
    label
  }) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "4px"
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: "12px",
      color: "var(--text-faint)"
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    value: bescheid[key] || "",
    onChange: e => setBescheid(b => ({
      ...b,
      [key]: Number(e.target.value) || 0
    })),
    style: {
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid var(--border)",
      background: "var(--surface-2)",
      color: "var(--text)",
      fontSize: "13px",
      fontFamily: "inherit"
    },
    placeholder: "0"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: runCheck,
    style: {
      padding: "10px",
      background: "var(--accent)",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: "inherit"
    }
  }, "Pr\xFCfung starten")), result && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "8px",
      marginBottom: "12px",
      flexWrap: "wrap"
    }
  }, fehlerzahl > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "3px 10px",
      borderRadius: "99px",
      fontSize: "12px",
      background: "oklch(0.95 0.04 25)",
      color: STATUS_COLOR.fehler,
      fontWeight: 700
    }
  }, fehlerzahl, " Fehler"), pruefzahl > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "3px 10px",
      borderRadius: "99px",
      fontSize: "12px",
      background: "oklch(0.97 0.04 80)",
      color: STATUS_COLOR.pruefen,
      fontWeight: 700
    }
  }, pruefzahl, " zu pr\xFCfen"), fehlerzahl === 0 && pruefzahl === 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "3px 10px",
      borderRadius: "99px",
      fontSize: "12px",
      background: "oklch(0.94 0.06 145)",
      color: STATUS_COLOR.ok,
      fontWeight: 700
    }
  }, "Kein offensichtlicher Fehler")), result.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.nr,
    style: {
      borderBottom: "1px solid var(--border)",
      padding: "10px 0",
      display: "flex",
      gap: "10px",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      color: STATUS_COLOR[p.status],
      fontSize: "15px",
      minWidth: "18px",
      marginTop: "1px"
    }
  }, STATUS_ICON[p.status]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: "13px",
      display: "flex",
      justifyContent: "space-between",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("span", null, p.titel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "10px",
      color: "var(--text-faint)",
      fontWeight: 400,
      flexShrink: 0
    }
  }, p.paragraph)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      color: "var(--text-secondary, var(--text-muted))",
      marginTop: "3px",
      lineHeight: 1.5
    }
  }, p.befund), p.empfehlung && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "12px",
      marginTop: "5px",
      color: STATUS_COLOR[p.status],
      fontWeight: 500
    }
  }, "\u2192 ", p.empfehlung)))), (fehlerzahl > 0 || pruefzahl > 0) && onEinspruch && /*#__PURE__*/React.createElement("button", {
    onClick: onEinspruch,
    style: {
      marginTop: "14px",
      width: "100%",
      padding: "10px",
      background: "var(--danger, #e24b4a)",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: "14px",
      fontFamily: "inherit"
    }
  }, "Einspruchs-Assistent \xF6ffnen \u2192")));
}
(function _secureExport() {
  const _defs = {
    EinspruchsGenerator,
    runBescheidCheck,
    SteuerbescheidPruefer
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
