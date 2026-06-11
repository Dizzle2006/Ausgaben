/* global fmtEUR, STEUER_KATEGORIEN */
// ────────────────────────────────────────────────────────────────────────
// elster-export.jsx
// Erzeugt eine ELSTER-kompatible CSV mit allen steuerrelevanten Belegen,
// gegliedert nach Anlagen (N, SA, AB, HNL). Excel-kompatibel (UTF-8 BOM,
// Semikolon-getrennt, deutsche Dezimalkommas).
// ────────────────────────────────────────────────────────────────────────

const ANLAGE_MAP = {
  werbungskosten: {
    anlage: "N",
    zeile: "Werbungskosten (Zeile 31–53)",
    kurz: "Anlage N"
  },
  sonderausgaben: {
    anlage: "SA",
    zeile: "Sonderausgaben (Zeile 36–52)",
    kurz: "Anlage SA"
  },
  aussergewoehnlich: {
    anlage: "AB",
    zeile: "Außergewöhnliche Belastungen",
    kurz: "Anlage AB"
  },
  haushaltsnahe: {
    anlage: "HNL",
    zeile: "Haushaltsnahe DL §35a Abs.2 (Zeile 73–74)",
    kurz: "Anlage HNL §35a Abs.2"
  },
  handwerker: {
    anlage: "HNL3",
    zeile: "Handwerkerleistungen §35a Abs.3 (Zeile 74–75)",
    kurz: "Anlage HNL §35a Abs.3"
  }
};
function exportElsterCSV(receipts, year) {
  const y = String(year);
  const relevant = (receipts || []).filter(r => r.steuerkat && r.steuerkat !== "privat" && (r.datum || "").startsWith(y));
  if (relevant.length === 0) {
    alert(`Keine steuerrelevanten Belege für ${y} vorhanden.`);
    return;
  }

  // Nach Anlage gruppieren
  const groups = {};
  relevant.forEach(r => {
    const a = ANLAGE_MAP[r.steuerkat] || {
      anlage: "Sonstige",
      zeile: "—",
      kurz: "Sonstige"
    };
    if (!groups[a.anlage]) groups[a.anlage] = {
      ...a,
      rows: []
    };
    groups[a.anlage].rows.push(r);
  });
  const sections = [];
  for (const g of Object.values(groups)) {
    const summe = g.rows.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
    sections.push(`${g.kurz} – Steuerjahr ${y}`);
    sections.push(`ELSTER-Zeile;${g.zeile}`);
    sections.push("Händler;Datum;Betrag;MwSt 19%;MwSt 7%;Rechnungsnummer");
    g.rows.sort((a, b) => (a.datum || "").localeCompare(b.datum || "")).forEach(r => {
      sections.push([`"${(r.haendler || "").replace(/"/g, '""')}"`, r.datum || "", (Number(r.gesamtbetrag) || 0).toFixed(2).replace(".", ","), (Number(r.mwst_19) || 0).toFixed(2).replace(".", ","), (Number(r.mwst_7) || 0).toFixed(2).replace(".", ","), `"${(r.rechnungsnummer || "").replace(/"/g, '""')}"`].join(";"));
    });
    sections.push(`SUMME;${g.rows.length} Belege;${summe.toFixed(2).replace(".", ",")};;;`);
    sections.push("");
  }

  // UTF-8-BOM + CRLF (Excel-freundlich)
  const csv = "\uFEFF" + sections.join("\r\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elster-belege-${y}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function ElsterExportButton({
  receipts,
  year
}) {
  const y = String(year);
  const list = (receipts || []).filter(r => r.steuerkat && r.steuerkat !== "privat" && (r.datum || "").startsWith(y));
  const count = list.length;
  const summe = list.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);

  // Nach Anlage gruppieren für die Vorschau
  const byAnlage = {};
  list.forEach(r => {
    const a = ANLAGE_MAP[r.steuerkat];
    if (!a) return;
    if (!byAnlage[a.kurz]) byAnlage[a.kurz] = {
      count: 0,
      sum: 0
    };
    byAnlage[a.kurz].count += 1;
    byAnlage[a.kurz].sum += Number(r.gesamtbetrag) || 0;
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.55 0.14 240)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "ELSTER-Export ", y)), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: count > 0 ? "var(--text)" : "var(--text-faint)"
    }
  }, count > 0 ? fmtEUR(summe) : "—")), /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-row"
  }, /*#__PURE__*/React.createElement("span", null, "Steuerrelevante Belege"), /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, count)), Object.entries(byAnlage).map(([kurz, v]) => /*#__PURE__*/React.createElement("div", {
    className: "tax-row",
    key: kurz
  }, /*#__PURE__*/React.createElement("span", null, kurz), /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, v.count, " \xB7 ", fmtEUR(v.sum)))), /*#__PURE__*/React.createElement("button", {
    className: "elster-export-btn",
    disabled: count === 0,
    onClick: () => exportElsterCSV(receipts, year)
  }, count > 0 ? "CSV herunterladen" : "Keine Belege"), /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      marginTop: 10,
      background: "var(--surface-2)",
      color: "var(--text-muted)"
    }
  }, "Excel-kompatibel (Semikolon, UTF-8 BOM). Werte manuell nach ELSTER in die jeweilige Anlage \xFCbertragen.")));
}

