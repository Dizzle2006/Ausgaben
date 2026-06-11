/* global React */

// ═══════════════════════════════════════════════════════════
// VARIANTE D — "Skandi optimiert"
// Basis: Skandi Bold, aber:
//  · Hero-Zahl in Geist 800 (modern Sans statt Serif)
//  · Forecast-Chip im Stil aus Bild 2 (outlined, dezent)
//  · Header bekommt Kalender-Button (links vom Einstellungs-Rädchen)
//  · Heatmap "Tagesausgaben" pro Monat
// ═══════════════════════════════════════════════════════════

const finalStyles = {
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
  iconBtnRow: { display: "flex", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 100, background: "#1a2e1f",
    display: "grid", placeItems: "center", cursor: "pointer",
  },

  heroCard: {
    background: "#1D9E75", borderRadius: 22, padding: "20px 22px 18px",
    color: "#f1ead8", marginBottom: 14, position: "relative", overflow: "hidden",
  },
  heroLabel: {
    fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 10,
    textTransform: "uppercase", letterSpacing: "0.14em",
  },
  // ← NEU: moderne Sans statt Serif
  heroAmount: {
    fontFamily: '"Geist","Inter Tight",system-ui,sans-serif',
    fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.045em",
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
    display: "flex", alignItems: "baseline", gap: 4,
  },
  heroCents: { fontSize: 22, fontWeight: 600, opacity: 0.75 },
  heroSubRow: {
    marginTop: 12, fontSize: 12, opacity: 0.92,
  },
  // ← NEU: Forecast-Chip im Stil von Bild 2 (outlined, mit Pfeil)
  forecastChip: {
    marginTop: 12,
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "7px 12px", borderRadius: 100,
    background: "rgba(241,234,216,0.10)",
    border: "1px solid rgba(241,234,216,0.35)",
    fontSize: 12, fontWeight: 600,
    fontFeatureSettings: '"tnum" 1',
  },
  forecastSep: { color: "rgba(241,234,216,0.55)", margin: "0 2px" },

  calCard: {
    background: "#fff", borderRadius: 18, padding: "16px 18px",
    marginBottom: 14, border: "1.5px solid #e6dfc8",
  },
  calHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    marginBottom: 12,
  },
  calTitle: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5a5240" },
  calLegend: { fontSize: 10, color: "#8a7f60", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  calCell: (intensity) => ({
    aspectRatio: "1",
    background:
      intensity === 0 ? "#f3eedd" :
      intensity === 1 ? "#cfd9b0" :
      intensity === 2 ? "#7eb685" :
      intensity === 3 ? "#3d8a5a" :
      "#c2410c",
    borderRadius: 6,
  }),

  sectionTitle: {
    marginTop: 14, marginBottom: 10,
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
  },
  sTitle: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5a5240" },
  sTotal: { fontSize: 13, fontWeight: 700, color: "#1a2e1f", fontFeatureSettings: '"tnum" 1' },

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
  catSpent: { fontSize: 14, fontWeight: 800, fontFeatureSettings: '"tnum" 1' },
  catBudget: { fontSize: 11, color: "#8a7f60", fontFeatureSettings: '"tnum" 1', fontWeight: 600 },

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

function FinalBudget() {
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
  ];

  return (
    <div style={finalStyles.frame}>
      <div style={finalStyles.statusbar}>
        <span>9:41</span>
        <span style={{ width: 18, height: 10, borderRadius: 3, border: "1.5px solid #1a2e1f", padding: 1, display: "inline-block" }}>
          <span style={{ display: "block", width: "70%", height: "100%", background: "#1a2e1f", borderRadius: 1 }}></span>
        </span>
      </div>

      <div style={finalStyles.scroll}>
        <div style={finalStyles.topbar}>
          <div style={finalStyles.monthPill}>
            <span>‹</span><span>Mai 26</span><span>›</span>
          </div>
          <div style={finalStyles.iconBtnRow}>
            {/* NEU: Kalender-Button für Monatsarchiv */}
            <div style={finalStyles.iconBtn} title="Monatsarchiv">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1ead8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div style={finalStyles.iconBtn} title="Einstellungen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1ead8" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4 1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4 1.7 1.7 0 0 0-1.5 1z"/>
              </svg>
            </div>
          </div>
        </div>

        <div style={finalStyles.heroCard}>
          <div style={finalStyles.heroLabel}>Übrig im Mai</div>
          <div style={finalStyles.heroAmount}>
            <span>1.432</span>
            <span style={finalStyles.heroCents}>,18 €</span>
          </div>
          <div style={finalStyles.heroSubRow}>
            von 3.450 € Netto · 58 % verplant
          </div>
          {/* NEU: Forecast-Chip im Stil aus Bild 2 */}
          <div style={finalStyles.forecastChip}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>−204 € vs. April</span>
            <span style={finalStyles.forecastSep}>·</span>
            <span style={{ opacity: 0.85 }}>prognose +312 €</span>
          </div>
        </div>

        <div style={finalStyles.calCard}>
          <div style={finalStyles.calHeader}>
            <div style={finalStyles.calTitle}>Tagesausgaben</div>
            <div style={finalStyles.calLegend}>
              wenig
              {[0,1,2,3].map(i => (
                <span key={i} style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2,
                  background: i===0?"#f3eedd":i===1?"#cfd9b0":i===2?"#7eb685":"#3d8a5a" }}/>
              ))}
              viel
            </div>
          </div>
          <div style={finalStyles.calGrid}>
            {days.map((d, i) => <div key={i} style={finalStyles.calCell(d)} />)}
          </div>
        </div>

        <div style={finalStyles.sectionTitle}>
          <div style={finalStyles.sTitle}>Top-Kategorien</div>
          <div style={finalStyles.sTotal}>735 €</div>
        </div>
        {cats.map((c) => (
          <div key={c.name} style={finalStyles.catRow}>
            <div style={finalStyles.catChip(c.bg, c.fg)}>{c.glyph}</div>
            <div style={finalStyles.catName}>{c.name}</div>
            <div style={{ textAlign: "right" }}>
              <div style={finalStyles.catSpent}>{c.spent} €</div>
              <div style={finalStyles.catBudget}>von {c.budget} €</div>
            </div>
          </div>
        ))}
      </div>

      <div style={finalStyles.tabbar}>
        <div style={finalStyles.tab(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Budget
        </div>
        <div style={finalStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          Verlauf
        </div>
        <div style={finalStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>
          Steuern
        </div>
        <div style={finalStyles.tab(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          Invest.
        </div>
      </div>
    </div>
  );
}

window.FinalBudget = FinalBudget;
