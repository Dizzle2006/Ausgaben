/* global React, fmtEUR, fmtEURsigned, fmtDate, todayISO, uid, AmountInput, SignedAmountInput, StockIcon, Icon */

// ============ Portfolio Chart ============
function PortfolioChart({
  purchases,
  trades
}) {
  // Build a timeseries: x = date, y = cumulative invested capital + cumulative realized P&L
  const events = React.useMemo(() => {
    const evts = [];
    purchases.forEach(p => {
      if (p.date) evts.push({
        date: p.date,
        invested: Number(p.wert) || 0,
        realized: 0
      });
    });
    trades.forEach(t => {
      if (t.date) evts.push({
        date: t.date,
        invested: 0,
        realized: Number(t.amount) || 0
      });
    });
    evts.sort((a, b) => a.date.localeCompare(b.date));
    let invested = 0,
      realized = 0;
    return evts.map(e => {
      invested += e.invested;
      realized += e.realized;
      return {
        date: e.date,
        invested,
        realized,
        total: invested + realized
      };
    });
  }, [purchases, trades]);
  const W = 800,
    H = 240,
    padL = 56,
    padR = 16,
    padT = 18,
    padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // FIX #8: leer → null; ein Eintrag → kompakte Karte ohne degenerierten SVG-Pfad
  if (!events || events.length === 0) return null;
  if (events.length === 1) {
    return /*#__PURE__*/React.createElement("div", {
      className: "chart-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart-head"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "chart-title"
    }, "Portfolio Verlauf"), /*#__PURE__*/React.createElement("div", {
      className: "chart-sub"
    }, "K\xE4ufe und realisierte Bilanz \xFCber Zeit")), /*#__PURE__*/React.createElement("div", {
      className: "chart-latest"
    }, /*#__PURE__*/React.createElement("div", {
      className: "label"
    }, "Aktuell"), /*#__PURE__*/React.createElement("div", {
      className: "value"
    }, fmtEUR(events[0].total)))), /*#__PURE__*/React.createElement("div", {
      className: "chart-empty"
    }, "Weiterer Eintrag n\xF6tig, um den Verlauf zu zeichnen"));
  }
  const allValues = events.flatMap(e => [e.total, e.invested]);
  const minY = Math.min(0, ...allValues);
  const maxY = Math.max(...allValues, minY + 100);
  const rangeY = maxY - minY || 1;
  const minDate = new Date(events[0].date).getTime();
  const maxDate = new Date(events[events.length - 1].date).getTime();
  const rangeX = Math.max(1, maxDate - minDate);
  const xFor = d => {
    if (events.length === 1) return padL + innerW / 2;
    const t = new Date(d).getTime();
    return padL + (t - minDate) / rangeX * innerW;
  };
  const yFor = v => padT + innerH - (v - minY) / rangeY * innerH;

  // Build smooth path
  const linePath = key => {
    return events.map((e, i) => `${i === 0 ? "M" : "L"} ${xFor(e.date).toFixed(1)} ${yFor(e[key]).toFixed(1)}`).join(" ");
  };
  const areaPath = key => {
    const top = events.map((e, i) => `${i === 0 ? "M" : "L"} ${xFor(e.date).toFixed(1)} ${yFor(e[key]).toFixed(1)}`).join(" ");
    const last = xFor(events[events.length - 1].date).toFixed(1);
    const first = xFor(events[0].date).toFixed(1);
    const baseY = yFor(Math.max(0, minY)).toFixed(1);
    return `${top} L ${last} ${baseY} L ${first} ${baseY} Z`;
  };

  // Y-axis gridlines (4 ticks)
  const ticks = [];
  const ny = 4;
  for (let i = 0; i <= ny; i++) {
    const val = minY + rangeY * i / ny;
    ticks.push({
      val,
      y: yFor(val)
    });
  }
  const latest = events[events.length - 1];
  const trend = events.length > 1 ? events[events.length - 1].total - events[0].total : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "chart-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chart-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "chart-title"
  }, "Portfolio Verlauf"), /*#__PURE__*/React.createElement("div", {
    className: "chart-sub"
  }, "Eingesetztes Kapital + realisierte Bilanz")), /*#__PURE__*/React.createElement("div", {
    className: "chart-latest"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, "Aktuell"), /*#__PURE__*/React.createElement("div", {
    className: "value"
  }, fmtEUR(latest.total)), events.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: `chip ${trend >= 0 ? "positive" : "negative"}`
  }, trend >= 0 ? /*#__PURE__*/React.createElement(Icon.TrendUp, null) : /*#__PURE__*/React.createElement(Icon.TrendDown, null), /*#__PURE__*/React.createElement("span", null, fmtEURsigned(trend))))), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "chart-svg",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "portfolio-area",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "var(--accent)",
    stopOpacity: "0.28"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "var(--accent)",
    stopOpacity: "0"
  }))), ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
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
  }, Math.abs(t.val) >= 1000 ? `${(t.val / 1000).toFixed(1)}k` : t.val.toFixed(0)))), events.length > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("text", {
    x: padL,
    y: H - 10,
    fontSize: "10",
    fill: "var(--text-faint)",
    fontFamily: "var(--font-num)"
  }, fmtDate(events[0].date)), /*#__PURE__*/React.createElement("text", {
    x: W - padR,
    y: H - 10,
    textAnchor: "end",
    fontSize: "10",
    fill: "var(--text-faint)",
    fontFamily: "var(--font-num)"
  }, fmtDate(events[events.length - 1].date))), /*#__PURE__*/React.createElement("path", {
    d: linePath("invested"),
    fill: "none",
    stroke: "var(--text-faint)",
    strokeWidth: "1.5",
    strokeDasharray: "4 4",
    opacity: "0.7"
  }), /*#__PURE__*/React.createElement("path", {
    d: areaPath("total"),
    fill: "url(#portfolio-area)"
  }), /*#__PURE__*/React.createElement("path", {
    d: linePath("total"),
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2.5",
    strokeLinejoin: "round"
  }), events.map((e, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: xFor(e.date),
    cy: yFor(e.total),
    r: "3",
    fill: "var(--surface)",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "chart-legend"
  }, /*#__PURE__*/React.createElement("div", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "swatch line",
    style: {
      background: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement("span", null, "Portfolio gesamt")), /*#__PURE__*/React.createElement("div", {
    className: "legend-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "swatch dashed"
  }), /*#__PURE__*/React.createElement("span", null, "Eingesetztes Kapital"))));
}

