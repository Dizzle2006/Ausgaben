/* global React */

// ═══════════════════════════════════════════════════════════
// VARIANTE B — "Premium Dunkel"
// Charcoal-Background, Mint-Akzent (deine bestehende Akzent-Farbe),
// Mono-Display für Zahlen, Cron/Linear-Vibe.
// ═══════════════════════════════════════════════════════════

const darkStyles = {
  frame: {
    width: 390, height: 720, borderRadius: 38, overflow: "hidden",
    background: "#0c0d10",
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    color: "#e8eae3",
    boxShadow: "0 30px 80px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.2)",
    border: "10px solid #0a0b0e",
    display: "flex", flexDirection: "column", position: "relative",
  },
  statusbar: {
    height: 32, padding: "8px 22px 0", display: "flex",
    justifyContent: "space-between", alignItems: "center",
    fontSize: 13, fontWeight: 600, color: "#e8eae3",
  },
  scroll: { flex: 1, overflow: "hidden", padding: "12px 22px 0" },
  topbar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 26,
  },
  monthPill: {
    display: "inline-flex", alignItems: "center", gap: 10,
    padding: "7px 14px", borderRadius: 8,
    background: "#161a1f", border: "1px solid #232830",
    fontSize: 13, fontWeight: 500, color: "#b9bfc7",
    fontFeatureSettings: '"tnum" 1',
  },
  cog: {
    width: 36, height: 36, borderRadius: 10, background: "#161a1f",
    border: "1px solid #232830", display: "grid", placeItems: "center",
  },

  heroLabel: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em",
    color: "#6b7280", fontWeight: 600, marginBottom: 14,
    display: "flex", alignItems: "center", gap: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 6, background: "#7dd3a8", boxShadow: "0 0 0 4px rgba(125,211,168,0.15)", display: "inline-block" },
  heroAmount: {
    fontFamily: '"JetBrains Mono","SF Mono",ui-monospace,monospace',
    fontSize: 56, fontWeight: 500, lineHeight: 1,
    letterSpacing: "-0.04em",
    color: "#e8eae3",
    display: "flex", alignItems: "baseline", gap: 4,
  },
  heroCents: { fontSize: 24, color: "#6b7280", fontWeight: 400 },
  heroDelta: {
    marginTop: 14, padding: "8px 12px", borderRadius: 8,
    background: "rgba(125,211,168,0.08)", border: "1px solid rgba(125,211,168,0.18)",
    color: "#7dd3a8", display: "inline-flex", alignItems: "center", gap: 8,
    fontSize: 12, fontWeight: 500,
    fontFeatureSettings: '"tnum" 1',
  },

  ringBox: {
    marginTop: 24, padding: 20, borderRadius: 16,
    background: "#13161a", border: "1px solid #1f242c",
    display: "flex", alignItems: "center", gap: 18,
  },
  ringSvg: { width: 86, height: 86, flexShrink: 0 },
  ringStat: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 },
  ringValue: { fontSize: 16, fontWeight: 600, fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontFeatureSettings: '"tnum" 1' },

  sectionTitle: {
    marginTop: 24, marginBottom: 12,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  sTitle: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.16em", color: "#6b7280" },
  sTotal: { fontSize: 12, fontFamily: '"JetBrains Mono",ui-monospace,monospace', color: "#b9bfc7" },

  catRow: {
    padding: "12px 14px", borderRadius: 10,
    background: "#13161a", border: "1px solid #1f242c", marginBottom: 6,
    display: "flex", alignItems: "center", gap: 12,
  },
  catGlyph: (c) => ({
    width: 8, height: 32, borderRadius: 4, background: c,
  }),
  catName: { flex: 1, fontSize: 13, fontWeight: 500, color: "#e8eae3" },
  catBar: {
    width: 50, height: 4, borderRadius: 4, background: "#1f242c", overflow: "hidden", marginRight: 12,
  },
  catBarFill: (pct, c) => ({ width: `${pct}%`, height: "100%", background: c }),
  catSpent: { fontSize: 13, fontWeight: 500, fontFamily: '"JetBrains Mono",ui-monospace,monospace', color: "#e8eae3", fontFeatureSettings: '"tnum" 1' },

  tabbar: {
    height: 70, background: "#0a0b0e", borderTop: "1px solid #1f242c",
    display: "flex", justifyContent: "space-around", alignItems: "center",
    paddingBottom: 12, fontSize: 10, fontWeight: 600,
  },
  tab: (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    color: active ? "#7dd3a8" : "#4a5159",
  }),
};