// ════════════════════════════════════════════════════════════════════════
// Anlage V+V — Vermietung und Verpachtung (§ 21 EStG)
// ════════════════════════════════════════════════════════════════════════
function VermietungCard({
  interviewAnswers = {},
  year
}) {
  const ia = interviewAnswers;
  if (!ia.vermieter) return null;
  const einnahmen = Number(ia.vv_mieteinnahmen) || 0;
  const schuldzinsen = Number(ia.vv_schuldzinsen) || 0;
  const afa = Number(ia.vv_afa_betrag) || 0;
  const instandhalt = Number(ia.vv_instandhaltung) || 0;
  const verwaltung = Number(ia.vv_verwaltung) || 0;
  const sonstigeWK = Number(ia.vv_sonstige_wk) || 0;
  const wkGesamt = schuldzinsen + afa + instandhalt + verwaltung + sonstigeWK;
  const einkuenfte = einnahmen - wkGesamt;
  const rows = [["Mieteinnahmen (kalt)", einnahmen, true], ["− Schuldzinsen / Hypothekenzinsen", schuldzinsen, false], ["− AfA Gebäudeabschreibung", afa, false], ["− Instandhaltung / Reparaturen", instandhalt, false], ["− Hausverwaltung / Verwaltung", verwaltung, false], ["− Sonstige Werbungskosten", sonstigeWK, false]].filter(([, v]) => v !== 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.62 0.13 290)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Anlage V+V \u2014 Vermietung ", year)), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: einkuenfte >= 0 ? "var(--danger)" : "oklch(0.5 0.14 145)"
    }
  }, einnahmen > 0 ? fmtEUR(einkuenfte) : "—")), einnahmen === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      background: "var(--surface-2)",
      color: "var(--text-muted)"
    }
  }, "Mieteinnahmen noch nicht eingetragen \u2014 bitte Pers\xF6nliche Daten ausf\xFCllen.")) : /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, rows.map(([label, val, isPositive]) => /*#__PURE__*/React.createElement("div", {
    className: "tax-row",
    key: label
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    className: `num ${isPositive ? "pos" : "neg"}`
  }, isPositive ? "" : "− ", fmtEUR(Math.abs(val))))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row strong",
    style: {
      borderTop: "1px solid var(--border)",
      paddingTop: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", null, "= Eink\xFCnfte aus V+V"), /*#__PURE__*/React.createElement("span", {
    className: `num ${einkuenfte < 0 ? "pos" : "neg"}`
  }, fmtEUR(einkuenfte))), /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      marginTop: 10,
      background: einkuenfte < 0 ? "oklch(0.95 0.05 145)" : "oklch(0.95 0.05 25)",
      color: einkuenfte < 0 ? "oklch(0.34 0.13 145)" : "oklch(0.45 0.16 25)"
    }
  }, einkuenfte < 0 ? `✓ Verlust ${fmtEUR(Math.abs(einkuenfte))} — mindert anderes Einkommen (§ 21 EStG)` : `Steuerpflichtige Einkünfte ${fmtEUR(einkuenfte)} — in Anlage V+V eintragen (§ 21 EStG)`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 11.5,
      color: "var(--text-faint)",
      lineHeight: 1.5
    }
  }, "ELSTER: Anlage V+V, Zeile 7 (Einnahmen) \xB7 Zeile 17 (Schuldzinsen) \xB7 Zeile 33 (AfA) \xB7 Zeile 40 (Instandhaltung)")));
}

