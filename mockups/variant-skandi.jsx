/* global React */

// ═══════════════════════════════════════════════════════════
// VARIANTE C — "Skandi Bold"
// Cremegelb + tiefes Forst-Grün + Terracotta-Akzent.
// Kalender-Heatmap als Hero, fette Geometric Sans.
// ═══════════════════════════════════════════════════════════

const skandiStyles = {
  frame: {
    width: 390, height: 720, borderRadius: 38, overflow: "hidden",
    background: "#f1ead8",
    fontFamily: '"Geist","Inter Tight",system-ui,sans-serif',
    color: "#1a2e1f",
    boxShadow: "0 30px 80px rgba(40,60,40,0.18), 0 4px 12px rgba(40,60,40,0.08)",
    border: "10px solid #1a2e1f",
    display: "flex", flexDirection: "column", position: "relative",
  },
  statusbar: {
    height: 32, padding: "8px 22px 0", display: "flex",
    justifyContent: "space-between", alignItems: "center",
    fontSize: 13, fontWeight: 700, color: "#1a2e1f",
  },
  scroll: { flex: 1, overflow: "hidden", padding: "8px 20px 0" },

  topbar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 14,
  },
  monthPill: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "8px 14px", borderRadius: 100,
    background: "#1a2e1f", color: "#f1ead8",
    fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em",
  },
  cog: {
    width: 38, height: 38, borderRadius: 100, background: "#1a2e1f",
    display: "grid", placeItems: "center",
  },

  heroCard: {
    background: "#1D9E75", borderRadius: 22, padding: "20px 22px 18px",
    color: "#f1ead8", marginBottom: 14, position: "relative", overflow: "hidden",
  },
  heroLabel: { fontSize: 12, fontWeight: 600, opacity: 0.8, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" },
  heroAmount: {
    fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.045em",
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
    display: "flex", alignItems: "baseline", gap: 4,
  },
  heroCents: { fontSize: 22, fontWeight: 600, opacity: 0.75 },
  heroSub: {
    marginTop: 14, fontSize: 12, opacity: 0.85,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  heroChip: {
    background: "rgba(241,234,216,0.18)", border: "1px solid rgba(241,234,216,0.25)",
    padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
    fontFeatureSettings: '"tnum" 1',
  },

  calCard: {
    background: "#fff", borderRadius: 18, padding: "16px 18px",
    marginBottom: 14, border: "1.5px solid #e6dfc8",
  },
  calHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    marginBottom: 12,
  },
  calTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5a5240" },
  calLegend: { fontSize: 10, color: "#8a7f60", display: "flex", alignItems: "center", gap: 4 },
  calGrid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
  },
  calCell: (intensity) => ({
    aspectRatio: "1",
    background:
      intensity === 0 ? "#f3eedd" :
      intensity === 1 ? "#cfd9b0" :
      intensity === 2 ? "#7eb685" :
      intensity === 3 ? "#3d8a5a" :
      "#c2410c",
    borderRadius: 4,
  }),

  sectionTitle: {
    marginTop: 14, marginBottom: 10,
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
  },
  sTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5a5240" },
  sTotal: { fontSize: 13, fontWeight: 700, color: "#1a2e1f" },

  catRow: {
    background: "#fff", borderRadius: 14, padding: "12px 14px",
    border: "1.5px solid #e6dfc8", marginBottom: 6,
    display: "flex", alignItems: "center", gap: 12,
  },
  catChip: (bg, fg) => ({
    width: 40, height: 40, borderRadius: 12, background: bg, color: fg,
    display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13,
    letterSpacing: "-0.02em", flexShrink: 0,
  }),
  catName: { flex: 1, fontSize: 14, fontWeight: 700, color: "#1a2e1f" },
  catSpent: { fontSize: 14, fontWeight: 700, fontFeatureSettings: '"tnum" 1' },
  catBudget: { fontSize: 11, color: "#8a7f60", fontFeatureSettings: '"tnum" 1' },

  tabbar: {
    height: 70, background: "#1a2e1f",
    display: "flex", justifyContent: "space-around", alignItems: "center",
    paddingBottom: 12, fontSize: 10, fontWeight: 700,
  },
  tab: (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    color: active ? "#f1ead8" : "#5a7565",
    padding: "6px 12px", borderRadius: 100,
    background: active ? "#1D9E75" : "transparent",
  }),
};

