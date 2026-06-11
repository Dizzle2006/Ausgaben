/* global React, fmtEUR, monthLabel */

// ═══════════════════════════════════════════════════════════
// BudgetHeatmap — Tagesausgaben-Kalender für den Budget-Tab
// 7-Spalten-Grid, eine Zelle pro Tag des aktuellen Monats.
// Färbung nach Ausgaben-Intensität (Quartile).
// Rot, wenn ein Tag das Tages-Budget (Monatsbudget / Tage) überschreitet.
// ═══════════════════════════════════════════════════════════

function BudgetHeatmap({
  state,
  monthYM,
  monthBudget = 0
}) {
  const [y, m] = monthYM.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  // Erster Wochentag (Mo=0 ... So=6) — Date.getDay() liefert So=0..Sa=6
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const dailyBudget = monthBudget > 0 ? monthBudget / daysInMonth : 0;

  // Tagesausgaben aus variablen Kategorien aggregieren (haben Date pro Entry)
  const dayTotals = React.useMemo(() => {
    const totals = new Array(daysInMonth + 1).fill(0); // 1-indexed
    const md = state.months[monthYM];
    if (!md) return totals;
    (md.variable || []).forEach(cat => {
      (cat.entries || []).forEach(e => {
        const d = (e.date || "").slice(8, 10);
        const day = parseInt(d, 10);
        if (day >= 1 && day <= daysInMonth) {
          totals[day] += Number(e.amount) || 0;
        }
      });
    });
    return totals;
  }, [state.months, monthYM, daysInMonth]);

  // Quartil-Berechnung über nicht-leere Tage
  const {
    q1,
    q2,
    q3
  } = React.useMemo(() => {
    const nonZero = dayTotals.slice(1).filter(v => v > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return {
      q1: 0,
      q2: 0,
      q3: 0
    };
    const pct = p => nonZero[Math.floor(nonZero.length * p)] || 0;
    return {
      q1: pct(0.25),
      q2: pct(0.5),
      q3: pct(0.75)
    };
  }, [dayTotals]);

  // Tag → Intensitätsstufe (0=leer, 1=wenig, 2=mittel, 3=viel, 4=über Tagesbudget)
  const intensity = amount => {
    if (amount === 0) return 0;
    if (dailyBudget > 0 && amount > dailyBudget * 2) return 4; // Ausreißer
    if (amount <= q1) return 1;
    if (amount <= q2) return 2;
    return 3;
  };

  // Heutiger Tag markieren, falls aktueller Monat
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  // Grid-Daten: leading-empty Zellen, dann Tage 1..N
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({
    type: "empty",
    key: `e${i}`
  });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      type: "day",
      key: `d${d}`,
      day: d,
      amount: dayTotals[d],
      level: intensity(dayTotals[d]),
      isToday: d === todayDay
    });
  }

  // Summe für Kontext-Anzeige
  const totalMonth = dayTotals.reduce((s, v) => s + v, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "heatmap-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heatmap-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "heatmap-title"
  }, "Tagesausgaben"), /*#__PURE__*/React.createElement("div", {
    className: "heatmap-legend",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", null, "wenig"), /*#__PURE__*/React.createElement("span", {
    className: "heatmap-cell level-1"
  }), /*#__PURE__*/React.createElement("span", {
    className: "heatmap-cell level-2"
  }), /*#__PURE__*/React.createElement("span", {
    className: "heatmap-cell level-3"
  }), /*#__PURE__*/React.createElement("span", null, "viel"))), /*#__PURE__*/React.createElement("div", {
    className: "heatmap-weekdays",
    "aria-hidden": "true"
  }, ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => /*#__PURE__*/React.createElement("span", {
    key: d
  }, d))), /*#__PURE__*/React.createElement("div", {
    className: "heatmap-grid",
    role: "grid",
    "aria-label": `Tagesausgaben ${monthLabel(monthYM)}`
  }, cells.map(c => c.type === "empty" ? /*#__PURE__*/React.createElement("span", {
    key: c.key,
    className: "heatmap-cell empty"
  }) : /*#__PURE__*/React.createElement("span", {
    key: c.key,
    className: `heatmap-cell level-${c.level} ${c.isToday ? "today" : ""}`,
    title: c.amount > 0 ? `${c.day}. — ${fmtEUR(c.amount)}` : `${c.day}. — keine Ausgaben`,
    role: "gridcell",
    "aria-label": `${c.day}. ${c.amount > 0 ? fmtEUR(c.amount) : "keine Ausgaben"}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "heatmap-day-num"
  }, c.day)))), totalMonth === 0 && /*#__PURE__*/React.createElement("div", {
    className: "heatmap-empty"
  }, "Noch keine variablen Ausgaben in diesem Monat."));
}
window.BudgetHeatmap = BudgetHeatmap;
