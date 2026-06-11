/* global React, fmtEUR */
// ────────────────────────────────────────────────────────────────────────
// tax-fristen.jsx
// Steuerfristen-Kalender. Zeigt alle anstehenden Fristen (Abgabe, USt-VA,
// EST-Vorauszahlung) für ein Steuerjahr und markiert kritische rot.
// ────────────────────────────────────────────────────────────────────────

/**
 * @param {string|number} year  z. B. "2025"
 */
function getSteuerfristenFuerJahr(year) {
  const y = Number(year);
  const ny = y + 1; // Abgabe im Folgejahr

  return [{
    id: "abgabe_ohne_berater",
    label: "Steuererklärung abgeben",
    datum: `${ny}-07-31`,
    beschreibung: "Pflichtveranlagung + freiwillige Abgabe",
    typ: "abgabe"
  },
  // EST-Vorauszahlungen (Quartal)
  {
    id: "est_vz_q1",
    label: "EST-Vorauszahlung Q1",
    datum: `${ny}-03-10`,
    beschreibung: "Nur wenn vom Finanzamt festgesetzt",
    typ: "vorauszahlung"
  }, {
    id: "est_vz_q2",
    label: "EST-Vorauszahlung Q2",
    datum: `${ny}-06-10`,
    typ: "vorauszahlung"
  }, {
    id: "est_vz_q3",
    label: "EST-Vorauszahlung Q3",
    datum: `${ny}-09-10`,
    typ: "vorauszahlung"
  }, {
    id: "est_vz_q4",
    label: "EST-Vorauszahlung Q4",
    datum: `${ny}-12-10`,
    typ: "vorauszahlung"
  }];
}
const FRIST_FARBEN = {
  abgabe: {
    farbe: "oklch(0.55 0.16 25)",
    bg: "oklch(0.95 0.04 25)"
  },
  ust: {
    farbe: "oklch(0.55 0.14 240)",
    bg: "oklch(0.95 0.04 240)"
  },
  vorauszahlung: {
    farbe: "oklch(0.55 0.13 70)",
    bg: "oklch(0.95 0.04 70)"
  }
};
function FristenCard({
  year
}) {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const tageBis = iso => {
    const d = new Date(iso);
    return Math.ceil((d - heute) / (1000 * 60 * 60 * 24));
  };
  const all = getSteuerfristenFuerJahr(year).sort((a, b) => a.datum.localeCompare(b.datum));

  // Nur Fristen, die in der Zukunft liegen oder höchstens 14 Tage vorbei sind
  const relevant = all.filter(f => tageBis(f.datum) >= -14);
  if (relevant.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "section"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-header"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-title"
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-dot",
      style: {
        background: "oklch(0.55 0.13 70)"
      }
    }), /*#__PURE__*/React.createElement("h2", null, "Steuerfristen ", year))), /*#__PURE__*/React.createElement("div", {
      className: "receipts-empty",
      style: {
        padding: "28px 18px"
      }
    }, /*#__PURE__*/React.createElement("div", null, "Keine anstehenden Fristen f\xFCr ", year, ".")));
  }
  const naechste = relevant[0];
  const tageNext = tageBis(naechste.datum);
  const kritisch = tageNext <= 30;
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.55 0.13 70)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Steuerfristen ", year)), kritisch && /*#__PURE__*/React.createElement("div", {
    className: "frist-badge urgent"
  }, tageNext < 0 ? "Abgelaufen" : tageNext === 0 ? "Heute!" : `Noch ${tageNext} Tage`)), /*#__PURE__*/React.createElement("div", {
    className: "frist-list"
  }, relevant.map(f => {
    const t = tageBis(f.datum);
    const col = FRIST_FARBEN[f.typ] || FRIST_FARBEN.abgabe;
    const warn = t <= 30 && t >= 0;
    const past = t < 0;
    return /*#__PURE__*/React.createElement("div", {
      key: f.id,
      className: `frist-row ${warn ? "warn" : ""} ${past ? "past" : ""}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "frist-dot",
      style: {
        background: warn || past ? col.farbe : "var(--border-strong)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "frist-text"
    }, /*#__PURE__*/React.createElement("div", {
      className: "frist-label"
    }, f.label), f.beschreibung && /*#__PURE__*/React.createElement("div", {
      className: "frist-sub"
    }, f.beschreibung)), /*#__PURE__*/React.createElement("div", {
      className: "frist-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: "frist-date"
    }, new Date(f.datum).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    })), /*#__PURE__*/React.createElement("div", {
      className: "frist-days",
      style: warn ? {
        color: col.farbe
      } : null
    }, past ? "abgelaufen" : t === 0 ? "heute" : `${t} Tage`)));
  })));
}
(function _secureExport() {
  const _defs = {
    FristenCard,
    getSteuerfristenFuerJahr
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
