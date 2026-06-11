/* global React, fmtEUR, monthLabel */

// ═══════════════════════════════════════════════════════════
// MonatsArchiv — Übersicht aller gespeicherten Monate +
//                Detail-Ansicht pro Monat
//
// Aufruf:
//   <MonatsArchiv
//     open={archiveOpen}
//     state={state}
//     onClose={() => setArchiveOpen(false)}
//     onSwitchToMonth={(ym) => { setState(s => ({...s, currentMonth: ym })); setArchiveOpen(false); }}
//   />
// ═══════════════════════════════════════════════════════════

function _monthTotals(monthData) {
  if (!monthData) return {
    income: 0,
    fixed: 0,
    savings: 0,
    variable: 0,
    spent: 0,
    remaining: 0,
    topCats: []
  };
  const income = (monthData.income || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const fixed = (monthData.fixed || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const savings = (monthData.savings || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  let variable = 0;
  const catSpend = [];
  (monthData.variable || []).forEach(c => {
    const sum = (c.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    variable += sum;
    if (sum > 0) catSpend.push({
      id: c.id,
      label: c.label,
      sum,
      budget: Number(c.budget) || 0
    });
  });
  catSpend.sort((a, b) => b.sum - a.sum);
  return {
    income,
    fixed,
    savings,
    variable,
    spent: fixed + savings + variable,
    remaining: income - fixed - savings - variable,
    topCats: catSpend.slice(0, 4)
  };
}

// Deterministische Kategorie-Farben (Hash der ID)
function _catColor(id) {
  const palette = [{
    bg: "#1D9E75",
    fg: "#f1ead8"
  }, {
    bg: "#c2410c",
    fg: "#f1ead8"
  }, {
    bg: "#5b3a59",
    fg: "#f1ead8"
  }, {
    bg: "#1a2e1f",
    fg: "#f1ead8"
  }, {
    bg: "#7d5524",
    fg: "#f1ead8"
  }, {
    bg: "#157054",
    fg: "#f1ead8"
  }];
  let h = 0;
  for (let i = 0; i < (id || "").length; i++) h = h * 31 + id.charCodeAt(i) | 0;
  return palette[Math.abs(h) % palette.length];
}
function _catGlyph(label) {
  const t = (label || "").trim();
  if (!t) return "··";
  const parts = t.split(/[\s\-_/]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

// ─── Detail-Screen ────────────────────────────────────────
function _ArchiveDetail({
  state,
  ym,
  onBack,
  onSwitchToMonth
}) {
  const md = state.months[ym];
  const t = _monthTotals(md);
  const today = new Date();
  const [y, m] = ym.split("-").map(Number);
  const isCurrent = today.getFullYear() === y && today.getMonth() + 1 === m;
  const daysInMonth = new Date(y, m, 0).getDate();
  const _parts = (() => {
    const str = fmtEUR(t.remaining);
    const mm = str.match(/^(.*?)(,\d{2}\s*€)$/);
    return mm ? {
      int: mm[1],
      cents: mm[2]
    } : {
      int: str,
      cents: ""
    };
  })();
  const spentPct = t.income > 0 ? Math.min(100, t.spent / t.income * 100) : 0;
  const maxBudget = Math.max(...t.topCats.map(c => c.budget || c.sum), 1);
  return /*#__PURE__*/React.createElement("div", {
    className: "archive-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-nav"
  }, /*#__PURE__*/React.createElement("button", {
    className: "archive-back",
    onClick: onBack,
    "aria-label": "Zur\xFCck"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "archive-nav-title"
  }, /*#__PURE__*/React.createElement("h2", null, monthLabel(ym)), /*#__PURE__*/React.createElement("div", {
    className: "archive-nav-sub"
  }, daysInMonth, " Tage \xB7 ", isCurrent ? "aktueller Monat" : "abgeschlossen")), !isCurrent && /*#__PURE__*/React.createElement("button", {
    className: "archive-jump",
    onClick: () => onSwitchToMonth(ym),
    title: "Zu diesem Monat wechseln"
  }, "\xD6ffnen", /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })))), /*#__PURE__*/React.createElement("div", {
    className: `summary ${t.remaining < 0 ? "negative" : ""}`,
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-label"
  }, t.income === 0 ? "Keine Daten" : t.remaining < 0 ? "Budget überschritten um" : "Übrig vom Monat"), /*#__PURE__*/React.createElement("div", {
    className: "hero-amount"
  }, /*#__PURE__*/React.createElement("span", null, t.remaining < 0 ? _parts.int.replace(/^−/, "") : _parts.int), _parts.cents && /*#__PURE__*/React.createElement("span", {
    className: "cents"
  }, _parts.cents)), t.income > 0 && /*#__PURE__*/React.createElement("div", {
    className: "hero-sub"
  }, "von ", /*#__PURE__*/React.createElement("strong", null, fmtEUR(t.income)), " Netto", /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "\xB7"), spentPct.toFixed(0), " % verplant")), /*#__PURE__*/React.createElement("div", {
    className: "archive-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-label"
  }, "Einnahmen"), /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-value income"
  }, fmtEUR(t.income))), /*#__PURE__*/React.createElement("div", {
    className: "archive-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-label"
  }, "Ausgaben"), /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-value spent"
  }, fmtEUR(t.spent))), /*#__PURE__*/React.createElement("div", {
    className: "archive-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-label"
  }, "Gespart"), /*#__PURE__*/React.createElement("div", {
    className: "archive-stat-value"
  }, fmtEUR(t.savings)))), /*#__PURE__*/React.createElement("div", {
    className: "archive-section-title"
  }, "Top-Kategorien"), t.topCats.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "archive-empty"
  }, "Keine variablen Ausgaben in diesem Monat.") : t.topCats.map(c => {
    const color = _catColor(c.id);
    const overBudget = c.budget > 0 && c.sum > c.budget;
    const pct = Math.min(100, c.sum / maxBudget * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      className: "archive-cat-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-chip",
      style: {
        background: color.bg,
        color: color.fg
      }
    }, _catGlyph(c.label)), /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-name"
    }, c.label), /*#__PURE__*/React.createElement("div", {
      className: `archive-cat-amount${overBudget ? " over" : ""}`
    }, fmtEUR(c.sum))), /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: `archive-cat-bar-fill${overBudget ? " over" : ""}`,
      style: {
        width: `${pct}%`,
        background: overBudget ? "var(--danger)" : color.bg
      }
    })), c.budget > 0 && /*#__PURE__*/React.createElement("div", {
      className: "archive-cat-budget"
    }, "Budget ", fmtEUR(c.budget), " \xB7 ", (c.sum / c.budget * 100).toFixed(0), " %")));
  })));
}

