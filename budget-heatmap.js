/* global React, fmtEUR, monthLabel, getPeriodRange */

// ═══════════════════════════════════════════════════════════
// BudgetHeatmap — Tagesausgaben-Kalender für den Budget-Tab
// 7-Spalten-Grid, eine Zelle pro Tag des aktuellen Monats.
// Färbung nach Ausgaben-Intensität (Quartile).
// Rot, wenn ein Tag das Tages-Budget (Monatsbudget / Tage) überschreitet.
// ═══════════════════════════════════════════════════════════

function BudgetHeatmap({
  state,
  monthYM,
  monthBudget = 0,
  budgetPeriod
}) {
  const period = budgetPeriod && budgetPeriod.mode === "custom" && budgetPeriod.startDay > 1 ? budgetPeriod : {
    mode: "calendar",
    startDay: 1
  };

  // Periodenstart/-ende (z.B. 12. des Monats statt 1., ggf. wochenend-korrigiert).
  // Die Periodenlänge ergibt sich aus dem tatsächlichen Abstand der beiden
  // Stichtage und kann daher leicht von der Kalendermonatslänge abweichen.
  const {
    start: periodStart,
    lengthDays: daysInMonth
  } = getPeriodRange(monthYM, period);
  const periodStartMs = periodStart.getTime();
  // Erster Wochentag (Mo=0 ... So=6) — Date.getDay() liefert So=0..Sa=6
  const firstWeekday = (periodStart.getDay() + 6) % 7;
  const dailyBudget = monthBudget > 0 ? monthBudget / daysInMonth : 0;

  // Tagesausgaben aus variablen Kategorien aggregieren (haben Date pro Entry).
  // Einträge werden über ihren Abstand (in Tagen) zum Periodenstart einsortiert,
  // damit auch Tage aus dem Folgemonat (bei eigenem Zeitraum) korrekt landen.
  const dayTotals = React.useMemo(() => {
    const totals = new Array(daysInMonth).fill(0); // 0-indexiert (Offset zum Periodenstart)
    const md = state.months[monthYM];
    if (!md) return totals;
    (md.variable || []).forEach(cat => {
      (cat.entries || []).forEach(e => {
        const ds = e.date || "";
        if (ds.length < 10) return;
        const ey = parseInt(ds.slice(0, 4), 10);
        const em = parseInt(ds.slice(5, 7), 10);
        const ed = parseInt(ds.slice(8, 10), 10);
        const entryMs = new Date(ey, em - 1, ed).getTime();
        const offset = Math.round((entryMs - periodStartMs) / 86400000);
        if (offset >= 0 && offset < daysInMonth) {
          totals[offset] += Number(e.amount) || 0;
        }
      });
    });
    return totals;
  }, [state.months, monthYM, daysInMonth, periodStartMs]);

  // Quartil-Berechnung über nicht-leere Tage
  const {
    q1,
    q2,
    q3
  } = React.useMemo(() => {
    const nonZero = dayTotals.filter(v => v > 0).sort((a, b) => a - b);
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

  // Heutiger Tag markieren, falls er in den Periodenzeitraum fällt
  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayOffset = Math.round((todayMs - periodStartMs) / 86400000);

  // Grid-Daten: leading-empty Zellen, dann ein Tag pro Periodentag (Datum
  // ergibt sich aus Periodenstart + Offset, kann also in den Folgemonat
  // hineinlaufen)
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({
    type: "empty",
    key: `e${i}`
  });
  for (let offset = 0; offset < daysInMonth; offset++) {
    const cellDate = new Date(periodStartMs + offset * 86400000);
    cells.push({
      type: "day",
      key: `d${offset}`,
      day: cellDate.getDate(),
      amount: dayTotals[offset],
      level: intensity(dayTotals[offset]),
      isToday: offset === todayOffset
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
    "aria-label": `Tagesausgaben ${monthLabel(monthYM, period)}`
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