function SkandiBudget() {
  // 30 days of "spending intensity" 0-3 + one "over" day (4)
  const days = [
    1,0,2,2,1,3,0,
    1,2,1,0,3,2,1,
    0,2,4,1,2,1,3,
    2,1,0,0,0,0,0,
    0,0,
  ];
  const cats = [
    { name: "Lebensmittel", spent: 312, budget: 450, bg: "#1D9E75", fg: "#f1ead8", glyph: "Lm" },
    { name: "Restaurants",  spent: 187, budget: 200, bg: "#c2410c", fg: "#f1ead8", glyph: "Re" },
    { name: "Mobilität",    spent:  94, budget: 150, bg: "#f1ead8", fg: "#1a2e1f", glyph: "Mo" },
    { name: "Freizeit",     spent: 142, budget: 200, bg: "#1a2e1f", fg: "#f1ead8", glyph: "Fr" },
  ];

  return (
    <div style={skandiStyles.frame}>
      <div style={skandiStyles.statusbar}>
        <span>9:41</span>
        <span style={{ width: 18, height: 10, borderRadius: 3, border: "1.5px solid #1a2e1f", padding: 1, display: "inline-block" }}>
          <span style={{ display: "block", width: "70%", height: "100%", background: "#1a2e1f", borderRadius: 1 }}></span>
        </span>
      </div>

      <div style={skandiStyles.scroll}>
        <div style={skandiStyles.topbar}>
          <div style={skandiStyles.monthPill}>
            <span>‹</span><span>Mai 26</span><span>›</span>
          </div>
          <div style={skandiStyles.cog}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1ead8" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4 1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4 1.7 1.7 0 0 0-1.5 1z"/>
            </svg>
          </div>
        </div>

        <div style={skandiStyles.heroCard}>
          <div style={skandiStyles.heroLabel}>Übrig im Mai</div>
          <div style={skandiStyles.heroAmount}>
            <span>1.432</span>
            <span style={skandiStyles.heroCents}>,18 €</span>
          </div>
          <div style={skandiStyles.heroSub}>
            <span>von 3.450 € · 58 % verplant</span>
            <span style={skandiStyles.heroChip}>+312 € prognose</span>
          </div>
        </div>

        <div style={skandiStyles.calCard}>
          <div style={skandiStyles.calHeader}>
            <div style={skandiStyles.calTitle}>Tagesausgaben</div>
            <div style={skandiStyles.calLegend}>
              wenig
              {[0,1,2,3].map(i => (
                <span key={i} style={{ display:"inline-block", width:8, height:8, borderRadius:2,
                  background: i===0?"#f3eedd":i===1?"#cfd9b0":i===2?"#7eb685":"#3d8a5a" }}/>
              ))}
              viel
            </div>
          </div>
          <div style={skandiStyles.calGrid}>
            {days.map((d, i) => <div key={i} style={skandiStyles.calCell(d)} />)}
          </div>
        </div>

        <div style={skandiStyles.sectionTitle}>
          <div style={skandiStyles.sTitle}>Top-Kategorien</div>
          <div style={skandiStyles.sTotal}>735 €</div>
        </div>

        {cats.slice(0, 3).map((c) => (
          <div key={c.name} style={skandiStyles.catRow}>
            <div style={skandiStyles.catChip(c.bg, c.fg)}>{c.glyph}</div>
            <div style={skandiStyles.catName}>{c.name}</div>
            <div style={{ textAlign: "right" }}>
              <div style={skandiStyles.catSpent}>{c.spent} €</div>
              <div style={skandiStyles.catBudget}>von {c.budget} €</div>
            </div>
          </div>
        ))}
      </div>

      <div style={skandiStyles.tabbar}>
        <div style={skandiStyles.tab(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Budget
        </div>
        <div style={skandiStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          Verlauf
        </div>
        <div style={skandiStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>
          Steuern
        </div>
        <div style={skandiStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          Invest.
        </div>
      </div>
    </div>
  );
}

window.SkandiBudget = SkandiBudget;