// ─── Listen-Screen ───────────────────────────────────────
function MonatsArchiv({
  open,
  state,
  onClose,
  onSwitchToMonth
}) {
  const [openMonth, setOpenMonth] = React.useState(null);
  React.useEffect(() => {
    if (!open) setOpenMonth(null);
    if (open) {
      const onKey = e => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);
  if (!open) return null;

  // Monate sortieren (neueste zuerst) + nach Jahr gruppieren
  const ymList = Object.keys(state.months).sort((a, b) => b.localeCompare(a));
  const byYear = {};
  ymList.forEach(ym => {
    const y = ym.slice(0, 4);
    (byYear[y] = byYear[y] || []).push(ym);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (openMonth) {
    return /*#__PURE__*/React.createElement(_ArchiveDetail, {
      state: state,
      ym: openMonth,
      onBack: () => setOpenMonth(null),
      onSwitchToMonth: onSwitchToMonth
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "archive-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-nav"
  }, /*#__PURE__*/React.createElement("button", {
    className: "archive-back",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "archive-nav-title"
  }, /*#__PURE__*/React.createElement("h2", null, "Monatsarchiv"), /*#__PURE__*/React.createElement("div", {
    className: "archive-nav-sub"
  }, ymList.length, " gespeicherte ", ymList.length === 1 ? "Monat" : "Monate"))), ymList.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "archive-empty",
    style: {
      marginTop: 32
    }
  }, "Noch keine Monate gespeichert. Sobald du Daten in einem Monat eintr\xE4gst, taucht er hier auf."), years.map(y => /*#__PURE__*/React.createElement(React.Fragment, {
    key: y
  }, /*#__PURE__*/React.createElement("div", {
    className: "archive-year"
  }, y), byYear[y].map(ym => {
    const t = _monthTotals(state.months[ym]);
    const isCurrent = ym === currentYM;
    const isNeg = t.remaining < 0;
    return /*#__PURE__*/React.createElement("button", {
      key: ym,
      className: `archive-month-card${isCurrent ? " current" : ""}`,
      onClick: () => setOpenMonth(ym)
    }, /*#__PURE__*/React.createElement("div", {
      className: "archive-month-label-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "archive-month-label"
    }, monthLabel(ym)), /*#__PURE__*/React.createElement("div", {
      className: "archive-month-sub"
    }, isCurrent ? "Aktueller Monat" : t.income > 0 ? `${fmtEUR(t.income)} Netto` : "Keine Daten")), /*#__PURE__*/React.createElement("div", {
      className: "archive-month-value-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: `archive-month-value${isCurrent ? " current" : isNeg ? " neg" : " pos"}`
    }, t.income === 0 && t.remaining === 0 ? "—" : (isNeg ? "−" : "+") + fmtEUR(Math.abs(t.remaining)).replace(" €", "") + " €"), /*#__PURE__*/React.createElement("div", {
      className: "archive-month-value-sub"
    }, "\xFCbrig")), /*#__PURE__*/React.createElement("svg", {
      className: "archive-month-chevron",
      viewBox: "0 0 24 24",
      width: "16",
      height: "16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "9 18 15 12 9 6"
    })));
  })))));
}
window.MonatsArchiv = MonatsArchiv;