// ============ Purchase Row ============
function PurchaseRow({
  item,
  onUpdate,
  onDelete
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "invest-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "invest-name-cell"
  }, /*#__PURE__*/React.createElement(StockIcon, {
    name: item.name,
    size: 28
  }), /*#__PURE__*/React.createElement("input", {
    className: "invest-field name",
    placeholder: "Wertpapier",
    value: item.name,
    onChange: e => onUpdate({
      ...item,
      name: e.target.value
    })
  })), /*#__PURE__*/React.createElement("input", {
    className: "invest-field wkn",
    placeholder: "WKN / ISIN",
    value: item.wkn,
    onChange: e => onUpdate({
      ...item,
      wkn: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    className: "invest-field kurs",
    placeholder: "Kurs",
    type: "text",
    inputMode: "decimal",
    value: item.kurs,
    onChange: e => onUpdate({
      ...item,
      kurs: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "invest-field date",
    value: item.date || "",
    onChange: e => onUpdate({
      ...item,
      date: e.target.value
    })
  }), /*#__PURE__*/React.createElement(AmountInput, {
    value: item.wert,
    onChange: v => onUpdate({
      ...item,
      wert: v
    }),
    className: "invest-amount"
  }), /*#__PURE__*/React.createElement("button", {
    className: "entry-delete",
    onClick: onDelete,
    title: "L\xF6schen",
    "aria-label": "L\xF6schen"
  }, /*#__PURE__*/React.createElement(Icon.Trash, null)));
}

// ============ Trade Row (Gewinn / Verlust) ============
function TradeRow({
  item,
  onUpdate,
  onDelete
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "invest-row trade"
  }, /*#__PURE__*/React.createElement("div", {
    className: "invest-name-cell"
  }, /*#__PURE__*/React.createElement(StockIcon, {
    name: item.name,
    size: 28
  }), /*#__PURE__*/React.createElement("input", {
    className: "invest-field name",
    placeholder: "Wertpapier",
    value: item.name,
    onChange: e => onUpdate({
      ...item,
      name: e.target.value
    })
  })), /*#__PURE__*/React.createElement("input", {
    className: "invest-field kurs",
    placeholder: "Kurs",
    type: "text",
    inputMode: "decimal",
    value: item.kurs,
    onChange: e => onUpdate({
      ...item,
      kurs: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "invest-field date",
    value: item.date || "",
    onChange: e => onUpdate({
      ...item,
      date: e.target.value
    })
  }), /*#__PURE__*/React.createElement(SignedAmountInput, {
    value: item.amount,
    onChange: v => onUpdate({
      ...item,
      amount: v
    }),
    className: "invest-amount"
  }), /*#__PURE__*/React.createElement("button", {
    className: "entry-delete",
    onClick: onDelete,
    title: "L\xF6schen",
    "aria-label": "L\xF6schen"
  }, /*#__PURE__*/React.createElement(Icon.Trash, null)));
}

// ============ Open Positions (grouped by Wertpapier) ============
function OpenPositions({
  purchases,
  trades
}) {
  const positions = React.useMemo(() => {
    const map = new Map();
    purchases.forEach(p => {
      const key = (p.name || "").trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key) || {
        name: p.name.trim(),
        wkn: p.wkn || "",
        count: 0,
        invested: 0,
        realized: 0,
        lastDate: ""
      };
      existing.invested += Number(p.wert) || 0;
      existing.count += 1;
      if (!existing.wkn && p.wkn) existing.wkn = p.wkn;
      if ((p.date || "") > existing.lastDate) existing.lastDate = p.date || "";
      map.set(key, existing);
    });
    trades.forEach(t => {
      const key = (t.name || "").trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.realized += Number(t.amount) || 0;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.invested - a.invested);
  }, [purchases, trades]);
  const totalInvested = positions.reduce((s, p) => s + p.invested, 0);
  const totalRealized = positions.reduce((s, p) => s + p.realized, 0);
  if (positions.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "section invest-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 320)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Offene Positionen")), /*#__PURE__*/React.createElement("div", {
    className: "section-total"
  }, fmtEUR(totalInvested + totalRealized))), /*#__PURE__*/React.createElement("div", {
    className: "positions-head"
  }, /*#__PURE__*/React.createElement("div", null, "Wertpapier"), /*#__PURE__*/React.createElement("div", null, "K\xE4ufe"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Eingesetzt"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Realisiert"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Bilanz")), positions.map(pos => {
    const balance = pos.invested + pos.realized;
    const pct = pos.invested > 0 ? pos.realized / pos.invested * 100 : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: pos.name,
      className: "position-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "invest-name-cell"
    }, /*#__PURE__*/React.createElement(StockIcon, {
      name: pos.name,
      size: 32
    }), /*#__PURE__*/React.createElement("div", {
      className: "position-name-block"
    }, /*#__PURE__*/React.createElement("div", {
      className: "position-name"
    }, pos.name), pos.wkn && /*#__PURE__*/React.createElement("div", {
      className: "position-wkn"
    }, pos.wkn))), /*#__PURE__*/React.createElement("div", {
      className: "position-meta"
    }, pos.count, " ", pos.count === 1 ? "Kauf" : "Käufe", pos.lastDate && /*#__PURE__*/React.createElement("div", {
      className: "position-date"
    }, "letzter ", fmtDate(pos.lastDate))), /*#__PURE__*/React.createElement("div", {
      className: "position-invested"
    }, fmtEUR(pos.invested)), /*#__PURE__*/React.createElement("div", {
      className: "position-realized",
      style: {
        color: pos.realized > 0 ? "var(--accent)" : pos.realized < 0 ? "var(--danger)" : "var(--text-faint)"
      }
    }, pos.realized === 0 ? "—" : fmtEURsigned(pos.realized), pos.realized !== 0 && pos.invested > 0 && /*#__PURE__*/React.createElement("div", {
      className: "position-pct"
    }, pct >= 0 ? "+" : "", pct.toFixed(1), "%")), /*#__PURE__*/React.createElement("div", {
      className: "position-balance",
      style: {
        color: balance >= 0 ? "var(--text)" : "var(--danger)"
      }
    }, fmtEUR(balance)));
  }));
}

