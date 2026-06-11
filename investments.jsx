/* global React, fmtEUR, fmtEURsigned, fmtDate, todayISO, uid, AmountInput, SignedAmountInput, StockIcon, Icon */

// ============ Portfolio Chart ============
function PortfolioChart({ purchases, trades }) {
  // Build a timeseries: x = date, y = cumulative invested capital + cumulative realized P&L
  const events = React.useMemo(() => {
    const evts = [];
    purchases.forEach((p) => {
      if (p.date) evts.push({ date: p.date, invested: Number(p.wert) || 0, realized: 0 });
    });
    trades.forEach((t) => {
      if (t.date) evts.push({ date: t.date, invested: 0, realized: Number(t.amount) || 0 });
    });
    evts.sort((a, b) => a.date.localeCompare(b.date));
    let invested = 0, realized = 0;
    return evts.map((e) => {
      invested += e.invested;
      realized += e.realized;
      return { date: e.date, invested, realized, total: invested + realized };
    });
  }, [purchases, trades]);

  const W = 800, H = 240, padL = 56, padR = 16, padT = 18, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // FIX #8: leer → null; ein Eintrag → kompakte Karte ohne degenerierten SVG-Pfad
  if (!events || events.length === 0) return null;

  if (events.length === 1) {
    return (
      <div className="chart-card">
        <div className="chart-head">
          <div>
            <div className="chart-title">Portfolio Verlauf</div>
            <div className="chart-sub">Käufe und realisierte Bilanz über Zeit</div>
          </div>
          <div className="chart-latest">
            <div className="label">Aktuell</div>
            <div className="value">{fmtEUR(events[0].total)}</div>
          </div>
        </div>
        <div className="chart-empty">
          Weiterer Eintrag nötig, um den Verlauf zu zeichnen
        </div>
      </div>
    );
  }

  const allValues = events.flatMap((e) => [e.total, e.invested]);
  const minY = Math.min(0, ...allValues);
  const maxY = Math.max(...allValues, minY + 100);
  const rangeY = maxY - minY || 1;

  const minDate = new Date(events[0].date).getTime();
  const maxDate = new Date(events[events.length - 1].date).getTime();
  const rangeX = Math.max(1, maxDate - minDate);

  const xFor = (d) => {
    if (events.length === 1) return padL + innerW / 2;
    const t = new Date(d).getTime();
    return padL + ((t - minDate) / rangeX) * innerW;
  };
  const yFor = (v) => padT + innerH - ((v - minY) / rangeY) * innerH;

  // Build smooth path
  const linePath = (key) => {
    return events.map((e, i) => `${i === 0 ? "M" : "L"} ${xFor(e.date).toFixed(1)} ${yFor(e[key]).toFixed(1)}`).join(" ");
  };
  const areaPath = (key) => {
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
    const val = minY + (rangeY * i) / ny;
    ticks.push({ val, y: yFor(val) });
  }

  const latest = events[events.length - 1];
  const trend = events.length > 1 ? events[events.length - 1].total - events[0].total : 0;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">Portfolio Verlauf</div>
          <div className="chart-sub">Eingesetztes Kapital + realisierte Bilanz</div>
        </div>
        <div className="chart-latest">
          <div className="label">Aktuell</div>
          <div className="value">{fmtEUR(latest.total)}</div>
          {events.length > 1 && (
            <div className={`chip ${trend >= 0 ? "positive" : "negative"}`}>
              {trend >= 0 ? <Icon.TrendUp /> : <Icon.TrendDown />}
              <span>{fmtEURsigned(trend)}</span>
            </div>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="portfolio-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? "none" : "2 4"} />
            <text x={padL - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-num)">
              {Math.abs(t.val) >= 1000 ? `${(t.val / 1000).toFixed(1)}k` : t.val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {events.length > 1 && (
          <React.Fragment>
            <text x={padL} y={H - 10} fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-num)">
              {fmtDate(events[0].date)}
            </text>
            <text x={W - padR} y={H - 10} textAnchor="end" fontSize="10" fill="var(--text-faint)" fontFamily="var(--font-num)">
              {fmtDate(events[events.length - 1].date)}
            </text>
          </React.Fragment>
        )}

        {/* Invested line (dashed) */}
        <path d={linePath("invested")} fill="none" stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />

        {/* Total area + line */}
        <path d={areaPath("total")} fill="url(#portfolio-area)" />
        <path d={linePath("total")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Points */}
        {events.map((e, i) => (
          <circle key={i} cx={xFor(e.date)} cy={yFor(e.total)} r="3" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        ))}
      </svg>

      <div className="chart-legend">
        <div className="legend-item">
          <span className="swatch line" style={{ background: "var(--accent)" }}></span>
          <span>Portfolio gesamt</span>
        </div>
        <div className="legend-item">
          <span className="swatch dashed"></span>
          <span>Eingesetztes Kapital</span>
        </div>
      </div>
    </div>
  );
}

// ============ Purchase Row ============
function PurchaseRow({ item, onUpdate, onDelete }) {
  return (
    <div className="invest-row">
      <div className="invest-name-cell">
        <StockIcon name={item.name} size={28} />
        <input
          className="invest-field name"
          placeholder="Wertpapier"
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
        />
      </div>
      <input
        className="invest-field wkn"
        placeholder="WKN / ISIN"
        value={item.wkn}
        onChange={(e) => onUpdate({ ...item, wkn: e.target.value })}
      />
      <input
        className="invest-field kurs"
        placeholder="Kurs"
        type="text"
        inputMode="decimal"
        value={item.kurs}
        onChange={(e) => onUpdate({ ...item, kurs: e.target.value })}
      />
      <input
        type="date"
        className="invest-field date"
        value={item.date || ""}
        onChange={(e) => onUpdate({ ...item, date: e.target.value })}
      />
      <AmountInput
        value={item.wert}
        onChange={(v) => onUpdate({ ...item, wert: v })}
        className="invest-amount"
      />
      <button className="entry-delete" onClick={onDelete} title="Löschen" aria-label="Löschen">
        <Icon.Trash />
      </button>
    </div>
  );
}

// ============ Trade Row (Gewinn / Verlust) ============
function TradeRow({ item, onUpdate, onDelete }) {
  return (
    <div className="invest-row trade">
      <div className="invest-name-cell">
        <StockIcon name={item.name} size={28} />
        <input
          className="invest-field name"
          placeholder="Wertpapier"
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
        />
      </div>
      <input
        className="invest-field kurs"
        placeholder="Kurs"
        type="text"
        inputMode="decimal"
        value={item.kurs}
        onChange={(e) => onUpdate({ ...item, kurs: e.target.value })}
      />
      <input
        type="date"
        className="invest-field date"
        value={item.date || ""}
        onChange={(e) => onUpdate({ ...item, date: e.target.value })}
      />
      <SignedAmountInput
        value={item.amount}
        onChange={(v) => onUpdate({ ...item, amount: v })}
        className="invest-amount"
      />
      <button className="entry-delete" onClick={onDelete} title="Löschen" aria-label="Löschen">
        <Icon.Trash />
      </button>
    </div>
  );
}

// ============ Open Positions (grouped by Wertpapier) ============
function OpenPositions({ purchases, trades }) {
  const positions = React.useMemo(() => {
    const map = new Map();
    purchases.forEach((p) => {
      const key = (p.name || "").trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key) || {
        name: p.name.trim(),
        wkn: p.wkn || "",
        count: 0,
        invested: 0,
        realized: 0,
        lastDate: "",
      };
      existing.invested += Number(p.wert) || 0;
      existing.count += 1;
      if (!existing.wkn && p.wkn) existing.wkn = p.wkn;
      if ((p.date || "") > existing.lastDate) existing.lastDate = p.date || "";
      map.set(key, existing);
    });
    trades.forEach((t) => {
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

  return (
    <div className="section invest-section">
      <div className="section-header">
        <div className="section-title">
          <div className="section-dot" style={{ background: "oklch(0.65 0.13 320)" }}></div>
          <h2>Offene Positionen</h2>
        </div>
        <div className="section-total">{fmtEUR(totalInvested + totalRealized)}</div>
      </div>

      <div className="positions-head">
        <div>Wertpapier</div>
        <div>Käufe</div>
        <div style={{ textAlign: "right" }}>Eingesetzt</div>
        <div style={{ textAlign: "right" }}>Realisiert</div>
        <div style={{ textAlign: "right" }}>Bilanz</div>
      </div>

      {positions.map((pos) => {
        const balance = pos.invested + pos.realized;
        const pct = pos.invested > 0 ? (pos.realized / pos.invested) * 100 : 0;
        return (
          <div key={pos.name} className="position-row">
            <div className="invest-name-cell">
              <StockIcon name={pos.name} size={32} />
              <div className="position-name-block">
                <div className="position-name">{pos.name}</div>
                {pos.wkn && <div className="position-wkn">{pos.wkn}</div>}
              </div>
            </div>
            <div className="position-meta">
              {pos.count} {pos.count === 1 ? "Kauf" : "Käufe"}
              {pos.lastDate && <div className="position-date">letzter {fmtDate(pos.lastDate)}</div>}
            </div>
            <div className="position-invested">{fmtEUR(pos.invested)}</div>
            <div className="position-realized" style={{ color: pos.realized > 0 ? "var(--accent)" : pos.realized < 0 ? "var(--danger)" : "var(--text-faint)" }}>
              {pos.realized === 0 ? "—" : fmtEURsigned(pos.realized)}
              {pos.realized !== 0 && pos.invested > 0 && (
                <div className="position-pct">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</div>
              )}
            </div>
            <div className="position-balance" style={{ color: balance >= 0 ? "var(--text)" : "var(--danger)" }}>
              {fmtEUR(balance)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ Investments Page ============
function InvestmentsPage({ investments, onUpdate }) {
  const { purchases = [], trades = [] } = investments;

  const invested = purchases.reduce((s, p) => s + (Number(p.wert) || 0), 0);
  const realizedTotal = trades.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const gains = trades.filter((t) => (Number(t.amount) || 0) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const losses = trades.filter((t) => (Number(t.amount) || 0) < 0).reduce((s, t) => s + Number(t.amount), 0);

  const setPurchases = (next) => onUpdate({ ...investments, purchases: next });
  const setTrades = (next) => onUpdate({ ...investments, trades: next });

  const addPurchase = () => {
    setPurchases([...purchases, { id: uid(), name: "", wkn: "", kurs: "", wert: 0, date: todayISO() }]);
  };
  const addTrade = () => {
    setTrades([...trades, { id: uid(), name: "", kurs: "", amount: 0, date: todayISO() }]);
  };

  const updatePurchase = (id, item) => setPurchases(purchases.map((p) => p.id === id ? item : p));
  const updateTrade = (id, item) => setTrades(trades.map((t) => t.id === id ? item : t));
  const deletePurchase = (id) => setPurchases(purchases.filter((p) => p.id !== id));
  const deleteTrade = (id) => setTrades(trades.filter((t) => t.id !== id));

  // Sort: most recent first
  const sortedPurchases = [...purchases].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const sortedTrades = [...trades].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <React.Fragment>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-label">Eingesetztes Kapital</div>
          <div className="stat-value">{fmtEUR(invested)}</div>
          <div className="stat-sub">{purchases.length} {purchases.length === 1 ? "Position" : "Positionen"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Realisierte Bilanz</div>
          <div className="stat-value" style={{ color: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)" }}>
            {fmtEURsigned(realizedTotal)}
          </div>
          <div className="stat-sub">{trades.length} {trades.length === 1 ? "Trade" : "Trades"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Gewinne</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{fmtEURsigned(gains)}</div>
          <div className="stat-sub">{trades.filter(t => (Number(t.amount) || 0) > 0).length} Gewinn-Trades</div>
        </div>
        <div className="stat">
          <div className="stat-label">Verluste</div>
          <div className="stat-value" style={{ color: "var(--danger)" }}>{fmtEURsigned(losses)}</div>
          <div className="stat-sub">{trades.filter(t => (Number(t.amount) || 0) < 0).length} Verlust-Trades</div>
        </div>
      </div>

      {/* Chart */}
      <PortfolioChart purchases={purchases} trades={trades} />

      {/* Offene Positionen */}
      <OpenPositions purchases={purchases} trades={trades} />

      {/* New Investments */}
      <div className="section invest-section">
        <div className="section-header">
          <div className="section-title">
            <div className="section-dot" style={{ background: "oklch(0.65 0.13 240)" }}></div>
            <h2>Neue Investments</h2>
          </div>
          <div className="section-total">{fmtEUR(invested)}</div>
        </div>

        <div className="invest-head">
          <div>Wertpapier</div>
          <div>WKN / ISIN</div>
          <div>Kurs</div>
          <div>Datum</div>
          <div style={{ textAlign: "right" }}>Wert</div>
          <div></div>
        </div>

        {sortedPurchases.length === 0 ? (
          <div className="entries-empty">Noch keine Käufe. Klicke unten, um den ersten Kauf einzutragen.</div>
        ) : (
          sortedPurchases.map((p) => (
            <PurchaseRow
              key={p.id}
              item={p}
              onUpdate={(item) => updatePurchase(p.id, item)}
              onDelete={() => deletePurchase(p.id)}
            />
          ))
        )}

        <button className="add-row" onClick={addPurchase}>
          <span className="plus">+</span>
          <span>Kauf hinzufügen</span>
        </button>
      </div>

      {/* Gains / Losses */}
      <div className="section invest-section">
        <div className="section-header">
          <div className="section-title">
            <div className="section-dot" style={{ background: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)" }}></div>
            <h2>Gewinne / Verluste</h2>
          </div>
          <div className="section-total" style={{ color: realizedTotal >= 0 ? "var(--accent)" : "var(--danger)" }}>
            {fmtEURsigned(realizedTotal)}
          </div>
        </div>

        <div className="invest-head trade">
          <div>Wertpapier</div>
          <div>Verkaufskurs</div>
          <div>Datum</div>
          <div style={{ textAlign: "right" }}>Rendite / Verlust</div>
          <div></div>
        </div>

        {sortedTrades.length === 0 ? (
          <div className="entries-empty">
            Noch keine Verkäufe. Trage hier ein, was du mit Gewinn (+) oder Verlust (−) verkauft hast.
          </div>
        ) : (
          sortedTrades.map((t) => (
            <TradeRow
              key={t.id}
              item={t}
              onUpdate={(item) => updateTrade(t.id, item)}
              onDelete={() => deleteTrade(t.id)}
            />
          ))
        )}

        <button className="add-row" onClick={addTrade}>
          <span className="plus">+</span>
          <span>Trade hinzufügen</span>
        </button>
      </div>
    </React.Fragment>
  );
}

(function _secureExport() {
  const _defs = { InvestmentsPage, PortfolioChart };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