function Ring({ pct }) {
  const r = 35, c = 2 * Math.PI * r;
  return (
    <svg style={darkStyles.ringSvg} viewBox="0 0 86 86">
      <circle cx="43" cy="43" r={r} fill="none" stroke="#1f242c" strokeWidth="8" />
      <circle cx="43" cy="43" r={r} fill="none" stroke="#7dd3a8" strokeWidth="8"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        strokeLinecap="round" transform="rotate(-90 43 43)" />
      <text x="43" y="48" textAnchor="middle" fill="#e8eae3" fontFamily="JetBrains Mono, monospace" fontSize="16" fontWeight="600">
        {pct}%
      </text>
    </svg>
  );
}

function DarkBudget() {
  const cats = [
    { name: "Lebensmittel", spent: 312, budget: 450, color: "#7dd3a8" },
    { name: "Restaurants", spent: 187, budget: 200, color: "#f5a26b" },
    { name: "Mobilität", spent: 94, budget: 150, color: "#8ab4f8" },
    { name: "Freizeit", spent: 142, budget: 200, color: "#c084fc" },
  ];

  return (
    <div style={darkStyles.frame}>
      <div style={darkStyles.statusbar}>
        <span>9:41</span>
        <span style={{ width: 18, height: 10, borderRadius: 3, border: "1px solid #e8eae3", padding: 1, display: "inline-block" }}>
          <span style={{ display: "block", width: "70%", height: "100%", background: "#e8eae3", borderRadius: 1 }}></span>
        </span>
      </div>

      <div style={darkStyles.scroll}>
        <div style={darkStyles.topbar}>
          <div style={darkStyles.monthPill}>
            <span style={{ color: "#4a5159" }}>‹</span>
            <span>2026-05</span>
            <span style={{ color: "#4a5159" }}>›</span>
          </div>
          <div style={darkStyles.cog}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b9bfc7" strokeWidth="1.6">
              <circle cx="12" cy="12" r="3" /><path d="M19 12c0 .5-.1 1-.2 1.4l2 1.5-2 3.4-2.4-.9c-.7.5-1.5.9-2.4 1.1l-.5 2.5h-4l-.5-2.5c-.9-.2-1.7-.6-2.4-1.1l-2.4.9-2-3.4 2-1.5C2.1 13 2 12.5 2 12s.1-1 .2-1.4l-2-1.5 2-3.4 2.4.9c.7-.5 1.5-.9 2.4-1.1l.5-2.5h4l.5 2.5c.9.2 1.7.6 2.4 1.1l2.4-.9 2 3.4-2 1.5c.1.4.2.9.2 1.4z"/>
            </svg>
          </div>
        </div>

        <div style={darkStyles.heroLabel}>
          <span style={darkStyles.liveDot} />
          <span>verfügbar · mai</span>
        </div>
        <div style={darkStyles.heroAmount}>
          <span>1.432</span>
          <span style={darkStyles.heroCents}>,18 €</span>
        </div>
        <div style={darkStyles.heroDelta}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <span>−204 €  vs. April</span>
          <span style={{ color: "#6b7280", marginLeft: 4 }}>· prognose +312 €</span>
        </div>

        <div style={darkStyles.ringBox}>
          <Ring pct={58} />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={darkStyles.ringStat}>Einnahmen</div>
              <div style={darkStyles.ringValue}>3.450,00</div>
            </div>
            <div>
              <div style={darkStyles.ringStat}>Ausgaben</div>
              <div style={darkStyles.ringValue}>2.017,82</div>
            </div>
          </div>
        </div>

        <div style={darkStyles.sectionTitle}>
          <div style={darkStyles.sTitle}>Variable Kategorien</div>
          <div style={darkStyles.sTotal}>735 / 1.000</div>
        </div>

        {cats.map((c) => {
          const pct = Math.min(100, (c.spent / c.budget) * 100);
          return (
            <div key={c.name} style={darkStyles.catRow}>
              <div style={darkStyles.catGlyph(c.color)} />
              <div style={darkStyles.catName}>{c.name}</div>
              <div style={darkStyles.catBar}>
                <div style={darkStyles.catBarFill(pct, c.color)} />
              </div>
              <div style={darkStyles.catSpent}>{c.spent}€</div>
            </div>
          );
        })}
      </div>

      <div style={darkStyles.tabbar}>
        <div style={darkStyles.tab(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Budget
        </div>
        <div style={darkStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          Verlauf
        </div>
        <div style={darkStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>
          Steuern
        </div>
        <div style={darkStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          Invest.
        </div>
      </div>
    </div>
  );
}

window.DarkBudget = DarkBudget;