// ════════════════════════════════════════════════════════════════════════
// EÜR — Einnahmen-Überschuss-Rechnung für Selbstständige (§ 4 Abs. 3 EStG)
// ════════════════════════════════════════════════════════════════════════
function EUERCard({
  interviewAnswers = {},
  receipts = [],
  year
}) {
  const ia = interviewAnswers;
  const istSelbst = ["selbststaendig", "beides"].includes(ia.beschaeftigung || ia.berufstyp || "");
  if (!istSelbst) return null;
  const yr = String(year);
  const einnahmen = Number(ia.euer_einnahmen) || 0;
  const wareneinsatz = Number(ia.euer_wareneinsatz) || 0;
  const sonstigeBA = Number(ia.euer_sonstige_ba) || 0;

  // Belege aus Scanner als Betriebsausgaben
  const baBelege = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(yr)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const gesamtBA = wareneinsatz + sonstigeBA + baBelege;
  const gewinn = einnahmen - gesamtBA;
  const rows = [["Betriebseinnahmen (brutto)", einnahmen, true], ["− Wareneinsatz / Material", wareneinsatz, false], ["− Belege (Scanner, WK-Kat.)", baBelege, false], ["− Sonstige Betriebsausgaben", sonstigeBA, false]].filter(([, v]) => v !== 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.62 0.13 200)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "E\xDCR \u2014 Selbstst\xE4ndigkeit ", year)), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: gewinn > 0 ? "var(--danger)" : "oklch(0.5 0.14 145)"
    }
  }, einnahmen > 0 ? fmtEUR(gewinn) : "—")), einnahmen === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      background: "var(--surface-2)",
      color: "var(--text-muted)"
    }
  }, "Betriebseinnahmen noch nicht eingetragen \u2014 bitte Pers\xF6nliche Daten ausf\xFCllen.")) : /*#__PURE__*/React.createElement("div", {
    className: "tax-card-body"
  }, rows.map(([label, val, isPositive]) => /*#__PURE__*/React.createElement("div", {
    className: "tax-row",
    key: label
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    className: `num ${isPositive ? "pos" : "neg"}`
  }, isPositive ? "" : "− ", fmtEUR(Math.abs(val))))), /*#__PURE__*/React.createElement("div", {
    className: "tax-row strong",
    style: {
      borderTop: "1px solid var(--border)",
      paddingTop: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", null, "= Gewinn / Verlust"), /*#__PURE__*/React.createElement("span", {
    className: `num ${gewinn < 0 ? "pos" : "neg"}`
  }, fmtEUR(gewinn))), /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      marginTop: 10,
      background: gewinn < 0 ? "oklch(0.95 0.05 145)" : "var(--surface-2)",
      color: gewinn < 0 ? "oklch(0.34 0.13 145)" : "var(--text-muted)"
    }
  }, gewinn < 0 ? `Verlust ${fmtEUR(Math.abs(gewinn))} — Verlustvortrag prüfen (§ 10d EStG)` : `Gewinn ${fmtEUR(gewinn)} — steuerpflichtig als Einkünfte aus selbstständiger Arbeit (Anlage S/G)`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 11.5,
      color: "var(--text-faint)",
      lineHeight: 1.5
    }
  }, "ELSTER: Anlage E\xDCR (Betriebseinnahmen Zeile 14, Betriebsausgaben ab Zeile 21) \xB7 ggf. Anlage G oder Anlage S"), einnahmen > 22000 && /*#__PURE__*/React.createElement("div", {
    className: "tax-hint",
    style: {
      marginTop: 6,
      background: "oklch(0.95 0.06 50)",
      color: "oklch(0.45 0.16 50)"
    }
  }, "\u26A0 Umsatz > 22.000 \u20AC \u2192 Umsatzsteuerpflicht pr\xFCfen (\xA7 2 UStG). USt-Voranmeldung erforderlich.")));
}
(function _secureExport() {
  const _defs = {
    exportElsterCSV,
    ElsterExportButton,
    VermietungCard,
    EUERCard
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
