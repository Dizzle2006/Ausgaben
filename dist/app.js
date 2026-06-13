/* global React, ReactDOM, fmtEUR, fmtDate, monthLabel, shiftMonth, loadState, loadStateAsync, saveState, updateEncryptedCache, saveStateCached, defaultState, ensureMonth, uid, todayISO, currentYM, Icon, Section, ItemRow, VariableRow, VariableDetail, InvestmentsPage, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakButton, TweakToggle, exportState, importState, exportReceiptsCSV, ReceiptScanner, useReceiptImage, idbDeleteImage, migrateInlineImagesToIDB, STEUER_KATEGORIEN */

const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect
} = React;

// ====================== Bottom Tab Bar (Mobile Home Bar) ======================
const TabIcon = {
  budget: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "6",
    width: "18",
    height: "13",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "17",
    cy: "13",
    r: "1.4",
    fill: "currentColor"
  })),
  history: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 17 9 11 13 15 21 7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "15 7 21 7 21 13"
  })),
  tax: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 3h11l3 3v15l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L5 21V3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "9",
    x2: "15",
    y2: "9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "13",
    x2: "15",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "17",
    x2: "12",
    y2: "17"
  })),
  investments: () => /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 21h18"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "13",
    width: "3",
    height: "7",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.5",
    y: "9",
    width: "3",
    height: "11",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "16",
    y: "5",
    width: "3",
    height: "15",
    rx: "0.5"
  }))
};
function BottomTabBar({
  value,
  onChange
}) {
  const tabs = [{
    id: "budget",
    label: "Budget",
    Icon: TabIcon.budget
  }, {
    id: "history",
    label: "Verlauf",
    Icon: TabIcon.history
  }, {
    id: "tax",
    label: "Steuern",
    Icon: TabIcon.tax
  }, {
    id: "investments",
    label: "Invest.",
    Icon: TabIcon.investments
  }];
  return /*#__PURE__*/React.createElement("nav", {
    className: "tab-bar",
    role: "tablist",
    "aria-label": "Hauptnavigation"
  }, tabs.map(t => {
    const active = value === t.id;
    return /*#__PURE__*/React.createElement("button", {
      key: t.id,
      className: `tab-btn ${active ? "active" : ""}`,
      onClick: () => onChange(t.id),
      role: "tab",
      "aria-selected": active
    }, /*#__PURE__*/React.createElement("span", {
      className: "tab-icon"
    }, /*#__PURE__*/React.createElement(t.Icon, null)), /*#__PURE__*/React.createElement("span", {
      className: "tab-label"
    }, t.label));
  }));
}

// ====================== View Toggle ======================
function ViewToggle({
  value,
  onChange
}) {
  const refs = {
    budget: useRef(null),
    history: useRef(null),
    tax: useRef(null),
    investments: useRef(null)
  };
  const [thumb, setThumb] = useState({
    left: 3,
    width: 0
  });
  useLayoutEffect(() => {
    const el = refs[value]?.current;
    if (!el) return;
    const parent = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setThumb({
      left: r.left - parent.left,
      width: r.width
    });
  }, [value]);
  return /*#__PURE__*/React.createElement("div", {
    className: "view-toggle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "thumb",
    style: {
      transform: `translateX(${thumb.left}px)`,
      width: thumb.width
    }
  }), /*#__PURE__*/React.createElement("button", {
    ref: refs.budget,
    className: value === "budget" ? "active" : "",
    onClick: () => onChange("budget")
  }, "Budget"), /*#__PURE__*/React.createElement("button", {
    ref: refs.history,
    className: value === "history" ? "active" : "",
    onClick: () => onChange("history")
  }, "Verlauf"), /*#__PURE__*/React.createElement("button", {
    ref: refs.tax,
    className: value === "tax" ? "active" : "",
    onClick: () => onChange("tax")
  }, "Steuern"), /*#__PURE__*/React.createElement("button", {
    ref: refs.investments,
    className: value === "investments" ? "active" : "",
    onClick: () => onChange("investments")
  }, "Invest."));
}

// NEU: Feature C — Steuer-Alert Hook: wertet Belege des laufenden Jahres aus
function useSteuerAlert(receipts, year, K) {
  return React.useMemo(() => {
    if (!receipts || !K) return null;
    const yr = String(year || new Date().getFullYear());
    const yearR = receipts.filter(r => (r.datum || r.month || "").startsWith(yr) && r.steuerkat !== "privat");
    if (yearR.length === 0) return null;
    const sums = {};
    for (const r of yearR) {
      sums[r.steuerkat] = (sums[r.steuerkat] || 0) + (Number(r.gesamtbetrag) || 0);
    }
    const alerts = [];
    if (sums.haushaltsnahe > 0) {
      const ersparnis = Math.round(sums.haushaltsnahe * 0.20);
      alerts.push({
        prio: 1,
        kat: "haushaltsnahe",
        text: `§35a: ${fmtEUR(sums.haushaltsnahe)} → direkte Steuerermäßigung ca. ${fmtEUR(ersparnis)}`,
        farbe: "#1D9E75",
        icon: "🏠"
      });
    }
    if (sums.werbungskosten > 0) {
      const pauschale = K.wk_pauschale;
      const diff = sums.werbungskosten - pauschale;
      if (diff > 0) {
        alerts.push({
          prio: 1,
          kat: "werbungskosten",
          text: `WK übersteigen Pauschale um ${fmtEUR(diff)} → Einzelabstellung lohnt sich!`,
          farbe: "#185FA5",
          icon: "💼"
        });
      } else {
        alerts.push({
          prio: 3,
          kat: "werbungskosten",
          text: `WK ${fmtEUR(sums.werbungskosten)} / ${fmtEUR(pauschale)} Pauschale — noch ${fmtEUR(-diff)} bis Einzelabstellung lohnt`,
          farbe: "#888",
          icon: "💼"
        });
      }
    }
    if (sums.aussergewoehnlich > 0) {
      alerts.push({
        prio: 2,
        kat: "aussergewoehnlich",
        text: `§33 Belege: ${fmtEUR(sums.aussergewoehnlich)} — zumutbare Eigenbelastung prüfen`,
        farbe: "#BA7517",
        icon: "⚕"
      });
    }
    if (sums.sonderausgaben > 0) {
      alerts.push({
        prio: 3,
        kat: "sonderausgaben",
        text: `Sonderausgaben: ${fmtEUR(sums.sonderausgaben)} erfasst`,
        farbe: "#534AB7",
        icon: "📋"
      });
    }
    if (alerts.length === 0) return null;
    alerts.sort((a, b) => a.prio - b.prio);
    return alerts[0];
  }, [receipts, year, K]);
}

