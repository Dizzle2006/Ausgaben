/* global React */

// ═══════════════════════════════════════════════════════════
// MONATSARCHIV
//   · Bildschirm 1: Liste aller gespeicherten Monate
//   · Bildschirm 2: Detail eines Monats (Einnahmen / Ausgaben / Sparen / Top-Kategorien)
// ═══════════════════════════════════════════════════════════

const archiveStyles = {
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

  navbar: {
    display: "flex", alignItems: "center", gap: 12,
    marginBottom: 20, paddingTop: 4,
  },
  back: {
    width: 38, height: 38, borderRadius: 100, background: "#1a2e1f",
    display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
  },
  title: {
    fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em",
    flex: 1, lineHeight: 1.1,
  },
  titleSub: { fontSize: 12, color: "#5a5240", fontWeight: 600, marginTop: 2 },

  // ── Liste ──────────────────────────────────────────────
  year: {
    fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em",
    color: "#5a5240", marginTop: 6, marginBottom: 8,
  },
  monthCard: {
    background: "#fff", borderRadius: 16, padding: "14px 16px",
    border: "1.5px solid #e6dfc8", marginBottom: 8,
    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
  },
  monthCardCurrent: {
    background: "#1D9E75", color: "#f1ead8", borderColor: "#1D9E75",
  },
  monthLabelBlock: { flex: 1 },
  monthLabel: { fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 },
  monthSub: { fontSize: 11, opacity: 0.7, fontWeight: 600, marginTop: 2, fontFeatureSettings: '"tnum" 1' },
  monthValue: { fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", fontFeatureSettings: '"tnum" 1' },
  monthValueSub: { fontSize: 10, opacity: 0.7, fontWeight: 600, textAlign: "right", marginTop: 2 },

  // ── Detail ─────────────────────────────────────────────
  heroCard: {
    background: "#1D9E75", borderRadius: 22, padding: "18px 22px",
    color: "#f1ead8", marginBottom: 14,
  },
  heroLabel: { fontSize: 11, fontWeight: 600, opacity: 0.85, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.14em" },
  heroAmount: {
    fontFamily: '"Geist","Inter Tight",system-ui,sans-serif',
    fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em",
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
    display: "flex", alignItems: "baseline", gap: 4,
  },
  heroCents: { fontSize: 20, fontWeight: 600, opacity: 0.75 },
  heroSub: { marginTop: 10, fontSize: 12, opacity: 0.9 },

  statRow: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
    marginBottom: 14,
  },
  statCard: {
    background: "#fff", borderRadius: 14, padding: "12px 12px",
    border: "1.5px solid #e6dfc8",
  },
  statLabel: {
    fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
    color: "#5a5240", marginBottom: 6,
  },
  statValue: {
    fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em",
    fontFeatureSettings: '"tnum" 1',
  },
  statValueAccent: (c) => ({ color: c }),

  sectionTitle: {
    marginTop: 4, marginBottom: 10,
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
  },
  sTitle: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#5a5240" },
  sTotal: { fontSize: 13, fontWeight: 700, fontFeatureSettings: '"tnum" 1' },

  catRow: {
    background: "#fff", borderRadius: 14, padding: "12px 14px",
    border: "1.5px solid #e6dfc8", marginBottom: 6,
    display: "flex", alignItems: "center", gap: 12,
  },
  catChip: (bg, fg) => ({
    width: 36, height: 36, borderRadius: 10, background: bg, color: fg,
    display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12,
    letterSpacing: "-0.02em", flexShrink: 0,
  }),
  catName: { flex: 1, fontSize: 14, fontWeight: 700 },
  catSpent: { fontSize: 13, fontWeight: 800, fontFeatureSettings: '"tnum" 1' },
  catBar: {
    width: "100%", height: 4, background: "#f3eedd", borderRadius: 4,
    overflow: "hidden", marginTop: 4,
  },
  catBarFill: (pct, c) => ({ width: `${pct}%`, height: "100%", background: c, borderRadius: 4 }),
};

// ─── Liste aller Monate ─────────────────────────────────────
function ArchiveList() {
  const months2026 = [
    { label: "Mai 2026",     remaining: 1432, of: 3450, current: true },
    { label: "April 2026",   remaining: 1228, of: 3450 },
    { label: "März 2026",    remaining:  974, of: 3450 },
    { label: "Februar 2026", remaining: 1542, of: 3450 },
    { label: "Januar 2026",  remaining:  -86, of: 3450 },
  ];
  const months2025 = [
    { label: "Dezember 2025", remaining:  340, of: 3300 },
    { label: "November 2025", remaining: 1180, of: 3300 },
    { label: "Oktober 2025",  remaining:  890, of: 3300 },
  ];

  const Row = ({ m }) => {
    const isNeg = m.remaining < 0;
    return (
      <div style={{ ...archiveStyles.monthCard, ...(m.current ? archiveStyles.monthCardCurrent : {}) }}>
        <div style={archiveStyles.monthLabelBlock}>
          <div style={archiveStyles.monthLabel}>{m.label}</div>
          <div style={archiveStyles.monthSub}>{m.current ? "Aktueller Monat" : `von ${m.of.toLocaleString("de-DE")} €`}</div>
        </div>
        <div>
          <div style={{
            ...archiveStyles.monthValue,
            color: m.current ? "#f1ead8" : isNeg ? "#c2410c" : "#1D9E75",
          }}>
            {isNeg ? "−" : "+"}{Math.abs(m.remaining).toLocaleString("de-DE")} €
          </div>
          <div style={archiveStyles.monthValueSub}>übrig</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    );
  };

  return (
    <div style={archiveStyles.frame}>
      <div style={archiveStyles.statusbar}>
        <span>9:41</span>
        <span style={{ width: 18, height: 10, borderRadius: 3, border: "1.5px solid #1a2e1f", padding: 1, display: "inline-block" }}>
          <span style={{ display: "block", width: "70%", height: "100%", background: "#1a2e1f", borderRadius: 1 }}></span>
        </span>
      </div>

      <div style={archiveStyles.scroll}>
        <div style={archiveStyles.navbar}>
          <div style={archiveStyles.back}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f1ead8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <div>
            <div style={archiveStyles.title}>Monatsarchiv</div>
            <div style={archiveStyles.titleSub}>8 gespeicherte Monate</div>
          </div>
        </div>

        <div style={archiveStyles.year}>2026</div>
        {months2026.map((m) => <Row key={m.label} m={m} />)}

        <div style={archiveStyles.year}>2025</div>
        {months2025.map((m) => <Row key={m.label} m={m} />)}
      </div>
    </div>
  );
}

// ─── Detail eines Monats ────────────────────────────────────
function ArchiveDetail() {
  const cats = [
    { name: "Lebensmittel", spent: 287, budget: 450, bg: "#1D9E75", fg: "#f1ead8", glyph: "Lm" },
    { name: "Restaurants",  spent: 234, budget: 200, bg: "#c2410c", fg: "#f1ead8", glyph: "Re" },
    { name: "Mobilität",    spent: 142, budget: 150, bg: "#f1ead8", fg: "#1a2e1f", glyph: "Mo" },
    { name: "Freizeit",     spent: 178, budget: 200, bg: "#1a2e1f", fg: "#f1ead8", glyph: "Fr" },
  ];
  const maxBudget = Math.max(...cats.map((c) => c.budget));

  return (
    <div style={archiveStyles.frame}>
      <div style={archiveStyles.statusbar}>
        <span>9:41</span>
        <span style={{ width: 18, height: 10, borderRadius: 3, border: "1.5px solid #1a2e1f", padding: 1, display: "inline-block" }}>
          <span style={{ display: "block", width: "70%", height: "100%", background: "#1a2e1f", borderRadius: 1 }}></span>
        </span>
      </div>

      <div style={archiveStyles.scroll}>
        <div style={archiveStyles.navbar}>
          <div style={archiveStyles.back}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f1ead8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          <div>
            <div style={archiveStyles.title}>April 2026</div>
            <div style={archiveStyles.titleSub}>30 Tage · abgeschlossen</div>
          </div>
        </div>

        <div style={archiveStyles.heroCard}>
          <div style={archiveStyles.heroLabel}>Übrig vom Monat</div>
          <div style={archiveStyles.heroAmount}>
            <span>1.228</span>
            <span style={archiveStyles.heroCents}>,42 €</span>
          </div>
          <div style={archiveStyles.heroSub}>von 3.450 € Netto · 64 % verplant</div>
        </div>

        <div style={archiveStyles.statRow}>
          <div style={archiveStyles.statCard}>
            <div style={archiveStyles.statLabel}>Einnahmen</div>
            <div style={{ ...archiveStyles.statValue, ...archiveStyles.statValueAccent("#1D9E75") }}>3.450</div>
          </div>
          <div style={archiveStyles.statCard}>
            <div style={archiveStyles.statLabel}>Ausgaben</div>
            <div style={{ ...archiveStyles.statValue, ...archiveStyles.statValueAccent("#c2410c") }}>1.722</div>
          </div>
          <div style={archiveStyles.statCard}>
            <div style={archiveStyles.statLabel}>Gespart</div>
            <div style={archiveStyles.statValue}>500</div>
          </div>
        </div>

        <div style={archiveStyles.sectionTitle}>
          <div style={archiveStyles.sTitle}>Top-Kategorien</div>
          <div style={archiveStyles.sTotal}>841 €</div>
        </div>
        {cats.map((c) => {
          const pct = Math.min(100, (c.spent / maxBudget) * 100);
          const overBudget = c.spent > c.budget;
          return (
            <div key={c.name} style={archiveStyles.catRow}>
              <div style={archiveStyles.catChip(c.bg, c.fg)}>{c.glyph}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={archiveStyles.catName}>{c.name}</div>
                  <div style={{ ...archiveStyles.catSpent, color: overBudget ? "#c2410c" : "#1a2e1f" }}>
                    {c.spent} €
                  </div>
                </div>
                <div style={archiveStyles.catBar}>
                  <div style={archiveStyles.catBarFill(pct, overBudget ? "#c2410c" : c.bg === "#f1ead8" ? "#8a7f60" : c.bg)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.ArchiveList = ArchiveList;
window.ArchiveDetail = ArchiveDetail;
