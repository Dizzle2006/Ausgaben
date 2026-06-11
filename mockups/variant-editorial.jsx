/* global React */

// ═══════════════════════════════════════════════════════════
// VARIANTE A — "Editorial Warm"
// Beige bleibt. Serif-Headline für die Hero-Zahl, große Tabular-Mono,
// tiefer Aubergine-Akzent. Atmet ruhig, Buchgefühl.
// ═══════════════════════════════════════════════════════════

const editorialStyles = {
  frame: {
    width: 390, height: 720, borderRadius: 38, overflow: "hidden",
    background: "#faf7f0",
    fontFamily: '"Inter Tight", -apple-system, system-ui, sans-serif',
    color: "#1a1612",
    boxShadow: "0 30px 80px rgba(60,40,20,0.18), 0 4px 12px rgba(60,40,20,0.08)",
    border: "10px solid #1a1612",
    display: "flex", flexDirection: "column", position: "relative",
  },
  statusbar: {
    height: 32, padding: "8px 22px 0", display: "flex",
    justifyContent: "space-between", alignItems: "center",
    fontSize: 13, fontWeight: 600, color: "#1a1612", letterSpacing: "-0.01em",
  },
  scroll: { flex: 1, overflow: "hidden", padding: "12px 22px 0" },
  topbar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 24, paddingTop: 4,
  },
  monthPill: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "6px 14px", borderRadius: 100,
    background: "#fff", border: "1px solid #e8dfd0",
    fontSize: 13, fontWeight: 600,
  },
  cog: {
    width: 36, height: 36, borderRadius: 18, background: "#fff",
    border: "1px solid #e8dfd0", display: "grid", placeItems: "center",
  },
  hero: { marginBottom: 6 },
  heroLabel: {
    fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em",
    color: "#8a7560", fontWeight: 600, marginBottom: 8,
  },
  heroAmount: {
    fontFamily: '"Tiempos Headline","Fraunces",Georgia,serif',
    fontSize: 64, fontWeight: 500, lineHeight: 0.95,
    letterSpacing: "-0.035em",
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
    color: "#1a1612",
  },
  heroSub: {
    marginTop: 12, fontSize: 13, color: "#6b5c4d",
    display: "flex", alignItems: "center", gap: 10,
  },
  dot: (c) => ({ width: 6, height: 6, borderRadius: 6, background: c, display: "inline-block" }),

  forecastBar: {
    marginTop: 22, marginBottom: 28, height: 8, borderRadius: 8,
    background: "#ece2cf", position: "relative", overflow: "hidden",
  },
  forecastFill: {
    position: "absolute", inset: 0, width: "58%",
    background: "linear-gradient(90deg, #5b3a59 0%, #7a5078 100%)",
    borderRadius: 8,
  },
  forecastTick: {
    position: "absolute", top: -4, height: 16, width: 2,
    left: "72%", background: "#1a1612", opacity: 0.5,
  },
  legend: {
    display: "flex", justifyContent: "space-between",
    fontSize: 11, color: "#8a7560", marginTop: 8,
    fontFeatureSettings: '"tnum" 1', textTransform: "uppercase", letterSpacing: "0.08em",
  },

  sectionTitle: {
    marginTop: 22, marginBottom: 10,
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
  },
  sTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8a7560" },
  sTotal: { fontSize: 13, fontWeight: 600, fontFeatureSettings: '"tnum" 1' },
  catCard: {
    background: "#fff", borderRadius: 14, padding: "14px 16px",
    border: "1px solid #ece2cf", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 12,
  },
  catGlyph: (bg) => ({
    width: 36, height: 36, borderRadius: 12, background: bg, color: "#fff",
    display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
    letterSpacing: "-0.02em",
  }),
  catName: { flex: 1, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" },
  catSpent: { fontSize: 14, fontWeight: 600, fontFeatureSettings: '"tnum" 1' },
  catBudget: { fontSize: 11, color: "#8a7560", fontFeatureSettings: '"tnum" 1' },

  tabbar: {
    height: 70, background: "#fff", borderTop: "1px solid #ece2cf",
    display: "flex", justifyContent: "space-around", alignItems: "center",
    paddingBottom: 12, fontSize: 10, fontWeight: 600,
  },
  tab: (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    color: active ? "#1a1612" : "#b0a08c",
    padding: "6px 14px", borderRadius: 12,
    background: active ? "#f1ead8" : "transparent",
  }),
};

function EditorialBudget() {
  const cats = [
    { name: "Lebensmittel", spent: 312, budget: 450, glyph: "Lm", color: "#5b3a59" },
    { name: "Restaurants", spent: 187, budget: 200, glyph: "Re", color: "#c2410c" },
    { name: "Mobilität", spent: 94, budget: 150, glyph: "Mo", color: "#1d6e4e" },
    { name: "Freizeit", spent: 142, budget: 200, glyph: "Fr", color: "#7d5524" },
  ];

  return (
    <div style={editorialStyles.frame}>
      <div style={editorialStyles.statusbar}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ width: 18, height: 10, borderRadius: 3, border: "1px solid #1a1612", display: "inline-block", padding: 1 }}>
            <span style={{ display: "block", width: "70%", height: "100%", background: "#1a1612", borderRadius: 1 }}></span>
          </span>
        </span>
      </div>

      <div style={editorialStyles.scroll}>
        <div style={editorialStyles.topbar}>
          <div style={editorialStyles.monthPill}>
            <span>‹</span><span>Mai 2026</span><span>›</span>
          </div>
          <div style={editorialStyles.cog}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1612" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
            </svg>
          </div>
        </div>

        <div style={editorialStyles.hero}>
          <div style={editorialStyles.heroLabel}>Übrig diesen Monat</div>
          <div style={editorialStyles.heroAmount}>1.432,<span style={{ fontSize: 36, opacity: 0.55 }}>18 €</span></div>
          <div style={editorialStyles.heroSub}>
            <span style={editorialStyles.dot("#1d6e4e")} />
            <span>von <strong style={{ color: "#1a1612", fontWeight: 600 }}>3.450 €</strong> Netto · 58 % verplant</span>
          </div>
        </div>

        <div style={editorialStyles.forecastBar}>
          <div style={editorialStyles.forecastFill} />
          <div style={editorialStyles.forecastTick} />
        </div>
        <div style={editorialStyles.legend}>
          <span>heute · tag 16</span>
          <span>monatsende</span>
        </div>

        <div style={editorialStyles.sectionTitle}>
          <div style={editorialStyles.sTitle}>Variable Ausgaben</div>
          <div style={editorialStyles.sTotal}>735 € / 1.000 €</div>
        </div>

        {cats.map((c) => (
          <div key={c.name} style={editorialStyles.catCard}>
            <div style={editorialStyles.catGlyph(c.color)}>{c.glyph}</div>
            <div style={editorialStyles.catName}>{c.name}</div>
            <div style={{ textAlign: "right" }}>
              <div style={editorialStyles.catSpent}>{c.spent} €</div>
              <div style={editorialStyles.catBudget}>von {c.budget} €</div>
            </div>
          </div>
        ))}
      </div>

      <div style={editorialStyles.tabbar}>
        <div style={editorialStyles.tab(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>
          Budget
        </div>
        <div style={editorialStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          Verlauf
        </div>
        <div style={editorialStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>
          Steuern
        </div>
        <div style={editorialStyles.tab(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
          Invest.
        </div>
      </div>
    </div>
  );
}

window.EditorialBudget = EditorialBudget;