// Feature 1 — Monats-Forecast
function useForecast(state) {
  return React.useMemo(() => {
    const allMonths = Object.keys(state.months).sort();
    const cur = state.currentMonth;
    const curIdx = allMonths.indexOf(cur);
    if (curIdx < 1) return null;
    const refMonths = allMonths.slice(Math.max(0, curIdx - 3), curIdx);
    if (refMonths.length === 0) return null;
    const avgVariable = refMonths.reduce((sum, ym) => {
      const d = state.months[ym];
      const varTotal = (d.variable || []).reduce((s, cat) => s + (cat.entries || []).reduce((cs, e) => cs + (Number(e.amount) || 0), 0), 0);
      return sum + varTotal;
    }, 0) / refMonths.length;
    const curData = state.months[cur];
    const curVariable = (curData.variable || []).reduce((s, cat) => s + (cat.entries || []).reduce((cs, e) => cs + (Number(e.amount) || 0), 0), 0);
    const income = (curData.income || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const fixed = (curData.fixed || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const savings = (curData.savings || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const progress = dayOfMonth / daysInMonth;
    const projectedVariable = progress > 0 ? curVariable / progress : avgVariable;
    const projectedTotal = fixed + savings + projectedVariable;
    const projectedRemaining = income - projectedTotal;
    const vsAvg = curVariable - avgVariable * progress;
    return {
      projectedRemaining: Math.round(projectedRemaining),
      projectedVariable: Math.round(projectedVariable),
      avgVariable: Math.round(avgVariable),
      curVariable: Math.round(curVariable),
      vsAvg: Math.round(vsAvg),
      progress: Math.round(progress * 100),
      income,
      refMonths: refMonths.length
    };
  }, [state]);
}

// ====================== Budget View ======================
function BudgetView({
  state,
  setState,
  budgetPeriod,
  onOpenReceipt,
  onSwitchToSteuer,
  onOpenBudgetBot
}) {
  const [openCategory, setOpenCategory] = useState(null);
  const [budgetTab, setBudgetTab] = useState("ausgaben"); // "monat" | "ausgaben" | "belege"

  const monthData = state.months[state.currentMonth];

  // Belege des aktuellen Monats
  const monthReceipts = useMemo(() => (state.receipts || []).filter(r => r.month === state.currentMonth), [state.receipts, state.currentMonth]);
  const monthReceiptTotal = useMemo(() => monthReceipts.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0), [monthReceipts]);
  const deleteReceipt = id => {
    // Bild aus IDB löschen (best effort)
    try {
      window.idbDeleteImage(id);
    } catch {}
    setState(s => {
      const receipt = (s.receipts || []).find(r => r.id === id);
      const next = {
        ...s,
        receipts: (s.receipts || []).filter(r => r.id !== id)
      };
      // Falls eine variable Entry mit dieser receiptId existiert: auch entfernen
      if (receipt && receipt.month && next.months[receipt.month]) {
        const m = next.months[receipt.month];
        next.months = {
          ...next.months,
          [receipt.month]: {
            ...m,
            variable: m.variable.map(c => ({
              ...c,
              entries: (c.entries || []).filter(e => e.receiptId !== id)
            }))
          }
        };
      }
      return next;
    });
  };

  // Totals
  const totalIncome = useMemo(() => monthData.income.reduce((s, x) => s + (Number(x.amount) || 0), 0), [monthData.income]);
  const totalFixed = useMemo(() => monthData.fixed.reduce((s, x) => s + (Number(x.amount) || 0), 0), [monthData.fixed]);
  const totalSavings = useMemo(() => monthData.savings.reduce((s, x) => s + (Number(x.amount) || 0), 0), [monthData.savings]);
  const variableTotals = useMemo(() => {
    const out = {};
    monthData.variable.forEach(cat => {
      out[cat.id] = (cat.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    });
    return out;
  }, [monthData.variable]);
  const totalVariable = useMemo(() => Object.values(variableTotals).reduce((s, v) => s + v, 0), [variableTotals]);
  const remaining = totalIncome - totalFixed - totalSavings - totalVariable;
  const totalSpent = totalFixed + totalSavings + totalVariable;
  const spentPct = totalIncome > 0 ? Math.min(100, totalSpent / totalIncome * 100) : 0;
  const isOverBudget = remaining < 0;

  // BudgetBot: Bedarfsanalyse-Profil laden (bei Mount + nach Profil-Speichern)
  const [budgetProfil, setBudgetProfil] = useState(null);
  useEffect(() => {
    if (typeof window.loadBedarfsanalyse === "function") {
      window.loadBedarfsanalyse().then(p => setBudgetProfil(p));
    }
    const onProfilUpdate = () => {
      if (typeof window.loadBedarfsanalyse === "function") {
        window.loadBedarfsanalyse().then(p => setBudgetProfil(p));
      }
    };
    window.addEventListener("budget-profil-updated", onProfilUpdate);
    return () => window.removeEventListener("budget-profil-updated", onProfilUpdate);
  }, []);

  // NEU: Feature C — Steuer-Alert für Budget-Tab
  const currentYearStr = (state.currentMonth || "").slice(0, 4) || String(new Date().getFullYear());
  const steuerAlertK = getK(Number(currentYearStr));
  const steuerAlert = useSteuerAlert(state.receipts || [], currentYearStr, steuerAlertK);

  // Feature 1 — Monats-Forecast
  const forecast = useForecast(state);

  // Mutators on the current month
  const patchMonth = patch => {
    setState(s => ({
      ...s,
      months: {
        ...s.months,
        [s.currentMonth]: {
          ...s.months[s.currentMonth],
          ...patch
        }
      }
    }));
  };
  const updateList = (key, item) => {
    patchMonth({
      [key]: monthData[key].map(x => x.id === item.id ? item : x)
    });
  };
  const deleteFromList = (key, id) => {
    patchMonth({
      [key]: monthData[key].filter(x => x.id !== id)
    });
  };
  const addToList = (key, template) => {
    patchMonth({
      [key]: [...monthData[key], {
        id: uid(),
        ...template
      }]
    });
  };
  const setMonth = ym => {
    setState(s => {
      const next = ensureMonth(s, ym);
      return {
        ...next,
        currentMonth: ym
      };
    });
  };
  const detailCategory = openCategory ? monthData.variable.find(c => c.id === openCategory) : null;
  if (detailCategory) {
    return /*#__PURE__*/React.createElement(VariableDetail, {
      category: detailCategory,
      onUpdate: updated => updateList("variable", updated),
      onBack: () => setOpenCategory(null),
      onUpdateBudget: newBudget => {
        const updated = monthData.variable.map(c => c.id === openCategory ? {
          ...c,
          budget: newBudget
        } : c);
        patchMonth({
          variable: updated
        });
      }
    });
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "budget-subtab-bar"
  }, [{
    id: "ausgaben",
    label: "Ausgaben"
  }, {
    id: "belege",
    label: "Belege"
  }].map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: `budget-subtab-btn${budgetTab === t.id ? " active" : ""}`,
    onClick: () => setBudgetTab(t.id)
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    className: "month-picker-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "month-picker"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonth(shiftMonth(state.currentMonth, -1)),
    "aria-label": "Vorheriger Monat"
  }, /*#__PURE__*/React.createElement(Icon.Left, null)), /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, monthLabel(state.currentMonth, budgetPeriod)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonth(shiftMonth(state.currentMonth, 1)),
    "aria-label": "N\xE4chster Monat"
  }, /*#__PURE__*/React.createElement(Icon.Right, null))), /*#__PURE__*/React.createElement("div", {
    className: "month-meta"
  }, Object.keys(state.months).length, " gespeicherte ", Object.keys(state.months).length === 1 ? "Monat" : "Monate")), (() => {
    // Beträge in Ganzzahl + ",NN €" Cents zerlegen, damit Cents im Hero kleiner gerendert werden
    const _parts = (() => {
      const str = fmtEUR(remaining);
      const m = str.match(/^(.*?)(,\d{2}\s*€)$/);
      return m ? {
        int: m[1],
        cents: m[2]
      } : {
        int: str,
        cents: ""
      };
    })();
    const isOverNoIncome = remaining === 0 && totalIncome === 0;
    return /*#__PURE__*/React.createElement("div", {
      className: `summary ${isOverBudget ? "negative" : ""}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero-label"
    }, isOverNoIncome ? "Noch keine Daten" : isOverBudget ? "Budget überschritten um" : `Übrig in ${monthLabel(state.currentMonth, budgetPeriod)}`), /*#__PURE__*/React.createElement("div", {
      className: "hero-amount"
    }, /*#__PURE__*/React.createElement("span", null, isOverBudget ? _parts.int.replace(/^−/, "") : _parts.int), _parts.cents && /*#__PURE__*/React.createElement("span", {
      className: "cents"
    }, _parts.cents)), /*#__PURE__*/React.createElement("div", {
      className: "hero-sub"
    }, totalIncome === 0 ? /*#__PURE__*/React.createElement("span", null, "Trage Einnahmen ein, um deinen Budget-Status zu sehen.") : /*#__PURE__*/React.createElement(React.Fragment, null, "von ", /*#__PURE__*/React.createElement("strong", null, fmtEUR(totalIncome)), " Netto", /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, "\xB7"), spentPct.toFixed(0), " % verplant")), totalIncome > 0 && /*#__PURE__*/React.createElement("div", {
      className: "hero-stats",
      "aria-label": "Monatsbilanz Gesamtwerte"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero-stat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-label"
    }, "Einnahmen gesamt"), /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-value"
    }, fmtEUR(totalIncome))), /*#__PURE__*/React.createElement("div", {
      className: "hero-stat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-label"
    }, "Ausgaben gesamt"), /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-value"
    }, fmtEUR(totalFixed + totalVariable))), /*#__PURE__*/React.createElement("div", {
      className: "hero-stat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-label"
    }, "Sparen gesamt"), /*#__PURE__*/React.createElement("div", {
      className: "hero-stat-value"
    }, fmtEUR(totalSavings)))), forecast && forecast.income > 0 && /*#__PURE__*/React.createElement("div", {
      className: "hero-chip"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, forecast.projectedRemaining >= 0 ? /*#__PURE__*/React.createElement("polyline", {
      points: "6 15 12 9 18 15"
    }) : /*#__PURE__*/React.createElement("polyline", {
      points: "6 9 12 15 18 9"
    })), /*#__PURE__*/React.createElement("span", null, forecast.projectedRemaining >= 0 ? "+" : "−", fmtEUR(Math.abs(forecast.projectedRemaining)), " Prognose"), forecast.vsAvg > 50 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, fmtEUR(forecast.vsAvg), " \xFCber \xD8")), forecast.vsAvg < -50 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, fmtEUR(Math.abs(forecast.vsAvg)), " unter \xD8")), Math.abs(forecast.vsAvg) <= 50 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "sep"
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      className: "dim"
    }, "im \xD8-Tempo"))));
  })(), typeof BudgetHeatmap !== "undefined" && /*#__PURE__*/React.createElement(BudgetHeatmap, {
    state: state,
    monthYM: state.currentMonth,
    budgetPeriod: budgetPeriod,
    monthBudget: monthData.variable.reduce((s, c) => s + (Number(c.budget) || 0), 0)
  }), budgetTab === "ausgaben" && /*#__PURE__*/React.createElement(React.Fragment, null, steuerAlert && /*#__PURE__*/React.createElement("div", {
    className: "steuer-bridge-alert",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 14px",
      borderRadius: "10px",
      marginBottom: "12px",
      background: "var(--surface-2)",
      borderLeft: `3px solid ${steuerAlert.farbe}`,
      cursor: "pointer"
    },
    onClick: () => {
      if (typeof onSwitchToSteuer === "function") onSwitchToSteuer();
    },
    role: "button",
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (typeof onSwitchToSteuer === "function") onSwitchToSteuer();
      }
    },
    title: "Zum Steuer-Tab wechseln"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "18px"
    }
  }, steuerAlert.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: "12px",
      lineHeight: 1.4,
      color: "var(--text-secondary, var(--text-muted))"
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: steuerAlert.farbe,
      fontWeight: 700
    }
  }, "Steuer-Tipp: "), steuerAlert.text), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "11px",
      color: "var(--text-faint)",
      flexShrink: 0
    }
  }, "\u2192 Steuer")), typeof BudgetAlertPanel !== "undefined" && /*#__PURE__*/React.createElement(BudgetAlertPanel, {
    state: state,
    profil: budgetProfil,
    onOpenBot: () => {
      if (typeof onOpenBudgetBot === "function") onOpenBudgetBot();
    },
    onAlertAktion: alert => {
      if (typeof onOpenBudgetBot === "function") onOpenBudgetBot(alert.aktion);
    }
  }), /*#__PURE__*/React.createElement(Section, {
    title: "Einnahmen",
    dotClass: "income",
    total: totalIncome,
    onAdd: () => addToList("income", {
      label: "Neue Einnahme",
      amount: 0
    }),
    addLabel: "Einnahme hinzuf\xFCgen"
  }, monthData.income.map(item => /*#__PURE__*/React.createElement(ItemRow, {
    key: item.id,
    item: item,
    hasDate: false,
    onUpdate: u => updateList("income", u),
    onDelete: () => deleteFromList("income", item.id)
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Fixkosten",
    dotClass: "fixed",
    total: totalFixed,
    onAdd: () => addToList("fixed", {
      label: "Neue Fixkosten",
      amount: 0,
      date: `${state.currentMonth}-01`
    }),
    addLabel: "Fixkosten hinzuf\xFCgen"
  }, monthData.fixed.map(item => /*#__PURE__*/React.createElement(ItemRow, {
    key: item.id,
    item: item,
    hasDate: true,
    onUpdate: u => updateList("fixed", u),
    onDelete: () => deleteFromList("fixed", item.id),
    onToggleRecurring: () => updateList("fixed", {
      ...item,
      recurring: item.recurring === false
    })
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Sparen & Investieren",
    dotClass: "savings",
    total: totalSavings,
    onAdd: () => addToList("savings", {
      label: "Neues Investment",
      amount: 0,
      date: `${state.currentMonth}-01`
    }),
    addLabel: "Investment hinzuf\xFCgen"
  }, monthData.savings.map(item => /*#__PURE__*/React.createElement(ItemRow, {
    key: item.id,
    item: item,
    hasDate: true,
    onUpdate: u => updateList("savings", u),
    onDelete: () => deleteFromList("savings", item.id)
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Variable Ausgaben",
    dotClass: "variable",
    total: totalVariable,
    onAdd: () => addToList("variable", {
      label: "Neue Kategorie",
      entries: []
    }),
    addLabel: "Kategorie hinzuf\xFCgen"
  }, monthData.variable.map(cat => /*#__PURE__*/React.createElement(VariableRow, {
    key: cat.id,
    item: cat,
    total: variableTotals[cat.id] || 0,
    entryCount: (cat.entries || []).length,
    onUpdate: u => updateList("variable", u),
    onDelete: () => deleteFromList("variable", cat.id),
    onOpen: () => setOpenCategory(cat.id)
  })))), budgetTab === "belege" && /*#__PURE__*/React.createElement(ReceiptsSection, {
    receipts: monthReceipts,
    total: monthReceiptTotal,
    categories: monthData.variable,
    onOpen: onOpenReceipt,
    onDelete: deleteReceipt
  }));
}

// ====================== Investments View Wrapper ======================
function InvestmentsView({
  state,
  setState
}) {
  const updateInvestments = next => {
    setState(s => ({
      ...s,
      investments: next
    }));
  };
  return /*#__PURE__*/React.createElement(InvestmentsPage, {
    investments: state.investments,
    onUpdate: updateInvestments
  });
}

// ====================== History View ======================
function HistoryView({
  state,
  onJumpToMonth
}) {
  const months = Object.keys(state.months).sort(); // chronologisch

  // Daten pro Monat berechnen
  const rows = months.map(ym => {
    const d = state.months[ym];
    const income = d.income.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const fixed = d.fixed.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const savings = d.savings.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const variable = d.variable.reduce((s, cat) => s + (cat.entries || []).reduce((cs, e) => cs + (Number(e.amount) || 0), 0), 0);
    const totalOut = fixed + savings + variable;
    const remaining = income - totalOut;
    const savingsRate = income > 0 ? savings / income * 100 : 0;
    return {
      ym,
      income,
      fixed,
      savings,
      variable,
      totalOut,
      remaining,
      savingsRate
    };
  });

  // Feature 1 — Jahres-Aggregate
  const availableYears = React.useMemo(() => {
    const years = [...new Set(months.map(ym => ym.slice(0, 4)))].sort().reverse();
    return years;
  }, [months]);
  const [selectedYear, setSelectedYear] = React.useState(() => months.length > 0 ? months[months.length - 1].slice(0, 4) : String(new Date().getFullYear()));
  const yearAggregate = React.useMemo(() => {
    const yearRows = rows.filter(r => r.ym.startsWith(selectedYear));
    if (yearRows.length === 0) return null;
    const totalIncome = yearRows.reduce((s, r) => s + r.income, 0);
    const totalOut = yearRows.reduce((s, r) => s + r.totalOut, 0);
    const totalSaved = yearRows.reduce((s, r) => s + r.savings, 0);
    const totalVariable = yearRows.reduce((s, r) => s + r.variable, 0);
    const totalFixed = yearRows.reduce((s, r) => s + r.fixed, 0);
    const incomeRows = yearRows.filter(r => r.income > 0);
    const avgSavingsRate = incomeRows.length > 0 ? incomeRows.reduce((s, r) => s + r.savingsRate, 0) / incomeRows.length : 0;
    const bestMonth = [...yearRows].sort((a, b) => b.remaining - a.remaining)[0];
    const worstMonth = [...yearRows].sort((a, b) => a.remaining - b.remaining)[0];
    return {
      totalIncome,
      totalOut,
      totalSaved,
      totalVariable,
      totalFixed,
      avgSavingsRate,
      months: yearRows.length,
      bestMonth,
      worstMonth
    };
  }, [rows, selectedYear]);

  // Feature 2 — Kategorie-Trends
  const allCategoryLabels = React.useMemo(() => {
    const set = new Map();
    months.forEach(ym => {
      (state.months[ym]?.variable || []).forEach(cat => {
        if (!set.has(cat.id)) set.set(cat.id, cat.label);
      });
    });
    return Array.from(set.entries()).map(([id, label]) => ({
      id,
      label
    }));
  }, [months, state.months]);
  const [selectedCatId, setSelectedCatId] = React.useState(null);
  const activeCatId = selectedCatId || allCategoryLabels[0]?.id || null;
  const catTrendData = React.useMemo(() => {
    if (!activeCatId) return [];
    return months.map(ym => {
      const cat = (state.months[ym]?.variable || []).find(c => c.id === activeCatId);
      const total = (cat?.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const budget = cat?.budget || 0;
      return {
        ym,
        total,
        budget
      };
    });
  }, [months, state.months, activeCatId]);

  // Chart-Dimensionen
  const W = 800,
    H = 220,
    padL = 56,
    padR = 16,
    padT = 18,
    padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = months.length > 0 ? Math.min(60, innerW / months.length * 0.65) : 40;
  const gap = months.length > 1 ? (innerW - barW * months.length) / (months.length - 1) : 0;
  const maxVal = Math.max(...rows.map(r => r.income), ...rows.map(r => r.totalOut), 1);
  const yFor = v => padT + innerH - v / maxVal * innerH;
  const xFor = i => padL + i * (barW + gap);

  // Y-Achse Ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: maxVal * f,
    y: yFor(maxVal * f)
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "section",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 240)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Jahresabschluss")), availableYears.length > 1 && /*#__PURE__*/React.createElement("select", {
    value: selectedYear,
    onChange: e => setSelectedYear(e.target.value),
    style: {
      fontSize: "12px",
      padding: "3px 8px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      color: "var(--text)",
      cursor: "pointer"
    }
  }, availableYears.map(y => /*#__PURE__*/React.createElement("option", {
    key: y,
    value: y
  }, y)))), !yearAggregate ? /*#__PURE__*/React.createElement("div", {
    className: "entries-empty"
  }, "Keine Daten f\xFCr ", selectedYear, ".") : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 22px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "10px"
    }
  }, [{
    label: "Einnahmen gesamt",
    value: fmtEUR(yearAggregate.totalIncome),
    color: "var(--accent)"
  }, {
    label: "Ausgaben gesamt",
    value: fmtEUR(yearAggregate.totalOut),
    color: "var(--text)"
  }, {
    label: "Gespart",
    value: fmtEUR(yearAggregate.totalSaved),
    color: yearAggregate.totalSaved >= 0 ? "var(--accent)" : "var(--danger)"
  }].map(({
    label,
    value,
    color
  }) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      background: "var(--surface-2)",
      borderRadius: "8px",
      padding: "10px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "11px",
      color: "var(--text-faint)",
      marginBottom: "4px"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "18px",
      fontWeight: 600,
      color
    }
  }, value)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "10px"
    }
  }, [{
    label: "Ø Sparquote",
    value: yearAggregate.avgSavingsRate.toFixed(1) + " %",
    color: yearAggregate.avgSavingsRate >= 20 ? "var(--accent)" : yearAggregate.avgSavingsRate >= 10 ? "oklch(0.65 0.15 70)" : "var(--text-muted)"
  }, {
    label: "Bester Monat",
    value: yearAggregate.bestMonth ? monthLabel(yearAggregate.bestMonth.ym) : "—",
    color: "var(--text)"
  }, {
    label: "Schwächster",
    value: yearAggregate.worstMonth ? monthLabel(yearAggregate.worstMonth.ym) : "—",
    color: "var(--text)"
  }].map(({
    label,
    value,
    color
  }) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      background: "var(--surface-2)",
      borderRadius: "8px",
      padding: "10px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "11px",
      color: "var(--text-faint)",
      marginBottom: "4px"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "14px",
      fontWeight: 500,
      color
    }
  }, value)))))), /*#__PURE__*/React.createElement("div", {
    className: "section",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Monatsverlauf")), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      fontSize: 13,
      color: "var(--text-muted)",
      fontWeight: 500
    }
  }, months.length, " ", months.length === 1 ? "Monat" : "Monate")), rows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "chart-empty"
  }, "Noch keine Monatsdaten vorhanden.") : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 22px 18px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      width: "100%",
      height: 220,
      display: "block"
    },
    preserveAspectRatio: "none"
  }, ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    y1: t.y,
    x2: W - padR,
    y2: t.y,
    stroke: "var(--border)",
    strokeWidth: "1",
    strokeDasharray: i === 0 ? "none" : "2 4"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 8,
    y: t.y + 4,
    textAnchor: "end",
    fontSize: "10",
    fill: "var(--text-faint)",
    fontFamily: "var(--font-num)"
  }, t.val >= 1000 ? `${(t.val / 1000).toFixed(1)}k` : t.val.toFixed(0)))), rows.map((r, i) => {
    const x = xFor(i);
    const fixedH = r.fixed / maxVal * innerH;
    const savingsH = r.savings / maxVal * innerH;
    const variableH = r.variable / maxVal * innerH;
    const baseY = padT + innerH;
    return /*#__PURE__*/React.createElement("g", {
      key: r.ym
    }, fixedH > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: baseY - fixedH,
      width: barW,
      height: fixedH,
      fill: "oklch(0.65 0.13 50)",
      rx: "2"
    }), savingsH > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: baseY - fixedH - savingsH,
      width: barW,
      height: savingsH,
      fill: "oklch(0.65 0.13 240)",
      rx: "2"
    }), variableH > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: baseY - fixedH - savingsH - variableH,
      width: barW,
      height: variableH,
      fill: "oklch(0.65 0.13 320)",
      rx: "2"
    }), /*#__PURE__*/React.createElement("text", {
      x: x + barW / 2,
      y: H - 8,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "var(--text-faint)",
      fontFamily: "var(--font-num)"
    }, r.ym.slice(0, 7)));
  }), rows.length > 1 && /*#__PURE__*/React.createElement("polyline", {
    points: rows.map((r, i) => `${(xFor(i) + barW / 2).toFixed(1)},${yFor(r.income).toFixed(1)}`).join(" "),
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2",
    strokeLinejoin: "round"
  }), rows.map((r, i) => /*#__PURE__*/React.createElement("circle", {
    key: r.ym,
    cx: xFor(i) + barW / 2,
    cy: yFor(r.income),
    r: "3.5",
    fill: "var(--surface)",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 18,
      marginTop: 8,
      flexWrap: "wrap"
    }
  }, [{
    color: "oklch(0.65 0.13 50)",
    label: "Fixkosten"
  }, {
    color: "oklch(0.65 0.13 240)",
    label: "Sparen"
  }, {
    color: "oklch(0.65 0.13 320)",
    label: "Variable"
  }, {
    color: "var(--accent)",
    label: "Einnahmen",
    line: true
  }].map(l => /*#__PURE__*/React.createElement("div", {
    key: l.label,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      color: "var(--text-muted)"
    }
  }, l.line ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 16,
      height: 2.5,
      background: l.color,
      borderRadius: 2
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 10,
      height: 10,
      background: l.color,
      borderRadius: 2
    }
  }), l.label))))), rows.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "section",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 160)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Monats\xFCbersicht"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 14px",
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, [...rows].reverse().map(r => {
    const isNeg = r.remaining < 0;
    const noData = r.income === 0 && r.remaining === 0;
    const [, mNum] = r.ym.split("-");
    const mNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const mShort = mNames[Number(mNum) - 1] || mNum;
    const isCurrent = r.ym === state.currentMonth;
    return /*#__PURE__*/React.createElement("button", {
      key: r.ym,
      onClick: () => onJumpToMonth(r.ym),
      title: `Zu ${monthLabel(r.ym)} wechseln`,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 13px",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "center",
        border: isCurrent ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        background: isCurrent ? "var(--accent-soft)" : "var(--surface-2)",
        minWidth: 68
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10.5,
        color: isCurrent ? "var(--accent)" : "var(--text-muted)",
        fontWeight: 700,
        letterSpacing: "0.04em"
      }
    }, mShort, " ", r.ym.slice(2, 4)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: noData ? "var(--text-faint)" : isNeg ? "var(--danger)" : "var(--accent)"
      }
    }, noData ? "—" : (isNeg ? "−" : "+") + fmtEUR(Math.abs(r.remaining)).replace(" €", "") + " €"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 500,
        opacity: 0.75,
        color: noData ? "var(--text-faint)" : isNeg ? "var(--danger)" : "var(--accent)"
      }
    }, noData ? "keine Daten" : isNeg ? "überzogen" : "im Budget"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot savings"
  }), /*#__PURE__*/React.createElement("h2", null, "Alle Monate"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr",
      gap: 10,
      padding: "10px 22px",
      background: "var(--surface-2)",
      fontSize: "10.5px",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--text-muted)",
      fontWeight: 600,
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", null, "Monat"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Einnahmen"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Ausgaben"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Gespart"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Sparquote")), rows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "entries-empty"
  }, "Noch keine Monatsdaten.") : [...rows].reverse().map(r => /*#__PURE__*/React.createElement("div", {
    key: r.ym,
    onClick: () => onJumpToMonth(r.ym),
    style: {
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr",
      gap: 10,
      padding: "13px 22px",
      alignItems: "center",
      borderBottom: "1px solid var(--border)",
      cursor: "pointer",
      transition: "background 0.12s",
      fontVariantNumeric: "tabular-nums"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--surface-2)",
    onMouseLeave: e => e.currentTarget.style.background = ""
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 14
    }
  }, monthLabel(r.ym), r.ym === state.currentMonth && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 6px",
      borderRadius: 999,
      background: "var(--accent-soft)",
      color: "var(--accent)"
    }
  }, "Aktuell")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontWeight: 600,
      color: "var(--accent)",
      fontSize: 14
    }
  }, fmtEUR(r.income)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontSize: 14,
      color: r.remaining < 0 ? "var(--danger)" : "var(--text)"
    }
  }, fmtEUR(r.totalOut)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontSize: 14,
      fontWeight: 500
    }
  }, fmtEUR(r.savings)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right",
      fontSize: 13,
      fontWeight: 600,
      color: r.savingsRate >= 20 ? "var(--accent)" : r.savingsRate >= 10 ? "var(--warning)" : "var(--text-muted)"
    }
  }, r.savingsRate.toFixed(1), "%")))), catTrendData.length >= 2 && /*#__PURE__*/React.createElement("div", {
    className: "section",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 320)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Kategorie-Trend")), allCategoryLabels.length > 0 && /*#__PURE__*/React.createElement("select", {
    value: activeCatId || "",
    onChange: e => setSelectedCatId(e.target.value),
    style: {
      fontSize: "12px",
      padding: "3px 8px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      color: "var(--text)",
      cursor: "pointer"
    }
  }, allCategoryLabels.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label)))), (() => {
    const CW = 800,
      CH = 160,
      cpL = 56,
      cpR = 16,
      cpT = 14,
      cpB = 36;
    const iW = CW - cpL - cpR;
    const iH = CH - cpT - cpB;
    const maxV = Math.max(...catTrendData.map(d => Math.max(d.total, d.budget)), 1);
    const yC = v => cpT + iH - v / maxV * iH;
    const xC = i => catTrendData.length > 1 ? cpL + i / (catTrendData.length - 1) * iW : cpL + iW / 2;
    const totalPts = catTrendData.map((d, i) => `${xC(i).toFixed(1)},${yC(d.total).toFixed(1)}`).join(" ");
    const hasBudget = catTrendData.some(d => d.budget > 0);
    const budgetPts = catTrendData.map((d, i) => `${xC(i).toFixed(1)},${yC(d.budget).toFixed(1)}`).join(" ");
    const avgTotal = catTrendData.reduce((s, d) => s + d.total, 0) / catTrendData.length;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "12px 22px 14px"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${CW} ${CH}`,
      style: {
        width: "100%",
        height: 160,
        display: "block"
      },
      preserveAspectRatio: "none"
    }, [0, 0.5, 1].map((f, i) => {
      const y = yC(maxV * f);
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("line", {
        x1: cpL,
        y1: y,
        x2: CW - cpR,
        y2: y,
        stroke: "var(--border)",
        strokeWidth: "1",
        strokeDasharray: i === 0 ? "none" : "2 4"
      }), /*#__PURE__*/React.createElement("text", {
        x: cpL - 8,
        y: y + 4,
        textAnchor: "end",
        fontSize: "10",
        fill: "var(--text-faint)"
      }, maxV * f >= 1000 ? `${(maxV * f / 1000).toFixed(1)}k` : (maxV * f).toFixed(0)));
    }), hasBudget && catTrendData.length > 1 && /*#__PURE__*/React.createElement("polyline", {
      points: budgetPts,
      fill: "none",
      stroke: "oklch(0.65 0.15 70)",
      strokeWidth: "1.5",
      strokeDasharray: "4 3"
    }), catTrendData.length > 1 && /*#__PURE__*/React.createElement("polyline", {
      points: totalPts,
      fill: "none",
      stroke: "oklch(0.65 0.13 320)",
      strokeWidth: "2",
      strokeLinejoin: "round"
    }), catTrendData.map((d, i) => /*#__PURE__*/React.createElement("g", {
      key: d.ym
    }, /*#__PURE__*/React.createElement("circle", {
      cx: xC(i),
      cy: yC(d.total),
      r: "4",
      fill: "var(--surface)",
      stroke: "oklch(0.65 0.13 320)",
      strokeWidth: "2"
    }), /*#__PURE__*/React.createElement("text", {
      x: xC(i),
      y: CH - 4,
      textAnchor: "middle",
      fontSize: "9.5",
      fill: "var(--text-faint)"
    }, d.ym.slice(5, 7), "/", d.ym.slice(2, 4))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 16,
        marginTop: 6,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 2.5,
        background: "oklch(0.65 0.13 320)",
        borderRadius: 2,
        display: "inline-block"
      }
    }), "Ausgaben"), hasBudget && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        borderTop: "2px dashed oklch(0.65 0.15 70)",
        display: "inline-block"
      }
    }), "Budget"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto",
        fontVariantNumeric: "tabular-nums"
      }
    }, "\xD8 ", fmtEUR(Math.round(avgTotal)), " / Monat")));
  })()));
}