// ============ Investments Page ============
function InvestmentsPage({
  investments,
  onUpdate
}) {
  const {
    purchases = [],
    trades = []
  } = investments;
  const invested = purchases.reduce((s, p) => s + (Number(p.wert) || 0), 0);
  const realizedTotal = trades.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const gains = trades.filter(t => (Number(t.amount) || 0) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const losses = trades.filter(t => (Number(t.amount) || 0) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const setPurchases = next => onUpdate({
    ...investments,
    purchases: next
  });
  const setTrades = next => onUpdate({
    ...investments,
    trades: next
  });
  const addPurchase = () => {
    setPurchases([...purchases, {
      id: uid(),
      name: "",
      wkn: "",
      kurs: "",
      wert: 0,
      date: todayISO()
    }]);
  };
  const addTrade = () => {
    setTrades([...trades, {
      id: uid(),
      name: "",
      kurs: "",
      amount: 0,
      date: todayISO()
    }]);
  };
  const updatePurchase = (id, item) => setPurchases(purchases.map(p => p.id === id ? item : p));
  const updateTrade = (id, item) => setTrades(trades.map(t => t.id === id ? item : t));
  const deletePurchase = id => setPurchases(purchases.filter(p => p.id !== id));
  const deleteTrade = id => setTrades(trades.filter(t => t.id !== id));

  // Sort: most recent first
  const sortedPurchases = [...purchases].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedTrades = [...trades].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "stats-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Eingesetztes Kapital"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value"
  }, fmtEUR(invested)), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, purchases.length, " ", purchases.length === 1 ? "Position" : "Positionen")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Realisierte Bilanz"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value",
    style: {
      color: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)"
    }
  }, fmtEURsigned(realizedTotal)), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, trades.length, " ", trades.length === 1 ? "Trade" : "Trades")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Gewinne"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value",
    style: {
      color: "var(--accent)"
    }
  }, fmtEURsigned(gains)), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, trades.filter(t => (Number(t.amount) || 0) > 0).length, " Gewinn-Trades")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-label"
  }, "Verluste"), /*#__PURE__*/React.createElement("div", {
    className: "stat-value",
    style: {
      color: "var(--danger)"
    }
  }, fmtEURsigned(losses)), /*#__PURE__*/React.createElement("div", {
    className: "stat-sub"
  }, trades.filter(t => (Number(t.amount) || 0) < 0).length, " Verlust-Trades"))), /*#__PURE__*/React.createElement(PortfolioChart, {
    purchases: purchases,
    trades: trades
  }), /*#__PURE__*/React.createElement(OpenPositions, {
    purchases: purchases,
    trades: trades
  }), /*#__PURE__*/React.createElement("div", {
    className: "section invest-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: "oklch(0.65 0.13 240)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Neue Investments")), /*#__PURE__*/React.createElement("div", {
    className: "section-total"
  }, fmtEUR(invested))), /*#__PURE__*/React.createElement("div", {
    className: "invest-head"
  }, /*#__PURE__*/React.createElement("div", null, "Wertpapier"), /*#__PURE__*/React.createElement("div", null, "WKN / ISIN"), /*#__PURE__*/React.createElement("div", null, "Kurs"), /*#__PURE__*/React.createElement("div", null, "Datum"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Wert"), /*#__PURE__*/React.createElement("div", null)), sortedPurchases.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "entries-empty"
  }, "Noch keine K\xE4ufe. Klicke unten, um den ersten Kauf einzutragen.") : sortedPurchases.map(p => /*#__PURE__*/React.createElement(PurchaseRow, {
    key: p.id,
    item: p,
    onUpdate: item => updatePurchase(p.id, item),
    onDelete: () => deletePurchase(p.id)
  })), /*#__PURE__*/React.createElement("button", {
    className: "add-row",
    onClick: addPurchase
  }, /*#__PURE__*/React.createElement("span", {
    className: "plus"
  }, "+"), /*#__PURE__*/React.createElement("span", null, "Kauf hinzuf\xFCgen"))), /*#__PURE__*/React.createElement("div", {
    className: "section invest-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-title"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-dot",
    style: {
      background: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)"
    }
  }), /*#__PURE__*/React.createElement("h2", null, "Gewinne / Verluste")), /*#__PURE__*/React.createElement("div", {
    className: "section-total",
    style: {
      color: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)"
    }
  }, fmtEURsigned(realizedTotal))), /*#__PURE__*/React.createElement("div", {
    className: "invest-head trade"
  }, /*#__PURE__*/React.createElement("div", null, "Wertpapier"), /*#__PURE__*/React.createElement("div", null, "Verkaufskurs"), /*#__PURE__*/React.createElement("div", null, "Datum"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Rendite / Verlust"), /*#__PURE__*/React.createElement("div", null)), sortedTrades.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "entries-empty"
  }, "Noch keine Verk\xE4ufe. Trage hier ein, was du mit Gewinn (+) oder Verlust (\u2212) verkauft hast.") : sortedTrades.map(t => /*#__PURE__*/React.createElement(TradeRow, {
    key: t.id,
    item: t,
    onUpdate: item => updateTrade(t.id, item),
    onDelete: () => deleteTrade(t.id)
  })), /*#__PURE__*/React.createElement("button", {
    className: "add-row",
    onClick: addTrade
  }, /*#__PURE__*/React.createElement("span", {
    className: "plus"
  }, "+"), /*#__PURE__*/React.createElement("span", null, "Trade hinzuf\xFCgen"))));
}
(function _secureExport() {
  const _defs = {
    InvestmentsPage,
    PortfolioChart
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