// ====================== Belege-Sektion (innerhalb BudgetView) ======================
function ReceiptsSection({
  receipts,
  total,
  categories,
  onOpen,
  onDelete
}) {
  const catById = useMemo(() => {
    const m = {};
    (categories || []).forEach(c => {
      m[c.id] = c.label;
    });
    return m;
  }, [categories]);

  // Neueste zuerst
  const sorted = useMemo(() => [...receipts].sort((a, b) => (b.datum || "").localeCompare(a.datum || "")), [receipts]);
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot receipts"
  }), /*#__PURE__*/React.createElement("h2", null, "Belege"), receipts.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "section-count"
  }, receipts.length), receipts.filter(r => r.steuerkat && r.steuerkat !== "privat").length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "steuerkat-counter",
    style: {
      fontSize: "10px",
      fontWeight: 700,
      padding: "2px 7px",
      borderRadius: "99px",
      marginLeft: "6px",
      background: "oklch(0.94 0.06 145)",
      color: "oklch(0.34 0.13 145)"
    },
    title: "Steuerrelevante Belege"
  }, "\xA7\xA7 ", receipts.filter(r => r.steuerkat && r.steuerkat !== "privat").length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: "var(--text-muted)"
    }
  }, fmtEUR(total)), receipts.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const year = Number((receipts[0]?.datum || receipts[0]?.month || "").slice(0, 4)) || new Date().getFullYear();
      const enriched = receipts.map(r => ({
        ...r,
        categoryLabel: (categories || []).find(c => c.id === r.categoryId)?.label || ""
      }));
      exportReceiptsCSV(enriched, year);
    },
    style: {
      fontSize: "11px",
      padding: "4px 10px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      cursor: "pointer",
      color: "var(--text-faint)"
    },
    title: "Belege als CSV exportieren (f\xFCr Steuerberater / ELSTER)"
  }, "\u2193 CSV"))), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, sorted.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "receipts-empty"
  }, /*#__PURE__*/React.createElement(Icon.Receipt, null), /*#__PURE__*/React.createElement("div", null, "Noch keine Belege f\xFCr diesen Monat."), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "Mit dem Kamera-Button unten rechts hinzuf\xFCgen.")) : sorted.map(r => /*#__PURE__*/React.createElement(ReceiptRow, {
    key: r.id,
    receipt: r,
    categoryLabel: catById[r.categoryId] || "—",
    onOpen: () => onOpen(r),
    onDelete: () => {
      if (confirm(`Beleg „${r.haendler || "Unbekannt"}“ wirklich löschen?`)) onDelete(r.id);
    }
  }))));
}
function ReceiptRow({
  receipt,
  categoryLabel,
  onOpen,
  onDelete
}) {
  const cached = useReceiptImage(receipt.id);
  const isPdf = receipt.imageType === "application/pdf" || cached?.mediaType === "application/pdf";
  const hasImage = !!cached && !isPdf;
  const kat = STEUER_KATEGORIEN.find(k => k.id === receipt.steuerkat);
  return /*#__PURE__*/React.createElement("div", {
    className: "receipt-row",
    onClick: onOpen,
    role: "button",
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter") onOpen();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-row-thumb"
  }, hasImage ? /*#__PURE__*/React.createElement("img", {
    src: cached.dataUrl,
    alt: ""
  }) : isPdf ? /*#__PURE__*/React.createElement(Icon.FileText, null) : /*#__PURE__*/React.createElement(Icon.Receipt, null)), /*#__PURE__*/React.createElement("div", {
    className: "receipt-row-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-row-merchant"
  }, receipt.haendler || "Unbekannter Beleg"), /*#__PURE__*/React.createElement("div", {
    className: "receipt-row-meta"
  }, /*#__PURE__*/React.createElement("span", null, receipt.datum ? fmtDate(receipt.datum) : "Kein Datum"), /*#__PURE__*/React.createElement("span", {
    className: "dot-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, categoryLabel), kat && kat.id !== "privat" && /*#__PURE__*/React.createElement("span", {
    className: "steuerkat-pill",
    style: {
      background: kat.bg,
      color: kat.farbe
    },
    title: kat.label
  }, kat.kurz))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-row-amount"
  }, fmtEUR(receipt.gesamtbetrag || 0)), /*#__PURE__*/React.createElement("button", {
    className: "row-delete",
    onClick: e => {
      e.stopPropagation();
      onDelete();
    },
    title: "L\xF6schen",
    "aria-label": "L\xF6schen"
  }, /*#__PURE__*/React.createElement(Icon.Trash, null)), /*#__PURE__*/React.createElement(Icon.Chevron, null));
}

// ====================== Beleg-Detail Overlay ======================
function ReceiptDetailOverlay({
  receipt,
  categoryLabel,
  onClose,
  onDelete
}) {
  const cached = useReceiptImage(receipt?.id);
  useEffect(() => {
    if (!receipt) return;
    const handler = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [receipt, onClose]);
  if (!receipt) return null;
  const isPdf = receipt.imageType === "application/pdf" || cached?.mediaType === "application/pdf";
  const imgUrl = cached?.dataUrl || null;
  return /*#__PURE__*/React.createElement("div", {
    className: "scanner-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-modal",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-header"
  }, /*#__PURE__*/React.createElement("h2", null, "Beleg-Details"), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null))), /*#__PURE__*/React.createElement("div", {
    className: "scanner-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-card"
  }, imgUrl && !isPdf && /*#__PURE__*/React.createElement("div", {
    className: "receipt-card-image"
  }, /*#__PURE__*/React.createElement("a", {
    href: imgUrl,
    target: "_blank",
    rel: "noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    src: imgUrl,
    alt: "Beleg"
  }))), imgUrl && isPdf && /*#__PURE__*/React.createElement("div", {
    className: "receipt-card-image"
  }, /*#__PURE__*/React.createElement("a", {
    href: imgUrl,
    target: "_blank",
    rel: "noreferrer",
    className: "pdf-pill"
  }, /*#__PURE__*/React.createElement(Icon.FileText, null), /*#__PURE__*/React.createElement("span", null, "PDF \xF6ffnen"))), !imgUrl && cached === undefined && receipt.hasImage && /*#__PURE__*/React.createElement("div", {
    className: "receipt-card-image",
    style: {
      minHeight: 120
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: "#fff",
      opacity: 0.6,
      fontSize: 13
    }
  }, "Bild wird geladen\u2026")), /*#__PURE__*/React.createElement("div", {
    className: "receipt-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-merchant",
    style: {
      flex: 1
    }
  }, receipt.haendler || "Unbekannter Beleg"), /*#__PURE__*/React.createElement("div", {
    className: "receipt-date"
  }, receipt.datum ? fmtDate(receipt.datum) : "—")), /*#__PURE__*/React.createElement("div", {
    className: "receipt-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field total"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Gesamtbetrag"), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-value"
  }, fmtEUR(receipt.gesamtbetrag || 0))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Budget-Kategorie"), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-value"
  }, categoryLabel || "—")), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Steuer-Kategorie"), (() => {
    const kat = STEUER_KATEGORIEN.find(k => k.id === receipt.steuerkat);
    if (!kat) return /*#__PURE__*/React.createElement("div", {
      className: "receipt-field-value empty"
    }, "\u2014");
    return /*#__PURE__*/React.createElement("div", {
      className: "receipt-field-value",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "steuerkat-pill",
      style: {
        background: kat.bg,
        color: kat.farbe
      }
    }, kat.kurz), /*#__PURE__*/React.createElement("span", null, kat.label));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "MwSt. 19%"), /*#__PURE__*/React.createElement("div", {
    className: `receipt-field-value ${Number(receipt.mwst_19) > 0 ? "" : "empty"}`
  }, Number(receipt.mwst_19) > 0 ? fmtEUR(receipt.mwst_19) : "—")), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "MwSt. 7%"), /*#__PURE__*/React.createElement("div", {
    className: `receipt-field-value ${Number(receipt.mwst_7) > 0 ? "" : "empty"}`
  }, Number(receipt.mwst_7) > 0 ? fmtEUR(receipt.mwst_7) : "—")), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field mono",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Rechnungsnummer"), /*#__PURE__*/React.createElement("div", {
    className: `receipt-field-value ${receipt.rechnungsnummer ? "" : "empty"}`
  }, receipt.rechnungsnummer || "—"))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onDelete
  }, "Beleg l\xF6schen"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: onClose
  }, "Schlie\xDFen"))))));
}

// ====================== Steuer-View ======================
// ── Pauschalen-Status-Karte ─────────────────────────────────────────────
// Zeigt Auslastung der wichtigsten Steuer-Pauschalen als Fortschrittsbalken.
// ── Arbeitsstätten-Editor (multi-location commute) ──────────────────────────
function Arbeitsstaetten({
  value = [],
  onChange
}) {
  const addItem = () => {
    onChange([...value, {
      id: String(Date.now()),
      name: "",
      km: 0,
      tage: 0
    }]);
  };
  const removeItem = id => onChange(value.filter(i => i.id !== id));
  const updateItem = (id, field, val) => onChange(value.map(i => i.id === id ? {
    ...i,
    [field]: val
  } : i));
  const inputSt = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 13,
    boxSizing: "border-box",
    fontFamily: "inherit"
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 10,
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-title"
  }, "Arbeitsst\xE4tten"), /*#__PURE__*/React.createElement("div", {
    className: "settings-row-sub"
  }, "km & Fahrtage f\xFCr Pendlerpauschale")), /*#__PURE__*/React.createElement("button", {
    onClick: addItem,
    style: {
      flexShrink: 0,
      padding: "5px 12px",
      borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--accent-soft)",
      color: "var(--accent)",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "+ Standort")), value.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box"
  }, "Noch keine Standorte \u2014 klicke \u201E+ Standort\" um Pendlerpauschale automatisch zu berechnen."), value.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    style: {
      background: "var(--surface-2)",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)",
      textTransform: "uppercase",
      letterSpacing: "0.06em"
    }
  }, "Standort ", i + 1), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeItem(item.id),
    style: {
      marginLeft: "auto",
      width: 22,
      height: 22,
      borderRadius: "50%",
      border: "none",
      background: "var(--border-strong)",
      color: "var(--text-muted)",
      fontSize: 11,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("input", {
    placeholder: "Bezeichnung (z.B. B\xFCro M\xFCnchen)",
    value: item.name || "",
    onChange: e => updateItem(item.id, "name", e.target.value),
    style: {
      ...inputSt,
      marginBottom: 6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginBottom: 3
    }
  }, "Entfernung (km)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "500",
    placeholder: "0",
    value: item.km || "",
    onChange: e => updateItem(item.id, "km", Number(e.target.value)),
    style: inputSt
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginBottom: 3
    }
  }, "Fahrtage / Jahr"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    max: "260",
    placeholder: "0",
    value: item.tage || "",
    onChange: e => updateItem(item.id, "tage", Number(e.target.value)),
    style: inputSt
  }))))), value.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box"
  }, "Pendlerpauschale aller Standorte wird summiert. Homeoffice-Tage (aus dem Steuer-Interview) verringern die Fahrtage von Standort 1."));
}
function PauschalenStatusCard({
  receipts = [],
  interviewAnswers = {},
  investments = {},
  selectedYear,
  K,
  onOpenInterview,
  tweaks = {}
}) {
  if (!K) return null;
  const ia = interviewAnswers || {};
  const yr = String(selectedYear || new Date().getFullYear());
  const yrNum = Number(yr);

  // Werbungskosten: Belege + Homeoffice + Pendler (Standort 1 + 2)
  const wkBelege = (receipts || []).filter(r => r.steuerkat === "werbungskosten" && (r.datum || "").startsWith(yr)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const hoTage = Number(ia.homeoffice_tage) || 0;
  const hoBetrag = Math.min(hoTage, K.homeoffice_max_tage || 210) * (K.homeoffice_pro_tag || 6);
  const atage = Number(ia.arbeitstage) || 0;
  function _calcPendler(km, tage) {
    if (km <= 0 || tage <= 0) return 0;
    if (yrNum >= 2026) return Math.round(tage * km * (K.entfernung_km_ab_21 || 0.38));
    const z1 = Math.min(km, 20),
      z2 = Math.max(0, km - 20);
    return Math.round(tage * (z1 * (K.entfernung_km_bis_20 || 0.30) + z2 * (K.entfernung_km_ab_21 || 0.38)));
  }

  // Use tweaks.arbeitsstaetten (multi-location) if configured, else fall back to interview answers
  const stättenList = (tweaks.arbeitsstaetten || []).length > 0 ? tweaks.arbeitsstaetten.map((s, idx) => ({
    name: s.name || `Standort ${idx + 1}`,
    km: Number(s.km) || 0,
    // For first location, subtract HO days from commute days
    tage: idx === 0 ? Math.max(0, Number(s.tage) - hoTage) : Number(s.tage) || 0
  })) : (() => {
    const p1km = Number(ia.entfernung_km) || Number(ia.arbeitsweg_km) || 0;
    const p1tage = Math.max(0, atage - hoTage);
    const p2km = Number(ia.zweiter_standort_km) || 0;
    const p2tage = Number(ia.zweiter_standort_tage) || 0;
    const list = [];
    if (p1km > 0) list.push({
      name: "Hauptstandort",
      km: p1km,
      tage: p1tage
    });
    if (p2km > 0) list.push({
      name: "Zweiter Standort",
      km: p2km,
      tage: p2tage
    });
    return list;
  })();
  const pendlBetragPerStaette = stättenList.map(s => _calcPendler(s.km, s.tage));
  const pendlTotal = pendlBetragPerStaette.reduce((a, b) => a + b, 0);
  // Keep legacy vars for display
  const pendlKm = stättenList[0]?.km || 0;
  const pendlTage = stättenList[0]?.tage || 0;
  const pendlBetrag = pendlBetragPerStaette[0] || 0;
  const p2km = stättenList[1]?.km || 0;
  const p2tage = stättenList[1]?.tage || 0;
  const pendl2Betrag = pendlBetragPerStaette[1] || 0;
  const wkGesamt = wkBelege + hoBetrag + pendlTotal;
  const wkMax = K.wk_pauschale || 1230;
  const wkUeber = wkGesamt > wkMax;

  // Homeoffice-Pauschale
  const hoMax = (K.homeoffice_pro_tag || 6) * (K.homeoffice_max_tage || 210);

  // Sparerpauschbetrag
  const verh = ia.familienstand === "verheiratet" || tweaks?.familienstand === "verheiratet";
  const sparerMax = verh ? K.sparerpauschbetrag_verheiratet || 2000 : K.sparerpauschbetrag_single || 1000;
  const trades = (investments?.trades || []).filter(t => (t.date || "").startsWith(yr));
  const kapSaldo = trades.reduce((s, t) => s + Number(t.amount || 0), 0);
  const kapSteuerpflichtig = Math.max(0, kapSaldo - sparerMax);

  // Grenzsteuersatz-Info für Ersparnis-Berechnung
  const brutto = Number(ia.brutto) || Number(ia.jahresbrutto) || 0;
  const gst = (() => {
    if (!brutto || typeof _calcPreciseGST !== "function") return null;
    return Math.round(_calcPreciseGST({
      brutto,
      _ia: ia
    }, yrNum) * 100);
  })();
  const hasProfil = brutto > 0;
  const Row = ({
    label,
    betrag,
    max,
    note,
    color = "var(--accent)",
    warn = false,
    overLabel
  }) => {
    const pct = max > 0 ? Math.min(1, betrag / max) : 0;
    const over = betrag > max;
    const barColor = over ? "#1D9E75" : warn ? "#BA7517" : color;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: "var(--text)"
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: over ? "#1D9E75" : warn ? "#BA7517" : "var(--text-muted)",
        fontWeight: over ? 700 : 400
      }
    }, over && overLabel ? overLabel : `${fmtEUR(betrag)} / ${fmtEUR(max)}`)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        borderRadius: 3,
        background: "var(--surface-2)",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: "100%",
        width: `${Math.min(100, pct * 100)}%`,
        background: barColor,
        borderRadius: 3,
        transition: "width 0.3s"
      }
    })), note && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--text-faint)",
        marginTop: 3
      }
    }, note));
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "section",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 240)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Pauschalen-Auslastung ", yr)), !hasProfil && /*#__PURE__*/React.createElement("button", {
    onClick: onOpenInterview,
    style: {
      fontSize: 11,
      padding: "3px 10px",
      borderRadius: 999,
      background: "var(--accent-soft)",
      color: "var(--accent)",
      border: "none",
      cursor: "pointer",
      fontWeight: 600
    }
  }, "Brutto erg\xE4nzen")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 22px 6px"
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Werbungskosten (gesamt)",
    betrag: wkGesamt,
    max: wkMax,
    color: "oklch(0.55 0.18 240)",
    overLabel: `✅ +${fmtEUR(wkGesamt - wkMax)} über Pauschale → Einzelnachweis lohnt!`,
    note: wkUeber ? gst ? `Steuerersparnis ca. ${fmtEUR(Math.round((wkGesamt - wkMax) * gst / 100))} (Grenzsteuersatz ~${gst} %)` : null : `Noch ${fmtEUR(wkMax - wkGesamt)} bis Einzelnachweis sich lohnt`
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Homeoffice-Pauschale",
    betrag: hoBetrag,
    max: hoMax,
    color: "oklch(0.60 0.15 200)",
    note: hoTage > 0 ? `${hoTage} Tage × ${K.homeoffice_pro_tag || 6} €` : "Homeoffice-Tage im Interview eintragen"
  }), pendlTotal > 0 || stättenList.length > 0 ? /*#__PURE__*/React.createElement(Row, {
    label: `Pendlerpauschale${stättenList.length > 1 ? ` (${stättenList.length} Standorte)` : ""}`,
    betrag: pendlTotal,
    max: wkMax,
    color: "oklch(0.60 0.15 270)",
    note: stättenList.filter(s => s.km > 0).map((s, i) => `${s.name}: ${s.km} km × ${s.tage} Tage = ${fmtEUR(pendlBetragPerStaette[i])}`).join(" · ") || null
  }) : null, /*#__PURE__*/React.createElement(Row, {
    label: "Sparerpauschbetrag",
    betrag: Math.max(0, kapSaldo),
    max: sparerMax,
    color: "oklch(0.60 0.15 140)",
    warn: kapSteuerpflichtig > 0,
    note: kapSaldo <= 0 ? "Keine realisierten Kapitalgewinne" : kapSteuerpflichtig > 0 ? `⚠️ ${fmtEUR(kapSteuerpflichtig)} über Freigrenze → KapESt fällig` : `${fmtEUR(sparerMax - Math.max(0, kapSaldo))} Freigrenze noch nicht ausgenutzt`
  }), !hasProfil && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-faint)",
      marginTop: 6,
      borderTop: "1px solid var(--border)",
      paddingTop: 8
    }
  }, "\uD83D\uDCA1 F\xFCr die Steuerersparnis in Euro: Brutto + Steuerklasse im Interview angeben.")));
}
function TaxView({
  receipts,
  months,
  currentYear,
  onOpenReceipt,
  investments = {},
  tweaks = {},
  interviewOpen = false,
  setInterviewOpen = () => {},
  interviewAnswers = {}
}) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // openSection: null | "brutto-netto" | "pauschale" | "elster" | "fristen" | "kat:<id>"
  const [openSection, setOpenSection] = useState(null);
  // Volle Modal-Overlays
  const [einspruchOpen, setEinspruchOpen] = useState(false);
  // NEU: Feature 5 — Bescheid-Prüfer
  const [bescheidPrueferOpen, setBescheidPrueferOpen] = useState(false);

  // Prüfen ob persönliche Daten bereits ausgefüllt (für Button-Hervorhebung)
  // Brutto-Netto-Default aus Monatsdaten (Schnitt × 12)
  const avgJahresBrutto = useMemo(() => {
    const ms = Object.values(months || {});
    if (!ms.length) return 0;
    const avg = ms.reduce((s, m) => s + (m.income || []).reduce((si, i) => si + (Number(i.amount) || 0), 0), 0) / ms.length;
    return Math.round(avg * 12);
  }, [months]);

  // Anzahl Belege im Jahr
  const yearReceipts = useMemo(() => (receipts || []).filter(r => {
    const y = (r.datum || r.month || "").slice(0, 4);
    return y === selectedYear;
  }), [receipts, selectedYear]);
  const totalAll = yearReceipts.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const totalRelevant = yearReceipts.filter(r => r.steuerkat && r.steuerkat !== "privat").reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
  const wkSum = yearReceipts.filter(r => r.steuerkat === "werbungskosten").reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);

  // Pro Kategorie: Belege + Summe
  const katStats = useMemo(() => {
    const m = {};
    for (const kat of STEUER_KATEGORIEN) {
      const list = yearReceipts.filter(r => (r.steuerkat || "privat") === kat.id);
      m[kat.id] = {
        kat,
        belege: list,
        total: list.reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0)
      };
    }
    return m;
  }, [yearReceipts]);

  // Monat-Label-Map für Anzeige
  const monthLabelById = id => {
    const r = (receipts || []).find(x => x.id === id);
    if (!r) return "";
    const m = months[r.month];
    return m?.variable.find(c => c.id === r.categoryId)?.label || "—";
  };

  // ────────── Cockpit-Daten (vor jedem Early-Return berechnen!) ──────────
  // Nächste Frist
  const naechsteFrist = useMemo(() => {
    if (typeof getSteuerfristenFuerJahr !== "function") return null;
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const all = getSteuerfristenFuerJahr(selectedYear).filter(f => f.datum).map(f => ({
      ...f,
      days: Math.ceil((new Date(f.datum) - heute) / 86400000)
    })).filter(f => f.days >= 0).sort((a, b) => a.days - b.days);
    return all[0] || null;
  }, [selectedYear]);

  // Alle Fristen für die Timeline (auch vergangene, im Jahres-Verlauf)
  const fristenForTimeline = useMemo(() => {
    if (typeof getSteuerfristenFuerJahr !== "function") return [];
    return getSteuerfristenFuerJahr(selectedYear).filter(f => f.datum);
  }, [selectedYear]);

  // Belege pro Monat (für Sparkline)
  const monthlySpark = useMemo(() => {
    const buckets = new Array(12).fill(0);
    yearReceipts.forEach(r => {
      if (r.steuerkat && r.steuerkat !== "privat") {
        const m = parseInt((r.datum || "").slice(5, 7), 10);
        if (m >= 1 && m <= 12) buckets[m - 1] += Number(r.gesamtbetrag) || 0;
      }
    });
    return buckets;
  }, [yearReceipts]);

  // Jahresfortschritt (für Timeline-Fill) — füllt die Linie immer bis zum
  // aktuellen Monat. Liegt das Fristen-Jahr in der Vergangenheit, voll gefüllt;
  // ansonsten der aktuelle Kalender-Monat innerhalb des Jahres.
  const jahresFortschritt = useMemo(() => {
    const heute = new Date();
    const yNow = heute.getFullYear();
    const fristenJahr = Number(selectedYear) + 1;
    if (fristenJahr < yNow) return 1;
    const start = new Date(yNow, 0, 1).getTime();
    const end = new Date(yNow + 1, 0, 1).getTime();
    return Math.min(1, Math.max(0, (heute.getTime() - start) / (end - start)));
  }, [selectedYear]);

  // Erstattungsschätzung: echte Berechnung wenn Lohnsteuerbescheinigung vorhanden,
  // sonst alte 30%-Näherung als Fallback.
  const erstattungSchaetzung = useMemo(() => {
    const ia = interviewAnswers || {};
    const wkP = getK(Number(selectedYear) || new Date().getFullYear()).wk_pauschale;
    const brutto = Number(ia.brutto) || 0;
    const gezahlteLohnsteuer = Number(ia.gezahlte_lohnsteuer) || 0;
    const gezahlterSoli = Number(ia.gezahlter_soli) || 0;
    const gezahltGesamt = gezahlteLohnsteuer + gezahlterSoli;
    if (!brutto || !gezahlteLohnsteuer) {
      const wkUeber = Math.max(0, wkSum - wkP);
      const restRelevant = totalRelevant - wkSum;
      return Math.round((wkUeber + Math.max(0, restRelevant)) * 0.3);
    }
    if (typeof calcBruttoNetto !== "function") {
      const wkUeber = Math.max(0, wkSum - wkP);
      const restRelevant = totalRelevant - wkSum;
      return Math.round((wkUeber + Math.max(0, restRelevant)) * 0.3);
    }
    const wkEffektiv = Math.max(wkSum, wkP);
    const saBelege = (receipts || []).filter(r => r.steuerkat === "sonderausgaben" && (r.datum || "").startsWith(selectedYear)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
    const hdlBelege = (receipts || []).filter(r => r.steuerkat === "haushaltsnahe" && (r.datum || "").startsWith(selectedYear)).reduce((s, r) => s + (Number(r.gesamtbetrag) || 0), 0);
    const hdlBonus = Math.min(1200, Math.round(hdlBelege * 0.6 * 0.2));
    const result = calcBruttoNetto({
      brutto,
      steuerklasse: Number(tweaks.steuerklasse) || 1,
      kirchensteuer: !!tweaks.kirchensteuer,
      bundesland: tweaks.bundesland || "default",
      kinder: !!ia.kinder,
      year: Number(selectedYear) || new Date().getFullYear()
    });
    const K = getK(Number(selectedYear) || new Date().getFullYear());
    const wkMehrkosten = Math.max(0, wkEffektiv - K.wk_pauschale);
    const saMehrkosten = Math.max(0, saBelege - K.sonderausgaben_pauschale);
    const gst = result.lohnsteuer > 0 && brutto > 0 ? Math.min(0.45, result.lohnsteuer / Math.max(1, brutto - (result.sv || 0) - K.wk_pauschale - K.sonderausgaben_pauschale - K.grundfreibetrag)) : 0.25;
    const steuerMinderung = Math.round((wkMehrkosten + saMehrkosten) * Math.min(0.45, Math.max(0, gst))) + hdlBonus;
    const steuerSoll = Math.max(0, result.lohnsteuer - steuerMinderung);
    const soliFrei = K.soli_freigrenze;
    const soliSoll = steuerSoll > soliFrei ? Math.round(steuerSoll * K.soli_satz) : 0;
    return Math.max(0, gezahltGesamt - (steuerSoll + soliSoll));
  }, [interviewAnswers, wkSum, totalRelevant, receipts, selectedYear, tweaks]);

  // WK-Pauschale 1230 €  →  Progress-Wert
  const wkPauschale = getK(Number(selectedYear) || new Date().getFullYear()).wk_pauschale;
  const wkProgress = Math.min(1, wkSum / wkPauschale);
  const wkUebersteigt = wkSum >= wkPauschale;

  // ────────── Detail-Ansicht: einzelne Sektion mit Zurück-Button ──────────
  if (openSection) {
    let title = "";
    let body = null;
    if (openSection === "brutto-netto") {
      title = "Brutto-Netto-Rechner";
      body = /*#__PURE__*/React.createElement("div", {
        className: "section"
      }, /*#__PURE__*/React.createElement(BruttoNettoRechner, {
        defaultBrutto: avgJahresBrutto,
        defaultSteuerklasse: tweaks.steuerklasse,
        defaultKst: tweaks.kirchensteuer,
        defaultBundesland: tweaks.bundesland
      }));
    } else if (openSection === "pauschale") {
      title = `Werbungskosten & Pauschalen ${selectedYear}`;
      body = /*#__PURE__*/React.createElement(PauschaleCard, {
        receipts: receipts,
        year: selectedYear,
        tweaks: tweaks
      });
    } else if (openSection === "elster") {
      title = `ELSTER-Export ${selectedYear}`;
      body = typeof ElsterExportButton !== "undefined" ? /*#__PURE__*/React.createElement(ElsterExportButton, {
        receipts: receipts,
        year: selectedYear
      }) : null;
    } else if (openSection === "fristen") {
      title = `Steuerfristen ${selectedYear}`;
      body = typeof FristenCard !== "undefined" ? /*#__PURE__*/React.createElement(FristenCard, {
        year: selectedYear
      }) : null;
    } else if (openSection.startsWith("kat:")) {
      const id = openSection.slice(4);
      const stat = katStats[id];
      if (stat) {
        title = stat.kat.label;
        body = /*#__PURE__*/React.createElement("div", {
          className: "section"
        }, /*#__PURE__*/React.createElement("div", {
          className: "section-header"
        }, /*#__PURE__*/React.createElement("div", {
          className: "section-title"
        }, /*#__PURE__*/React.createElement("div", {
          className: "section-dot",
          style: {
            background: stat.kat.farbe
          }
        }), /*#__PURE__*/React.createElement("h2", null, stat.kat.label), stat.belege.length > 0 && /*#__PURE__*/React.createElement("span", {
          className: "section-count"
        }, stat.belege.length)), /*#__PURE__*/React.createElement("div", {
          className: "section-total",
          style: {
            color: stat.total > 0 ? stat.kat.farbe : "var(--text-faint)"
          }
        }, stat.total > 0 ? fmtEUR(stat.total) : "—")), stat.belege.length === 0 ? /*#__PURE__*/React.createElement("div", {
          className: "receipts-empty",
          style: {
            padding: "32px 14px"
          }
        }, /*#__PURE__*/React.createElement("div", null, "Keine Belege in dieser Kategorie f\xFCr ", selectedYear, "."), /*#__PURE__*/React.createElement("div", {
          className: "sub",
          style: {
            marginTop: 6,
            lineHeight: 1.45
          }
        }, stat.kat.beschreibung)) : /*#__PURE__*/React.createElement("div", {
          className: "section-body"
        }, /*#__PURE__*/React.createElement("div", {
          className: "tax-table-header"
        }, /*#__PURE__*/React.createElement("div", null, "H\xE4ndler"), /*#__PURE__*/React.createElement("div", null, "Budget-Kategorie"), /*#__PURE__*/React.createElement("div", null, "Datum"), /*#__PURE__*/React.createElement("div", {
          style: {
            textAlign: "right"
          }
        }, "Betrag")), [...stat.belege].sort((a, b) => (b.datum || "").localeCompare(a.datum || "")).map(r => /*#__PURE__*/React.createElement("div", {
          key: r.id,
          className: "tax-row",
          onClick: () => onOpenReceipt(r),
          role: "button",
          tabIndex: 0,
          onKeyDown: e => {
            if (e.key === "Enter") onOpenReceipt(r);
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-main"
        }, /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-merchant"
        }, r.haendler || "Unbekannt"), r.rechnungsnummer && /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-meta"
        }, "Nr. ", r.rechnungsnummer)), /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-cat"
        }, monthLabelById(r.id) || "—"), /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-date"
        }, r.datum ? fmtDate(r.datum) : "—"), /*#__PURE__*/React.createElement("div", {
          className: "tax-cell-amount"
        }, fmtEUR(r.gesamtbetrag || 0)))), /*#__PURE__*/React.createElement("div", {
          className: "tax-sum-row",
          style: {
            background: stat.kat.bg,
            color: stat.kat.farbe
          }
        }, "Summe: ", fmtEUR(stat.total))));
      }
    }
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "tax-back",
      onClick: () => setOpenSection(null)
    }, /*#__PURE__*/React.createElement(Icon.Back, null), /*#__PURE__*/React.createElement("span", null, "Steuern ", selectedYear)), /*#__PURE__*/React.createElement("div", {
      className: "tax-subpage-title"
    }, title), body);
  }

  // ────────── Dashboard ──────────
  return /*#__PURE__*/React.createElement(React.Fragment, null, typeof TaxConfigStatusBanner !== "undefined" && /*#__PURE__*/React.createElement(TaxConfigStatusBanner, null), /*#__PURE__*/React.createElement("div", {
    className: "tax-cockpit",
    style: {
      borderColor: "rgb(255, 255, 255)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-cockpit-top"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "tax-cockpit-eyebrow"
  }, "Aktuelles Steuerjahr"), /*#__PURE__*/React.createElement("div", {
    className: "tax-cockpit-year"
  }, selectedYear)), /*#__PURE__*/React.createElement("div", {
    className: "month-picker"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedYear(String(Number(selectedYear) - 1)),
    "aria-label": "Vorheriges Jahr"
  }, /*#__PURE__*/React.createElement(Icon.Left, null)), /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, selectedYear), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedYear(String(Number(selectedYear) + 1)),
    "aria-label": "N\xE4chstes Jahr"
  }, /*#__PURE__*/React.createElement(Icon.Right, null)))), /*#__PURE__*/React.createElement("div", {
    className: "tax-timeline"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-timeline-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-timeline-fill",
    style: {
      width: `${jahresFortschritt * 100}%`
    }
  }), jahresFortschritt > 0 && jahresFortschritt < 1 && /*#__PURE__*/React.createElement("div", {
    className: "tax-timeline-now",
    style: {
      left: `${jahresFortschritt * 100}%`
    },
    "aria-label": "Heute"
  }), (() => {
    // Timeline-Kalender deckt das Fristen-Jahr (Steuerjahr + 1) ab,
    // weil alle Vorauszahlungen und die Abgabe dort liegen.
    const fristenJahr = Number(selectedYear) + 1;
    const start = new Date(fristenJahr, 0, 1).getTime();
    const end = new Date(fristenJahr + 1, 0, 1).getTime();
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    // Nach Datum sortieren und benachbarte Marker alternierend
    // oberhalb/unterhalb der Linie platzieren (Anti-Kollision).
    const sorted = [...fristenForTimeline].sort((a, b) => a.datum.localeCompare(b.datum));
    return sorted.map((f, idx) => {
      const d = new Date(f.datum);
      const pos = Math.min(100, Math.max(0, (d.getTime() - start) / (end - start) * 100));
      const past = d < heute;
      const align = pos < 8 ? "start" : pos > 92 ? "end" : "center";
      const below = idx % 2 === 1; // jede zweite unter die Linie
      // Kurz-Label generieren
      const shortLabel = f.id.startsWith("est_vz_") ? `VZ ${f.id.slice(-2).toUpperCase()}` : f.id === "abgabe_ohne_berater" ? "Abgabe" : f.label;
      return /*#__PURE__*/React.createElement("div", {
        key: f.id,
        className: `tax-timeline-marker ${past ? "past" : ""} align-${align} ${below ? "below" : ""}`,
        style: {
          left: `${pos}%`
        },
        title: `${f.label} – ${new Date(f.datum).toLocaleDateString("de-DE")}`
      }, /*#__PURE__*/React.createElement("span", {
        className: "tax-timeline-dot"
      }), /*#__PURE__*/React.createElement("span", {
        className: "tax-timeline-label"
      }, shortLabel));
    });
  })()), /*#__PURE__*/React.createElement("div", {
    className: "tax-timeline-months",
    "aria-label": `Kalender ${Number(selectedYear) + 1}`
  }, ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sept", "Okt", "Nov", "Dez"].map(m => /*#__PURE__*/React.createElement("span", {
    key: m
  }, m)))), /*#__PURE__*/React.createElement("div", {
    className: "tax-cockpit-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-stat-label"
  }, "Steuerrelevanter Betrag"), /*#__PURE__*/React.createElement("div", {
    className: "tax-stat-value accent"
  }, fmtEUR(totalRelevant))), /*#__PURE__*/React.createElement("div", {
    className: "tax-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tax-stat-label"
  }, "Voraussichtliche Erstattung", !interviewAnswers?.gezahlte_lohnsteuer && /*#__PURE__*/React.createElement("span", {
    title: "Basiert auf Sch\xE4tzung \u2014 gib deine Lohnsteuerbescheinigung in 'Pers\xF6nliche Daten' ein f\xFCr eine genaue Berechnung.",
    style: {
      marginLeft: 4,
      fontSize: 11,
      color: "var(--text-faint)",
      cursor: "help"
    }
  }, "(Sch\xE4tzung)")), /*#__PURE__*/React.createElement("div", {
    className: "tax-stat-value"
  }, erstattungSchaetzung > 0 && /*#__PURE__*/React.createElement("span", {
    className: "tax-stat-arrow"
  }, "\u2191"), fmtEUR(erstattungSchaetzung))), /*#__PURE__*/React.createElement("div", {
    className: "tax-stat tax-stat-spark"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 120 60",
    preserveAspectRatio: "none",
    className: "spark-svg"
  }, (() => {
    const max = Math.max(1, ...monthlySpark);
    // Kumulativ + smooth
    const cum = monthlySpark.reduce((acc, v, i) => {
      acc.push((acc[i - 1] || 0) + v);
      return acc;
    }, []);
    const cumMax = Math.max(1, cum[cum.length - 1]);
    const points = cum.map((v, i) => {
      const x = i / 11 * 120;
      const y = 60 - v / cumMax * 52 - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${points.join(" L ")}`;
    const areaPath = `M 0,60 L ${points.join(" L ")} L 120,60 Z`;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: areaPath,
      className: "spark-area"
    }), /*#__PURE__*/React.createElement("path", {
      d: linePath,
      className: "spark-line",
      fill: "none"
    }));
  })()))), typeof TaxInterview !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-cockpit-cta",
    onClick: () => setInterviewOpen(true)
  }, "Steuererkl\xE4rung vorbereiten", /*#__PURE__*/React.createElement(Icon.Right, null))), /*#__PURE__*/React.createElement("div", {
    className: "tax-section-label"
  }, "Werkzeuge"), /*#__PURE__*/React.createElement("div", {
    className: "tax-toolbar",
    role: "toolbar",
    "aria-label": "Steuer-Werkzeuge"
  }, typeof BruttoNettoRechner !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setOpenSection("brutto-netto")
  }, "Brutto-Netto"), typeof PauschaleCard !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setOpenSection("pauschale")
  }, "Pauschalen"), typeof ElsterExportButton !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setOpenSection("elster")
  }, "ELSTER-Export"), typeof FristenCard !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setOpenSection("fristen")
  }, "Fristen"), typeof SteuerbescheidPruefer !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setBescheidPrueferOpen(v => !v)
  }, "Bescheid pr\xFCfen"), typeof EinspruchsGenerator !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "tax-chip tool",
    onClick: () => setEinspruchOpen(true)
  }, "Einspruch")), bescheidPrueferOpen && typeof SteuerbescheidPruefer !== "undefined" && typeof buildUserProfile === "function" && (() => {
    const userProfile = buildUserProfile(interviewAnswers, tweaks);
    return /*#__PURE__*/React.createElement(SteuerbescheidPruefer, {
      profile: userProfile,
      receipts: receipts || [],
      year: selectedYear,
      onEinspruch: () => {
        setBescheidPrueferOpen(false);
        setEinspruchOpen(true);
      }
    });
  })(), /*#__PURE__*/React.createElement(PauschalenStatusCard, {
    receipts: receipts,
    interviewAnswers: interviewAnswers,
    investments: investments,
    selectedYear: selectedYear,
    K: getK(Number(selectedYear) || new Date().getFullYear()),
    tweaks: tweaks,
    onOpenInterview: () => setInterviewOpen(true)
  }), /*#__PURE__*/React.createElement("div", {
    className: "tax-section-label"
  }, "Belege nach Kategorie"), /*#__PURE__*/React.createElement("div", {
    className: "tax-cat-grid"
  }, STEUER_KATEGORIEN.map(kat => {
    const stat = katStats[kat.id];
    const ratio = totalAll > 0 ? stat.total / totalAll : 0;
    const empty = stat.belege.length === 0;
    return /*#__PURE__*/React.createElement("button", {
      key: kat.id,
      className: `tax-cat-card ${empty ? "empty" : ""}`,
      onClick: () => setOpenSection(`kat:${kat.id}`),
      style: {
        "--cat-color": kat.farbe,
        "--cat-bg": kat.bg
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-head"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tax-cat-kurz"
    }, kat.kurz), /*#__PURE__*/React.createElement("span", {
      className: "tax-cat-name"
    }, kat.label)), /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-amount-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-amount"
    }, empty ? "—" : fmtEUR(stat.total)), /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-meta"
    }, empty ? "Noch keine Belege" : `${stat.belege.length} ${stat.belege.length === 1 ? "Beleg" : "Belege"}`)), /*#__PURE__*/React.createElement("div", {
      className: "tax-cat-donut"
    }, /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 36 36",
      className: "donut-svg"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "18",
      r: "14",
      className: "donut-track",
      fill: "none",
      strokeWidth: "4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "18",
      r: "14",
      className: "donut-progress",
      fill: "none",
      strokeWidth: "4",
      strokeLinecap: "round",
      style: {
        strokeDasharray: 2 * Math.PI * 14,
        strokeDashoffset: 2 * Math.PI * 14 * (1 - ratio)
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "donut-pct"
    }, Math.round(ratio * 100), "%"))));
  })), typeof KapEStCard !== "undefined" && investments?.trades?.length > 0 && /*#__PURE__*/React.createElement(KapEStCard, {
    trades: investments.trades,
    year: selectedYear,
    tweaks: tweaks
  }), yearReceipts.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "receipts-empty",
    style: {
      padding: "32px 24px",
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Icon.Receipt, null), /*#__PURE__*/React.createElement("div", null, "Noch keine Belege f\xFCr ", selectedYear, "."), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "Belege werden automatisch nach Jahr ihres Datums einsortiert.")), interviewOpen && typeof TaxInterview !== "undefined" && /*#__PURE__*/React.createElement(TaxInterview, {
    receipts: receipts,
    investments: investments,
    year: selectedYear,
    tweaks: tweaks,
    onClose: () => setInterviewOpen(false)
  }), einspruchOpen && typeof EinspruchsGenerator !== "undefined" && /*#__PURE__*/React.createElement(EinspruchsGenerator, {
    receipts: receipts,
    year: selectedYear,
    tweaks: tweaks,
    onClose: () => setEinspruchOpen(false)
  }));
}

// ====================== Settings: kleine Bausteine ======================
function SettingsNavRow({
  label,
  value,
  onClick,
  icon,
  iconBg,
  active
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `settings-nav-row${active ? " active" : ""}`,
    onClick: onClick,
    role: "button",
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    className: "settings-nav-icon",
    style: {
      background: iconBg
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    className: "settings-nav-label"
  }, label), value && /*#__PURE__*/React.createElement("div", {
    className: "settings-nav-value"
  }, value), /*#__PURE__*/React.createElement(Icon.Chevron, null));
}
function SettingsRow({
  title,
  sub,
  value,
  onChange,
  kind = "toggle",
  options
}) {
  // kind: "toggle" | "segments"
  if (kind === "segments") {
    return /*#__PURE__*/React.createElement("div", {
      className: "settings-row-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "settings-row-text"
    }, /*#__PURE__*/React.createElement("div", {
      className: "settings-row-title"
    }, title), sub && /*#__PURE__*/React.createElement("div", {
      className: "settings-row-sub"
    }, sub)), /*#__PURE__*/React.createElement("div", {
      className: "settings-segments",
      "data-cols": options.length
    }, options.map(o => /*#__PURE__*/React.createElement("button", {
      key: o.v,
      className: `settings-segment ${value === o.v ? "active" : ""}`,
      onClick: () => onChange(o.v)
    }, o.l))));
  }
  return /*#__PURE__*/React.createElement("button", {
    className: "settings-toggle-row",
    onClick: () => onChange(!value),
    role: "switch",
    "aria-checked": value
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-toggle-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-toggle-title"
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    className: "settings-toggle-sub"
  }, sub)), /*#__PURE__*/React.createElement("div", {
    className: `settings-switch ${value ? "on" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-switch-thumb"
  })));
}
function SettingsSubpageHeader({
  title,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "settings-subpage-header"
  }, /*#__PURE__*/React.createElement("button", {
    className: "settings-subpage-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon.Back, null), /*#__PURE__*/React.createElement("span", null, "Einstellungen")), /*#__PURE__*/React.createElement("div", {
    className: "settings-subpage-title"
  }, title));
}

// ====================== Storage-Stats (Daten-Seite) ======================
function StorageStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let lsBytes = 0;
        try {
          // genauer: alle Keys einzeln
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const v = localStorage.getItem(k) || "";
            lsBytes += (k.length + v.length) * 2; // UTF-16 ~ 2 byte/char
          }
        } catch {}
        let imgBytes = 0;
        try {
          if (typeof window.idbAllImages === "function") {
            const map = await window.idbAllImages();
            for (const [, val] of map.entries()) {
              const du = val?.dataUrl || "";
              // base64 → ~0.75 * length bytes
              imgBytes += du.length * 0.75;
            }
          }
        } catch {}
        if (!alive) return;
        setStats({
          lsBytes,
          imgBytes,
          totalBytes: lsBytes + imgBytes
        });
      } catch {
        if (alive) setStats({
          lsBytes: 0,
          imgBytes: 0,
          totalBytes: 0
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const fmtBytes = b => {
    if (b < 1024) return `${b.toFixed(0)} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  };
  if (!stats) {
    return /*#__PURE__*/React.createElement("div", {
      className: "settings-storage-grid loading"
    }, /*#__PURE__*/React.createElement("div", null, "Wird geladen\u2026"), /*#__PURE__*/React.createElement("div", null));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "settings-storage-grid"
  }, /*#__PURE__*/React.createElement("div", null, "localStorage"), /*#__PURE__*/React.createElement("div", null, fmtBytes(stats.lsBytes)), /*#__PURE__*/React.createElement("div", null, "Bilder (IndexedDB)"), /*#__PURE__*/React.createElement("div", null, fmtBytes(stats.imgBytes)), /*#__PURE__*/React.createElement("div", {
    className: "total"
  }, "Gesamt"), /*#__PURE__*/React.createElement("div", {
    className: "total"
  }, fmtBytes(stats.totalBytes)));
}

// ====================== Settings Sheet ======================
const SETTINGS_PAGES = {
  appearance: "Erscheinungsbild",
  budget: "Budget & Anzeige",
  steuerprofil: "Steuer-Profil",
  scanner: "Scanner & OCR",
  notifications: "Benachrichtigungen",
  privacy: "Datenschutz & Sicherheit",
  data: "Daten"
};

// ====================== Verschlüsselungs-Info & PIN-Reset ======================
function EncryptionInfoCard() {
  const [info, setInfo] = useState(() => typeof window.secureGetEncryptionInfo === "function" ? window.secureGetEncryptionInfo() : null);
  useEffect(() => {
    if (!info && typeof window.secureGetEncryptionInfo === "function") {
      setInfo(window.secureGetEncryptionInfo());
    }
  }, [info]);
  if (!info) return null;
  const iterText = info.kdfIterations.toLocaleString("de-DE");
  return /*#__PURE__*/React.createElement("div", {
    className: "security-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-icon",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "10",
    width: "16",
    height: "11",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 10V7a4 4 0 0 1 8 0v3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "15.5",
    r: "1.2",
    fill: "currentColor",
    stroke: "none"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-title"
  }, "Verschl\xFCsselung deiner Daten"), /*#__PURE__*/React.createElement("div", {
    className: "security-card-sub"
  }, "Sensible Steuerdaten werden lokal auf deinem Ger\xE4t verschl\xFCsselt \u2014 niemals im Klartext gespeichert oder \xFCbertragen.")), info.pinSet && /*#__PURE__*/React.createElement("span", {
    className: "security-badge",
    title: "PIN ist gesetzt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "security-badge-dot"
  }), info.keyResident ? "Entsperrt" : "Geschützt")), /*#__PURE__*/React.createElement("div", {
    className: "security-facts"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-fact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-fact-key"
  }, "Verfahren"), /*#__PURE__*/React.createElement("div", {
    className: "security-fact-val"
  }, info.cipher, " \xB7 ", info.ivBytes, "-Byte IV pro Eintrag")), /*#__PURE__*/React.createElement("div", {
    className: "security-fact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-fact-key"
  }, "Schl\xFCssel"), /*#__PURE__*/React.createElement("div", {
    className: "security-fact-val"
  }, info.kdf, " \xB7 ", info.kdfHash, " \xB7 ", iterText, " Iterationen", info.saltBytes > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", info.saltBytes, "-Byte Salt"))), /*#__PURE__*/React.createElement("div", {
    className: "security-fact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-fact-key"
  }, "Speicherort"), /*#__PURE__*/React.createElement("div", {
    className: "security-fact-val"
  }, info.storage)), /*#__PURE__*/React.createElement("div", {
    className: "security-fact"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-fact-key"
  }, "PIN"), /*#__PURE__*/React.createElement("div", {
    className: "security-fact-val"
  }, "Verl\xE4sst nie das Ger\xE4t \xB7 Schl\xFCssel nur im Arbeitsspeicher"))));
}
function PinResetCard() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Einfache PIN-Stärke (Heuristik): Länge + Zeichenklassen
  const strength = useMemo(() => {
    const p = newPin || "";
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter(re => re.test(p)).length;
    if (classes >= 2) s++;
    if (classes >= 3 && p.length >= 8) s++;
    return Math.min(4, s);
  }, [newPin]);
  const strengthLabel = ["", "Sehr schwach", "Schwach", "Solide", "Stark"][strength];
  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setError("");
    setSuccess(false);
    if (!oldPin) {
      setError("Aktuellen PIN eingeben.");
      return;
    }
    if (newPin.length < 6) {
      setError("Neuer PIN benötigt mindestens 6 Zeichen.");
      return;
    }
    if (newPin !== confirm) {
      setError("Neuer PIN und Bestätigung stimmen nicht überein.");
      return;
    }
    if (oldPin === newPin) {
      setError("Neuer PIN muss sich vom alten unterscheiden.");
      return;
    }
    setBusy(true);
    try {
      if (typeof window.secureChangePin !== "function") {
        setError("PIN-Wechsel ist gerade nicht verfügbar.");
        return;
      }
      const res = await window.secureChangePin(oldPin, newPin);
      if (res.ok) {
        setSuccess(true);
        setOldPin("");
        setNewPin("");
        setConfirm("");
      } else {
        setError(res.err || "PIN konnte nicht geändert werden.");
      }
    } catch (err) {
      console.error(err);
      setError("Unbekannter Fehler. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "security-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-icon",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "security-card-title"
  }, "PIN zur\xFCcksetzen & neu vergeben"), /*#__PURE__*/React.createElement("div", {
    className: "security-card-sub"
  }, "Wechselt deinen App-PIN und verschl\xFCsselt alle gespeicherten Daten mit einem frisch abgeleiteten Schl\xFCssel neu."))), /*#__PURE__*/React.createElement("form", {
    className: "pwreset-form",
    onSubmit: handleSubmit,
    autoComplete: "off"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pwreset-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "pwreset-label",
    htmlFor: "pwreset-old"
  }, "Aktueller PIN"), /*#__PURE__*/React.createElement("input", {
    id: "pwreset-old",
    type: "password",
    inputMode: "numeric",
    className: "pwreset-input",
    value: oldPin,
    placeholder: "Aktuellen PIN eingeben",
    onChange: e => {
      setOldPin(e.target.value);
      setError("");
      setSuccess(false);
    },
    autoComplete: "current-password"
  })), /*#__PURE__*/React.createElement("div", {
    className: "pwreset-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "pwreset-label",
    htmlFor: "pwreset-new"
  }, "Neuer PIN ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.55,
      fontWeight: 500,
      textTransform: "none",
      letterSpacing: 0
    }
  }, "\xB7 mind. 6 Zeichen")), /*#__PURE__*/React.createElement("input", {
    id: "pwreset-new",
    type: "password",
    inputMode: "text",
    className: "pwreset-input",
    value: newPin,
    placeholder: "Neuen PIN w\xE4hlen",
    onChange: e => {
      setNewPin(e.target.value);
      setError("");
      setSuccess(false);
    },
    autoComplete: "new-password"
  }), newPin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "pwreset-strength",
    "aria-hidden": "true"
  }, [1, 2, 3, 4].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `pwreset-strength-bar ${i <= strength ? `on-${strength}` : ""}`
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pwreset-hint"
  }, "St\xE4rke: ", strengthLabel))), /*#__PURE__*/React.createElement("div", {
    className: "pwreset-field"
  }, /*#__PURE__*/React.createElement("label", {
    className: "pwreset-label",
    htmlFor: "pwreset-confirm"
  }, "Neuer PIN best\xE4tigen"), /*#__PURE__*/React.createElement("input", {
    id: "pwreset-confirm",
    type: "password",
    inputMode: "text",
    className: "pwreset-input",
    value: confirm,
    placeholder: "Neuen PIN wiederholen",
    onChange: e => {
      setConfirm(e.target.value);
      setError("");
      setSuccess(false);
    },
    autoComplete: "new-password"
  })), error && /*#__PURE__*/React.createElement("div", {
    className: "pwreset-error",
    role: "alert"
  }, error), success && /*#__PURE__*/React.createElement("div", {
    className: "pwreset-success",
    role: "status"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })), "PIN erfolgreich ge\xE4ndert. Alle Daten wurden neu verschl\xFCsselt."), /*#__PURE__*/React.createElement("div", {
    className: "pwreset-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "settings-action primary",
    disabled: busy || !oldPin || !newPin || !confirm
  }, busy ? "Wird geändert …" : "PIN ändern"))));
}
function SettingsSheet({
  open,
  onClose,
  tweaks,
  setTweak,
  state,
  onExport,
  onImport,
  onReset,
  onFristenSync
}) {
  const [page, setPage] = React.useState("home");
  const [notifWarning, setNotifWarning] = React.useState(null);
  React.useEffect(() => {
    if (!open) {
      setPage("home");
      setNotifWarning(null);
    }
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (e.key === "Escape") {
        if (page !== "home") setPage("home");else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose, page]);
  if (!open) return null;
  const themeLabel = {
    warm: "Warm",
    cool: "Cool",
    dark: "Dark"
  }[tweaks.theme] || "Warm";
  const fontLabel = tweaks.fontSize === 13 ? "Klein" : tweaks.fontSize === 17 ? "Groß" : "Normal";
  const startViewLabel = {
    budget: "Budget",
    history: "Verlauf",
    investments: "Invest."
  }[tweaks.startView] || "Budget";
  const ocrLabel = {
    deu: "Deutsch",
    eng: "Englisch",
    "deu+eng": "Beides"
  }[tweaks.ocrLang] || "Beides";
  const handleMonthEndToggle = async v => {
    if (v) {
      if (!("Notification" in window)) {
        setNotifWarning("Benachrichtigungen werden in diesem Browser nicht unterstützt.");
        return;
      }
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setNotifWarning("Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.");
          return;
        }
        setNotifWarning(null);
        setTweak("monthEndReminder", true);
        try {
          onFristenSync?.();
        } catch {}
        try {
          navigator.serviceWorker?.controller?.postMessage({
            type: "schedule-month-end-reminder",
            enabled: true
          });
        } catch {}
      } catch (e) {
        setNotifWarning("Permission-Anfrage fehlgeschlagen: " + (e.message || e));
      }
    } else {
      setTweak("monthEndReminder", false);
      try {
        navigator.serviceWorker?.controller?.postMessage({
          type: "schedule-month-end-reminder",
          enabled: false
        });
      } catch {}
    }
  };
  const NAV_ITEMS = [{
    id: "appearance",
    label: "Erscheinungsbild",
    value: `${themeLabel} · ${fontLabel}`,
    iconBg: "#6e3cbc",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    }))
  }, {
    id: "budget",
    label: "Budget & Anzeige",
    value: startViewLabel,
    iconBg: "#1a7f4b",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "1",
      x2: "12",
      y2: "23"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
    }))
  }, {
    id: "steuerprofil",
    label: "Steuer-Profil",
    value: `SK ${tweaks.steuerklasse} · ${tweaks.familienstand === "verheiratet" ? "Verh." : tweaks.familienstand === "geschieden" ? "Getr." : "Ledig"}`,
    iconBg: "#1d5db8",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "14 2 14 8 20 8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "13",
      x2: "8",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "17",
      x2: "8",
      y2: "17"
    }))
  }, {
    id: "scanner",
    label: "Scanner & OCR",
    value: ocrLabel,
    iconBg: "#0e7490",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "13",
      r: "4"
    }))
  }, {
    id: "notifications",
    label: "Benachrichtigungen",
    value: null,
    iconBg: "#c0392b",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M13.73 21a2 2 0 0 1-3.46 0"
    }))
  }, {
    id: "privacy",
    label: "Datenschutz & Sicherheit",
    value: null,
    iconBg: "#2563eb",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "11",
      rx: "2",
      ry: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 11V7a5 5 0 0 1 10 0v4"
    }))
  }, {
    id: "data",
    label: "Daten",
    value: null,
    iconBg: "#4b5563",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "white",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("ellipse", {
      cx: "12",
      cy: "5",
      rx: "9",
      ry: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
    }))
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "settings-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-sheet",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-v2-header"
  }, page !== "home" ? /*#__PURE__*/React.createElement("button", {
    className: "settings-v2-back",
    onClick: () => setPage("home")
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 18l-6-6 6-6"
  })), "Einstellungen") : /*#__PURE__*/React.createElement("span", {
    className: "settings-v2-title"
  }, "Einstellungen"), page !== "home" && /*#__PURE__*/React.createElement("span", {
    className: "settings-v2-page-label"
  }, SETTINGS_PAGES[page]), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null))), /*#__PURE__*/React.createElement("div", {
    className: "settings-v2-body"
  }, page === "home" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "settings-v2-nav-list"
  }, NAV_ITEMS.map(item => /*#__PURE__*/React.createElement(SettingsNavRow, {
    key: item.id,
    active: false,
    label: item.label,
    value: item.value,
    icon: item.icon,
    iconBg: item.iconBg,
    onClick: () => setPage(item.id)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "settings-footer"
  }, "Ausgaben Trocken \xB7 Lokal gespeichert")) : /*#__PURE__*/React.createElement("div", {
    className: "settings-v2-content"
  }, page === "appearance" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Theme",
    sub: "Farbschema der gesamten App",
    value: tweaks.theme,
    onChange: v => setTweak("theme", v),
    options: [{
      v: "warm",
      l: "Warm"
    }, {
      v: "cool",
      l: "Cool"
    }, {
      v: "dark",
      l: "Dark"
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Schriftgr\xF6\xDFe",
    sub: `Aktuell: ${fontLabel} (${tweaks.fontSize}px)`,
    value: tweaks.fontSize,
    onChange: v => setTweak("fontSize", v),
    options: [{
      v: 13,
      l: "Klein"
    }, {
      v: 15,
      l: "Normal"
    }, {
      v: 17,
      l: "Groß"
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Kompakt-Modus",
    sub: "Reduziert Abst\xE4nde in Listen und Sektionen",
    value: tweaks.compact,
    onChange: v => setTweak("compact", v)
  })), page === "budget" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Fixkosten-Betr\xE4ge \xFCbernehmen",
    sub: "Beim Anlegen neuer Monate Betr\xE4ge des Vormonats kopieren",
    value: tweaks.keepFixedAmounts,
    onChange: v => setTweak("keepFixedAmounts", v)
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Starttab",
    sub: "Ansicht beim \xD6ffnen der App",
    value: tweaks.startView,
    onChange: v => setTweak("startView", v),
    options: [{
      v: "budget",
      l: "Budget"
    }, {
      v: "history",
      l: "Verlauf"
    }, {
      v: "investments",
      l: "Invest."
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Abrechnungszeitraum",
    sub: "Welcher Zeitraum als 'aktueller Monat' im Budget gilt",
    value: tweaks.budgetPeriodMode,
    onChange: v => setTweak("budgetPeriodMode", v),
    options: [{
      v: "calendar",
      l: "Kalendermonat"
    }, {
      v: "custom",
      l: "Eigener Zeitraum"
    }]
  }), tweaks.budgetPeriodMode === "custom" && /*#__PURE__*/React.createElement("div", {
    className: "settings-row-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-title"
  }, "Starttag"), /*#__PURE__*/React.createElement("div", {
    className: "settings-row-sub"
  }, "Zeitraum l\xE4uft vom ", tweaks.budgetPeriodStartDay, ". bis zum ", tweaks.budgetPeriodStartDay, ". des Folgemonats \u2014 z. B. ab dem Tag deines Gehaltseingangs. F\xE4llt dieser Tag auf ein Wochenende, verschiebt sich der Periodenstart automatisch auf den n\xE4chsten Werktag (Montag).")), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: "28",
    inputMode: "numeric",
    value: tweaks.budgetPeriodStartDay,
    onChange: e => {
      const raw = Number(e.target.value);
      const v = Number.isFinite(raw) ? Math.min(28, Math.max(1, Math.round(raw))) : 1;
      setTweak("budgetPeriodStartDay", v);
    },
    style: {
      width: 70,
      padding: "7px 10px",
      borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text)",
      fontSize: 14,
      fontFamily: "inherit"
    }
  })), /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Backup-Erinnerung",
    sub: "Banner anzeigen, wenn l\xE4nger nicht exportiert wurde",
    value: tweaks.backupReminder,
    onChange: v => setTweak("backupReminder", v)
  }), tweaks.backupReminder && /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Intervall",
    sub: `So oft soll erinnert werden`,
    value: tweaks.backupIntervalWeeks,
    onChange: v => setTweak("backupIntervalWeeks", v),
    options: [{
      v: 2,
      l: "2 Wo."
    }, {
      v: 4,
      l: "4 Wo."
    }, {
      v: 8,
      l: "8 Wo."
    }]
  })), page === "steuerprofil" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Steuerklasse",
    sub: "Lohnsteuerklasse f\xFCr die Brutto-Netto-Berechnung",
    value: tweaks.steuerklasse,
    onChange: v => setTweak("steuerklasse", v),
    options: [{
      v: 1,
      l: "I"
    }, {
      v: 2,
      l: "II"
    }, {
      v: 3,
      l: "III"
    }, {
      v: 4,
      l: "IV"
    }, {
      v: 5,
      l: "V"
    }, {
      v: 6,
      l: "VI"
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Familienstand",
    sub: "Beeinflusst Sparerpauschbetrag und Splitting",
    value: tweaks.familienstand,
    onChange: v => setTweak("familienstand", v),
    options: [{
      v: "ledig",
      l: "Ledig"
    }, {
      v: "verheiratet",
      l: "Verheiratet"
    }, {
      v: "geschieden",
      l: "Getrennt"
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Bundesland",
    sub: "Kirchensteuersatz (BY/BW: 8\xA0%, andere: 9\xA0%)",
    value: tweaks.bundesland,
    onChange: v => setTweak("bundesland", v),
    options: [{
      v: "default",
      l: "Standard 9%"
    }, {
      v: "BY",
      l: "Bayern 8%"
    }, {
      v: "BW",
      l: "BW 8%"
    }]
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Kirchensteuer",
    sub: "Wird in KapESt und Brutto-Netto ber\xFCcksichtigt",
    value: tweaks.kirchensteuer,
    onChange: v => setTweak("kirchensteuer", v)
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Besch\xE4ftigung",
    sub: "Beeinflusst Interview-Fragen und Steuer-Hinweise",
    value: tweaks.berufstyp,
    onChange: v => setTweak("berufstyp", v),
    options: [{
      v: "arbeitnehmer",
      l: "Angestellt"
    }, {
      v: "selbststaendig",
      l: "Selbst."
    }, {
      v: "student_voll",
      l: "Student"
    }, {
      v: "rente",
      l: "Rente"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border)",
      margin: "16px 0"
    }
  }), /*#__PURE__*/React.createElement(Arbeitsstaetten, {
    value: tweaks.arbeitsstaetten || [],
    onChange: v => setTweak("arbeitsstaetten", v)
  }), /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box",
    style: {
      marginTop: 12
    }
  }, "Diese Angaben werden ausschlie\xDFlich lokal gespeichert und nur f\xFCr Berechnungen innerhalb dieser App verwendet.")), page === "scanner" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "OCR-Sprache",
    sub: "Sprache, die beim Belegscan erkannt wird",
    value: tweaks.ocrLang,
    onChange: v => setTweak("ocrLang", v),
    options: [{
      v: "deu",
      l: "Deutsch"
    }, {
      v: "eng",
      l: "Englisch"
    }, {
      v: "deu+eng",
      l: "Beides"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box"
  }, "Beim ersten Scan wird das Sprachpaket heruntergeladen (~5\xA0MB) und danach offline gecacht.")), page === "notifications" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Monatsabschluss-Erinnerung",
    sub: "Am letzten Tag des Monats an Belege & Abschluss erinnern",
    value: tweaks.monthEndReminder,
    onChange: handleMonthEndToggle
  }), notifWarning && /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box warning"
  }, notifWarning), /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Budget-Warnung",
    sub: "Hinweis, wenn eine variable Kategorie den Schwellwert \xFCberschreitet",
    value: tweaks.budgetWarning,
    onChange: v => setTweak("budgetWarning", v)
  }), tweaks.budgetWarning && /*#__PURE__*/React.createElement(SettingsRow, {
    kind: "segments",
    title: "Schwellwert",
    sub: `Warnen ab ${tweaks.budgetWarnPct}% des Budgets`,
    value: tweaks.budgetWarnPct,
    onChange: v => setTweak("budgetWarnPct", v),
    options: [{
      v: 50,
      l: "50%"
    }, {
      v: 70,
      l: "70%"
    }, {
      v: 80,
      l: "80%"
    }, {
      v: 90,
      l: "90%"
    }]
  })), page === "privacy" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    title: "Daten beim Schlie\xDFen l\xF6schen",
    sub: "Inkognito-Modus: alle Daten werden beim Schlie\xDFen permanent gel\xF6scht",
    value: tweaks.clearOnClose,
    onChange: v => {
      if (v && !confirm("Achtung: Alle Daten werden beim Schließen der App permanent gelöscht. Wirklich aktivieren?")) return;
      setTweak("clearOnClose", v);
    }
  }), tweaks.clearOnClose && /*#__PURE__*/React.createElement("div", {
    className: "settings-info-box warning"
  }, "Alle Daten werden beim Schlie\xDFen der App permanent gel\xF6scht."), /*#__PURE__*/React.createElement(EncryptionInfoCard, null), /*#__PURE__*/React.createElement(PinResetCard, null)), page === "data" && /*#__PURE__*/React.createElement("div", {
    className: "settings-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-title"
  }, "Datengr\xF6\xDFe"), /*#__PURE__*/React.createElement("div", {
    className: "settings-row-sub"
  }, "Speicherverbrauch dieser App")), /*#__PURE__*/React.createElement(StorageStats, null)), /*#__PURE__*/React.createElement("div", {
    className: "settings-row-block",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-text",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "settings-row-title"
  }, "Datensicherung"), /*#__PURE__*/React.createElement("div", {
    className: "settings-row-sub"
  }, "Exportieren, importieren oder alle Daten zur\xFCcksetzen")), /*#__PURE__*/React.createElement("button", {
    className: "settings-action primary",
    onClick: onExport
  }, "Daten exportieren (Backup)"), /*#__PURE__*/React.createElement("label", {
    className: "settings-action",
    style: {
      textAlign: "center",
      cursor: "pointer"
    }
  }, "Daten importieren", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".json",
    style: {
      display: "none"
    },
    onChange: e => {
      if (e.target.files[0]) onImport(e.target.files[0]);
      e.target.value = "";
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: "settings-action danger",
    onClick: () => {
      if (confirm("Alle Daten dauerhaft löschen? Diese Aktion kann nicht rükgängig gemacht werden.")) onReset();
    }
  }, "Alle Daten zur\xFCcksetzen")))))));
}

// ====================== App ======================
function App() {
  const [state, setState] = useState(loadState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [budgetBotOpen, setBudgetBotOpen] = useState(false);
  const [budgetBotPendingMsg, setBudgetBotPendingMsg] = useState(null);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [interviewAnswers, setInterviewAnswers] = useState(() => {
    // Entschlüsselte Daten kommen von PinGate über window.__decryptedInterviewAnswers
    return window.__decryptedInterviewAnswers || {};
  });
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  // FIX #7: Storage-Quota-Warnung
  const [storageWarning, setStorageWarning] = useState(false);
  // Speichern-Button Feedback
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const _saveStatusTimerRef = useRef(null);
  // Autosave darf erst laufen, nachdem der echte State geladen wurde.
  // Ohne dieses Flag würde saveState(defaultState()) den verschlüsselten
  // echten State in localStorage überschreiben, bevor loadStateAsync() fertig ist.
  const [stateReady, setStateReady] = useState(false);

  // Interview-Antworten frisch halten, wenn das Interview im Hintergrund läuft
  useEffect(() => {
    const onUpd = e => setInterviewAnswers(e.detail || {});
    window.addEventListener("interview-answers-updated", onUpd);
    return () => window.removeEventListener("interview-answers-updated", onUpd);
  }, []);

  // PIN-Unlock: verschlüsselten State laden und in React-State setzen.
  //
  // BUG-FIX: Das "ausgaben-pin-unlocked"-Event wird in _unlock() ausgelöst,
  // BEVOR PinGate {children} rendert — also bevor App überhaupt gemountet ist.
  // Der addEventListener unten würde das Event deshalb nie empfangen.
  // Lösung: Beim Mount direkt prüfen ob der PIN schon entsperrt ist
  // (secureIsUnlocked() === true) und loadStateAsync() sofort aufrufen.
  // Der addEventListener bleibt als Fallback für spätere Re-Locks/Re-Unlocks.
  useEffect(() => {
    const tryLoad = async () => {
      if (typeof loadStateAsync !== "function") {
        setStateReady(true);
        return;
      }
      const decrypted = await loadStateAsync();
      if (decrypted) setState(decrypted);
      setStateReady(true);
    };
    // App mountet immer NACH dem PIN-Unlock (PinGate rendert children erst dann).
    // Das Event ist bereits gefeuert — direkt laden.
    if (typeof window.secureIsUnlocked === "function" && window.secureIsUnlocked()) {
      tryLoad();
    } else {
      // Kein PIN-System aktiv — loadState() liefert bereits den richtigen State.
      setStateReady(true);
    }
    // Fallback: bei erneutem Unlock (z. B. nach manuellem Sperren) auch reagieren.
    window.addEventListener("ausgaben-pin-unlocked", tryLoad);
    return () => window.removeEventListener("ausgaben-pin-unlocked", tryLoad);
  }, []);

  // FIX #7: Einmaliger Listener für QuotaExceededError aus saveState
  useEffect(() => {
    const onQuota = () => setStorageWarning(true);
    window.addEventListener("storage-quota-exceeded", onQuota);
    return () => window.removeEventListener("storage-quota-exceeded", onQuota);
  }, []);

  // Banner-Dismiss-State (sessionStorage: nur diese Session)
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(() => sessionStorage.getItem("ausgaben-backup-dismissed") === "1");

  // ── Autosave: sofortiger Cache-Update + debounced localStorage-Schreibzugriff ──
  //
  // Läuft erst, wenn stateReady === true — also nachdem der echte (evtl.
  // verschlüsselte) State via loadStateAsync() geladen wurde.
  // Ohne diese Sperre würde der initiale defaultState() nach 500 ms den
  // echten verschlüsselten State in localStorage überschreiben.
  const _saveTimerRef = useRef(null);
  const _stateRef = useRef(state);
  _stateRef.current = state;
  useEffect(() => {
    if (!stateReady) return; // Warten bis echter State geladen ist
    // Cache sofort aktualisieren (kein Debounce) — beforeunload liest daraus synchron
    if (typeof updateEncryptedCache === "function") updateEncryptedCache(state);
    // localStorage-Schreibzugriff debouncen (500 ms)
    if (_saveTimerRef.current) clearTimeout(_saveTimerRef.current);
    _saveTimerRef.current = setTimeout(() => {
      saveState(state);
    }, 500);
    return () => {
      if (_saveTimerRef.current) clearTimeout(_saveTimerRef.current);
    };
  }, [state, stateReady]);
  useEffect(() => {
    const flush = () => {
      // Synchroner Flush — localStorage.setItem aus dem RAM-Cache.
      // async saveState() würde hier nicht rechtzeitig fertig werden.
      if (typeof saveStateCached === "function") saveStateCached();
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  // Einmalige Migration: Belege mit Inline-Bild in IDB verschieben
  useEffect(() => {
    if (typeof migrateInlineImagesToIDB === "function") {
      migrateInlineImagesToIDB(state, setState).catch(() => {});
    }
    // absichtlich nur beim Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Steuersätze im Hintergrund aktualisieren (Remote-Configuration).
  // Lädt tax-config.json beim App-Start in dieser Reihenfolge:
  //   1. GitHub-Raw (immer aktuellster Stand)
  //   2. lokales ./tax-config.json (Offline-Fallback)
  // Persistiert das rohe JSON in localStorage und feuert
  // `tax-config-updated`, damit Komponenten neu rendern.
  // Schlägt offline ganz fehl, läuft mit dem letzten Cache (bzw. mit
  // INLINE_BOOTSTRAP beim allerersten Offline-Start).
  useEffect(() => {
    if (typeof window.fetchLatestTaxConfig === "function") {
      window.fetchLatestTaxConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tweaks, setTweak] = useTweaks({
    theme: "warm",
    keepFixedAmounts: false,
    fontSize: 15,
    compact: false,
    startView: "budget",
    budgetPeriodMode: "calendar",
    // "calendar" | "custom"
    budgetPeriodStartDay: 1,
    // 1..28, nur bei "custom"
    backupReminder: false,
    backupIntervalWeeks: 4,
    ocrLang: "deu",
    // Einzelsprache statt "deu+eng" — etwa 2x schnellere OCR
    monthEndReminder: false,
    budgetWarning: false,
    budgetWarnPct: 80,
    clearOnClose: false,
    // ── Steuer-Profil ─────────────────────────────────────────
    steuerklasse: 1,
    // 1..6
    familienstand: "ledig",
    // ledig | verheiratet | geschieden
    bundesland: "default",
    // default | BY | BW
    kirchensteuer: false,
    berufstyp: "arbeitnehmer" // arbeitnehmer | selbststaendig | student_voll | beides | rente
  });

  // Optimizer-Chancen einmal pro relevanter State-Änderung berechnen
  const optimizerCount = useMemo(() => {
    if (typeof findOpportunities !== "function") return 0;
    const profile = typeof buildUserProfile === "function" ? buildUserProfile(interviewAnswers, tweaks) : null;
    if (!profile) return 0;
    const ops = findOpportunities(profile, state.receipts || [], state.investments || {}, new Date().getFullYear());
    if (ops.length === 1 && ops[0]?.__noData) return 0;
    return ops.filter(o => (o.ersparnis || 0) > 0).length;
  }, [tweaks, state.receipts, state.investments, interviewAnswers]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
  }, [tweaks.theme]);
  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", tweaks.fontSize + "px");
  }, [tweaks.fontSize]);
  useEffect(() => {
    document.documentElement.setAttribute("data-density", tweaks.compact ? "compact" : "normal");
  }, [tweaks.compact]);

  // OCR-Sprache an Scanner durchreichen
  useEffect(() => {
    if (typeof window.setOcrLang === "function") {
      window.setOcrLang(tweaks.ocrLang);
    } else {
      window.__ocrLang = tweaks.ocrLang;
    }
  }, [tweaks.ocrLang]);

  // Inkognito: Daten beim Schließen löschen
  useEffect(() => {
    if (!tweaks.clearOnClose) return;
    const handler = () => {
      try {
        localStorage.clear();
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [tweaks.clearOnClose]);

  // Persistenz der Tweaks
  // SICHERHEITSHINWEIS: ausgaben-tweaks enthält nur nicht-sensible Präferenzen
  // (Steuerklasse, Bundesland, Familienstand, Berufstyp, UI-Einstellungen).
  // Sensible Finanzdaten (Brutto, KV-Beiträge, Riester) sind AES-256-GCM-
  // verschlüsselt in ausgaben-interview-answers (crypto.jsx) — nicht hier.
  useEffect(() => {
    try {
      localStorage.setItem("ausgaben-tweaks", JSON.stringify(tweaks));
    } catch {}
  }, [tweaks]);

  // Erst-Start: View aus tweaks.startView setzen (nur einmal, falls noch kein View persistiert)
  useEffect(() => {
    const hasView = !!localStorage.getItem("ausgaben-view-touched");
    if (!hasView && tweaks.startView && state.view !== tweaks.startView) {
      setState(s => ({
        ...s,
        view: tweaks.startView
      }));
      localStorage.setItem("ausgaben-view-touched", "1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backup-Banner: überfällig?
  const backupOverdue = useMemo(() => {
    if (!tweaks.backupReminder) return false;
    const last = localStorage.getItem("ausgaben-last-export");
    const intervalMs = (tweaks.backupIntervalWeeks || 4) * 7 * 24 * 60 * 60 * 1000;
    if (!last) return true; // noch nie exportiert
    const diff = Date.now() - new Date(last).getTime();
    return diff > intervalMs;
  }, [tweaks.backupReminder, tweaks.backupIntervalWeeks]);

  // Budget-Warnung berechnen (variable Kategorien, deren Summe > x% des Budgets)
  const budgetWarnings = useMemo(() => {
    if (!tweaks.budgetWarning) return [];
    const m = state.months[state.currentMonth];
    if (!m) return [];
    const pct = (tweaks.budgetWarnPct || 80) / 100;
    return (m.variable || []).filter(c => (Number(c.budget) || 0) > 0).map(c => {
      const spent = (c.entries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const ratio = spent / (Number(c.budget) || 1);
      return {
        id: c.id,
        label: c.label,
        spent,
        budget: Number(c.budget),
        ratio
      };
    }).filter(c => c.ratio >= pct);
  }, [tweaks.budgetWarning, tweaks.budgetWarnPct, state.months, state.currentMonth]);
  const setView = v => {
    localStorage.setItem("ausgaben-view-touched", "1");
    setState(s => ({
      ...s,
      view: v
    }));
  };
  const reset = () => {
    if (confirm("Wirklich ALLE Daten löschen? Auch alle Monate, Investments und Belege.")) {
      try {
        window.idbClearImages?.();
      } catch {}
      const fresh = defaultState();
      setState(fresh);
    }
  };
  const handleExport = () => {
    exportState(state);
    localStorage.setItem("ausgaben-last-export", new Date().toISOString());
    setBackupBannerDismissed(false);
    sessionStorage.removeItem("ausgaben-backup-dismissed");
  };
  const handleImport = () => {
    importState(
    // FIX #7: stats (imported/skipped) aus importState entgegennehmen und anzeigen
    (newState, stats) => {
      setState(newState);
      setSettingsOpen(false);
      const imgInfo = stats ? ` (${stats.imported} Bild${stats.imported !== 1 ? "er" : ""} importiert` + (stats.skipped > 0 ? `, ${stats.skipped} bereits vorhanden` : "") + ")" : "";
      alert("Import erfolgreich! Alle Daten wurden geladen." + imgInfo);
    }, errMsg => {
      alert("Import fehlgeschlagen: " + errMsg);
    });
  };

  // Feature 3 — Fristen an Service Worker senden
  const sendFristenToSW = React.useCallback(() => {
    if (typeof getSteuerfristenFuerJahr !== "function") return;
    if (!navigator.serviceWorker?.controller) return;
    const year = new Date().getFullYear();
    const fristen = [...getSteuerfristenFuerJahr(year), ...getSteuerfristenFuerJahr(year - 1)].filter(f => {
      const d = new Date(f.datum);
      const diff = (d - new Date()) / (1000 * 60 * 60 * 24);
      return diff >= -1 && diff <= 90;
    });
    navigator.serviceWorker.controller.postMessage({
      type: "schedule-fristen-alerts",
      fristen: fristen.map(f => ({
        id: f.id,
        datum: f.datum,
        label: f.label
      }))
    });
    navigator.serviceWorker.controller.postMessage({
      type: "check-fristen-now"
    });
  }, []);

  // Feature 3 — Fristen-Alerts beim Start synchronisieren
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const t = setTimeout(() => sendFristenToSW(), 1500);
    return () => clearTimeout(t);
  }, [sendFristenToSW]);

  // Feature 3 — Periodic Background Sync (Chrome/Android, best-effort)
  useEffect(() => {
    if (!("periodicSync" in (navigator.serviceWorker || {}))) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.periodicSync?.register("fristen-daily-check", {
        minInterval: 24 * 60 * 60 * 1000
      }).catch(() => {});
    });
  }, []);

  // Beleg übernehmen: in die gewählte (oder neu angelegte) Variable-Kategorie eintragen
  const handleAcceptReceipt = receipt => {
    // AutoKat: Händler→Kategorie-Paar lernen
    if (receipt.haendler && receipt.steuerkat && window.AutoKat) {
      window.AutoKat.learn(receipt.haendler, receipt.steuerkat);
    }
    setState(s => {
      const targetYM = receipt.month || s.currentMonth;
      const withMonth = ensureMonth(s, targetYM);
      const month = withMonth.months[targetYM];
      let variable = month.variable;
      let targetCatId = receipt.categoryId;

      // Falls neue Kategorie: anlegen
      if (!targetCatId && receipt.newCategoryLabel) {
        const newCat = {
          id: uid(),
          label: receipt.newCategoryLabel,
          budget: 0,
          entries: []
        };
        variable = [...variable, newCat];
        targetCatId = newCat.id;
      } else if (!targetCatId) {
        // Fallback: erste vorhandene Kategorie oder "Sonstige Ausgaben" anlegen
        const fallback = variable.find(c => c.label === "Sonstige Ausgaben");
        if (fallback) {
          targetCatId = fallback.id;
        } else {
          const newCat = {
            id: uid(),
            label: "Sonstige Ausgaben",
            budget: 0,
            entries: []
          };
          variable = [...variable, newCat];
          targetCatId = newCat.id;
        }
      } else {
        // Bestehende Kategorie sicherstellen — falls sie inzwischen gelöscht wurde
        if (!variable.find(c => c.id === targetCatId)) {
          const newCat = {
            id: targetCatId,
            label: "Beleg-Einträge",
            budget: 0,
            entries: []
          };
          variable = [...variable, newCat];
        }
      }
      const entry = {
        id: uid(),
        place: receipt.haendler || "Beleg",
        amount: Number(receipt.gesamtbetrag) || 0,
        date: receipt.datum || `${targetYM}-01`,
        receiptId: receipt.id
      };
      variable = variable.map(c => c.id === targetCatId ? {
        ...c,
        entries: [...(c.entries || []), entry]
      } : c);

      // Beleg mit finaler categoryId speichern
      const storedReceipt = {
        ...receipt,
        categoryId: targetCatId
      };
      delete storedReceipt.newCategoryLabel;
      return {
        ...withMonth,
        currentMonth: targetYM,
        months: {
          ...withMonth.months,
          [targetYM]: {
            ...month,
            variable
          }
        },
        receipts: [...(withMonth.receipts || []), storedReceipt]
      };
    });

    // NEU: Feature C — Sofort-Feedback Toast bei steuerrelevanten Belegen
    if (receipt.steuerkat && receipt.steuerkat !== "privat") {
      const STEUER_TIPPS = {
        haushaltsnahe: `§35a: Handwerker/Haushalt → 20 % der Lohnkosten direkt absetzbar. Überweisung nötig!`,
        werbungskosten: `Werbungskosten erfasst → Alle Belege für Anlage N sammeln.`,
        sonderausgaben: `Sonderausgabe erfasst → gut für §10 EStG.`,
        aussergewoehnlich: `Außergewöhnl. Belastung → Belege aufheben, zumutbare Eigenbelastung wird verrechnet.`
      };
      const tipp = STEUER_TIPPS[receipt.steuerkat];
      if (tipp) {
        const toast = document.createElement("div");
        toast.textContent = "💡 " + tipp;
        Object.assign(toast.style, {
          position: "fixed",
          bottom: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface-3, #333)",
          color: "var(--text)",
          padding: "10px 16px",
          borderRadius: "10px",
          fontSize: "12px",
          zIndex: "9999",
          maxWidth: "320px",
          textAlign: "center",
          lineHeight: "1.4",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          animation: "fadeInUp 0.3s ease"
        });
        document.body.appendChild(toast);
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
        }, 5000);
      }
    }
  };

  // Manueller Speichern-Handler
  const handleSave = async () => {
    if (saveStatus === "saving") return;
    if (_saveStatusTimerRef.current) clearTimeout(_saveStatusTimerRef.current);
    setSaveStatus("saving");
    // Debounce-Timer abbrechen — manuelles Speichern ist sofort
    if (_saveTimerRef.current) {
      clearTimeout(_saveTimerRef.current);
      _saveTimerRef.current = null;
    }
    try {
      const ok = await saveState(_stateRef.current);
      setSaveStatus(ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
    _saveStatusTimerRef.current = setTimeout(() => setSaveStatus(null), 2000);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement("header", {
    className: "app-header-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "title-block"
  }, /*#__PURE__*/React.createElement("h1", null, "Ausgaben"), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, state.view === "budget" ? monthLabel(state.currentMonth, {
    mode: tweaks.budgetPeriodMode,
    startDay: tweaks.budgetPeriodStartDay
  }) : state.view === "history" ? "Verlauf" : state.view === "tax" ? "Steuern" : "Portfolio")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, state.view === "budget" && /*#__PURE__*/React.createElement("button", {
    className: "settings-trigger",
    onClick: () => setArchiveOpen(true),
    "aria-label": "Monatsarchiv",
    title: "Monatsarchiv"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  }))), state.view === "tax" && /*#__PURE__*/React.createElement("button", {
    className: `settings-trigger${interviewAnswers.brutto && interviewAnswers.beschaeftigung ? " has-data" : ""}`,
    onClick: () => setInterviewOpen(true),
    "aria-label": "Pers\xF6nliche Daten",
    title: "Pers\xF6nliche Daten",
    style: {
      transition: "all 0.18s"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 20c0-4 3.6-7 8-7s8 3 8 7"
  }))), /*#__PURE__*/React.createElement("button", {
    className: `settings-trigger save-trigger${saveStatus === "saved" ? " saved" : saveStatus === "error" ? " error" : saveStatus === "saving" ? " saving" : ""}`,
    onClick: handleSave,
    "aria-label": "Speichern",
    title: saveStatus === "saved" ? "Gespeichert!" : saveStatus === "error" ? "Fehler beim Speichern" : "Jetzt speichern",
    disabled: saveStatus === "saving"
  }, saveStatus === "saved" ? /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })) : saveStatus === "error" ? /*#__PURE__*/React.createElement("svg", {
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
  })) : /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 21 17 13 7 13 7 21"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 3 7 8 15 8"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "settings-trigger",
    onClick: () => setSettingsOpen(true),
    "aria-label": "Einstellungen",
    title: "Einstellungen"
  }, /*#__PURE__*/React.createElement(Icon.Settings, null)))), storageWarning && /*#__PURE__*/React.createElement("div", {
    className: "backup-banner",
    style: {
      background: "oklch(0.97 0.04 25)",
      borderColor: "oklch(0.85 0.12 25)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "oklch(0.45 0.18 25)",
      flex: 1
    }
  }, "Speicher voll \u2014 Daten konnten nicht gespeichert werden. Exportiere deine Daten und l\xF6sche \xE4ltere Monate."), /*#__PURE__*/React.createElement("button", {
    className: "banner-dismiss",
    onClick: () => setStorageWarning(false),
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null))), backupOverdue && !backupBannerDismissed && /*#__PURE__*/React.createElement("div", {
    className: "backup-banner"
  }, /*#__PURE__*/React.createElement("span", null, "Letztes Backup liegt \xFCber ", tweaks.backupIntervalWeeks, " Wochen zur\xFCck. Jetzt exportieren?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "banner-action",
    onClick: handleExport
  }, "Exportieren"), /*#__PURE__*/React.createElement("button", {
    className: "banner-dismiss",
    onClick: () => {
      setBackupBannerDismissed(true);
      sessionStorage.setItem("ausgaben-backup-dismissed", "1");
    },
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null)))), budgetWarnings.length > 0 && state.view === "budget" && /*#__PURE__*/React.createElement("div", {
    className: "budget-warn-banner"
  }, budgetWarnings.length === 1 ? `Kategorie „${budgetWarnings[0].label}" hat ${Math.round(budgetWarnings[0].ratio * 100)}% des Budgets erreicht.` : `${budgetWarnings.length} Kategorien haben die Warnschwelle (${tweaks.budgetWarnPct}%) überschritten.`), state.view === "budget" && /*#__PURE__*/React.createElement(BudgetView, {
    state: state,
    setState: setState,
    budgetPeriod: {
      mode: tweaks.budgetPeriodMode,
      startDay: tweaks.budgetPeriodStartDay
    },
    onOpenReceipt: r => setSelectedReceiptId(r.id),
    onSwitchToSteuer: () => setView("tax"),
    onOpenBudgetBot: msg => {
      setBudgetBotPendingMsg(msg || null);
      setBudgetBotOpen(true);
    }
  }), state.view === "history" && /*#__PURE__*/React.createElement(HistoryView, {
    state: state,
    onJumpToMonth: ym => {
      setState(s => {
        const next = ensureMonth(s, ym);
        return {
          ...next,
          currentMonth: ym,
          view: "budget"
        };
      });
    }
  }), state.view === "tax" && /*#__PURE__*/React.createElement(TaxView, {
    receipts: state.receipts || [],
    months: state.months,
    currentYear: state.currentMonth.slice(0, 4),
    onOpenReceipt: r => setSelectedReceiptId(r.id),
    investments: state.investments,
    tweaks: tweaks,
    interviewOpen: interviewOpen,
    setInterviewOpen: setInterviewOpen,
    interviewAnswers: interviewAnswers
  }), state.view === "investments" && /*#__PURE__*/React.createElement(InvestmentsView, {
    state: state,
    setState: setState
  }), /*#__PURE__*/React.createElement(SettingsSheet, {
    open: settingsOpen,
    onClose: () => setSettingsOpen(false),
    tweaks: tweaks,
    setTweak: setTweak,
    onExport: handleExport,
    onImport: handleImport,
    onReset: reset,
    state: state,
    onFristenSync: sendFristenToSW
  }), typeof MonatsArchiv !== "undefined" && /*#__PURE__*/React.createElement(MonatsArchiv, {
    open: archiveOpen,
    state: state,
    onClose: () => setArchiveOpen(false),
    onSwitchToMonth: ym => {
      setState(s => {
        const next = ensureMonth(s, ym);
        return {
          ...next,
          currentMonth: ym,
          view: "budget"
        };
      });
      setArchiveOpen(false);
    }
  }), (state.view === "budget" || state.view === "tax") && /*#__PURE__*/React.createElement("button", {
    className: "scanner-fab",
    onClick: () => setScannerOpen(true),
    "aria-label": "Beleg scannen",
    title: "Beleg scannen"
  }, /*#__PURE__*/React.createElement(Icon.Camera, null)), state.view === "budget" && typeof BudgetBotModal !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "bot-fab",
    onClick: () => setBudgetBotOpen(true),
    "aria-label": "BudgetBot \xF6ffnen",
    title: "BudgetBot \u2014 Finanzcoach"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  }))), typeof BudgetBotModal !== "undefined" && /*#__PURE__*/React.createElement(BudgetBotModal, {
    open: budgetBotOpen,
    onClose: () => {
      setBudgetBotOpen(false);
      setBudgetBotPendingMsg(null);
    },
    state: state,
    setState: setState,
    pendingMessage: budgetBotPendingMsg,
    onPendingMessageSent: () => setBudgetBotPendingMsg(null)
  }), state.view === "tax" && typeof SteuerBotModal !== "undefined" && /*#__PURE__*/React.createElement("button", {
    className: "bot-fab",
    onClick: () => setBotOpen(true),
    "aria-label": "SteuerBot \xF6ffnen",
    title: "SteuerBot \u2014 Fragen zur Steuer"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
  }))), typeof SteuerBotModal !== "undefined" && /*#__PURE__*/React.createElement(SteuerBotModal, {
    open: botOpen,
    onClose: () => setBotOpen(false),
    tweaks: tweaks,
    state: state,
    investments: state.investments || {},
    interviewAnswers: interviewAnswers
  }), state.view === "tax" && typeof OptimizerFAB !== "undefined" && /*#__PURE__*/React.createElement(OptimizerFAB, {
    count: optimizerCount,
    onClick: () => setOptimizerOpen(true)
  }), typeof TaxOptimizer !== "undefined" && /*#__PURE__*/React.createElement(TaxOptimizer, {
    open: optimizerOpen,
    onClose: () => setOptimizerOpen(false),
    tweaks: tweaks,
    receipts: state.receipts || [],
    investments: state.investments || {},
    interviewAnswers: interviewAnswers,
    year: new Date().getFullYear()
  }), /*#__PURE__*/React.createElement(ReceiptScanner, {
    open: scannerOpen,
    onClose: () => setScannerOpen(false),
    currentMonth: state.currentMonth,
    categories: (state.months[state.currentMonth]?.variable || []).map(c => ({
      id: c.id,
      label: c.label
    })),
    onAccept: handleAcceptReceipt,
    receipts: state.receipts || []
  }), /*#__PURE__*/React.createElement(ReceiptDetailOverlay, {
    receipt: (state.receipts || []).find(r => r.id === selectedReceiptId) || null,
    categoryLabel: (() => {
      const r = (state.receipts || []).find(x => x.id === selectedReceiptId);
      if (!r) return "";
      const month = state.months[r.month];
      return month?.variable.find(c => c.id === r.categoryId)?.label || "—";
    })(),
    onClose: () => setSelectedReceiptId(null),
    onDelete: () => {
      const id = selectedReceiptId;
      if (!id) return;
      if (!confirm("Beleg wirklich löschen?")) return;
      try {
        window.idbDeleteImage(id);
      } catch {}
      setState(s => {
        const receipt = (s.receipts || []).find(r => r.id === id);
        const next = {
          ...s,
          receipts: (s.receipts || []).filter(r => r.id !== id)
        };
        if (receipt && receipt.month && next.months[receipt.month]) {
          const m = next.months[receipt.month];
          next.months = {
            ...next.months,
            [receipt.month]: {
              ...m,
              variable: m.variable.map(c => ({
                ...c,
                entries: (c.entries || []).filter(e => e.receiptId !== id)
              }))
            }
          };
        }
        return next;
      });
      setSelectedReceiptId(null);
    }
  }), /*#__PURE__*/React.createElement(BottomTabBar, {
    value: state.view,
    onChange: setView
  }), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    title: "Erscheinungsbild"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Theme",
    value: tweaks.theme,
    options: [{
      value: "warm",
      label: "Warm"
    }, {
      value: "cool",
      label: "Cool"
    }, {
      value: "dark",
      label: "Dark"
    }],
    onChange: v => setTweak("theme", v)
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Schriftgr\xF6\xDFe",
    value: tweaks.fontSize,
    options: [{
      value: 13,
      label: "Klein"
    }, {
      value: 15,
      label: "Normal"
    }, {
      value: 17,
      label: "Groß"
    }],
    onChange: v => setTweak("fontSize", v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Kompakt-Modus",
    value: tweaks.compact,
    onChange: v => setTweak("compact", v)
  })), /*#__PURE__*/React.createElement(TweakSection, {
    title: "Budget"
  }, /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Fixkosten-Betr\xE4ge \xFCbernehmen",
    value: tweaks.keepFixedAmounts,
    onChange: v => setTweak("keepFixedAmounts", v)
  })), /*#__PURE__*/React.createElement(TweakSection, {
    title: "Daten"
  }, /*#__PURE__*/React.createElement(TweakButton, {
    label: "Exportieren (JSON)",
    onClick: handleExport
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Importieren (JSON)",
    onClick: handleImport,
    secondary: true
  }), /*#__PURE__*/React.createElement(TweakButton, {
    label: "Alle Daten zur\xFCcksetzen",
    onClick: reset,
    secondary: true
  }))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(PinGate, null, /*#__PURE__*/React.createElement(App, null)));
