/* global React, fmtEUR, fmtDate, todayISO, uid, AmountInput, Icon, TAX_BADGES */

function VariableDetail({ category, onUpdate, onBack, onUpdateBudget }) {
  const entries = category.entries || [];
  const total = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const addEntry = () => {
    const newEntry = { id: uid(), place: "", amount: 0, date: todayISO() };
    onUpdate({ ...category, entries: [...entries, newEntry] });
  };

  const updateEntry = (id, patch) => {
    onUpdate({
      ...category,
      entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const deleteEntry = (id) => {
    onUpdate({
      ...category,
      entries: entries.filter((e) => e.id !== id),
    });
  };

  // Sort entries by date descending (most recent first)
  const sortedEntries = [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="detail-page">
      <div className="detail-inner">
        <button className="detail-back" onClick={onBack}>
          <Icon.Back />
          <span>Übersicht</span>
        </button>

        <div className="detail-header">
          <div>
            <h1>{category.label}</h1>
            <div className="meta">
              {entries.length} {entries.length === 1 ? "Eintrag" : "Einträge"}
              {entries.length > 0 && ` · Ø ${fmtEUR(total / entries.length)}`}
            </div>
          </div>
          <div className="total">
            <div className="label">Gesamt</div>
            <div className="value">{fmtEUR(total)}</div>
          </div>
        </div>

        {onUpdateBudget && (
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 0 12px", borderBottom: "1px solid var(--border)",
            marginBottom: "10px",
          }}>
            <span style={{ fontSize: "12px", color: "var(--text-faint)", flexShrink: 0 }}>
              Monatsbudget:
            </span>
            <input
              type="number"
              min="0"
              step="10"
              value={category.budget || ""}
              placeholder="kein Limit"
              onChange={(e) => {
                const newBudget = Number(e.target.value) || 0;
                onUpdateBudget(newBudget);
              }}
              style={{
                width: "100px", padding: "4px 8px", fontSize: "13px",
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: "6px", color: "var(--text)",
              }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>€</span>
            {category.budget > 0 && (
              <span style={{
                fontSize: "12px",
                color: total > category.budget ? "var(--danger)" : "var(--text-faint)",
              }}>
                ({fmtEUR(total)} / {fmtEUR(category.budget)})
              </span>
            )}
          </div>
        )}

        <div className="entries">
          <div className="entries-head">
            <div>Wo gekauft</div>
            <div>Datum</div>
            <div style={{ textAlign: "right" }}>Betrag</div>
            <div></div>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="entries-empty">
              Noch keine Einträge. Klicke unten auf „Eintrag hinzufügen", um zu starten.
            </div>
          ) : (
            sortedEntries.map((entry) => {
              const badge = entry.kategorie && TAX_BADGES?.[entry.kategorie];
              return (
              <div className="entry" key={entry.id}>
                <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                  <input
                    type="text"
                    placeholder="z.B. Edeka, Rossmann …"
                    value={entry.place}
                    onChange={(e) => updateEntry(entry.id, { place: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {badge && (
                    <span className={`receipt-badge ${badge.className}`} title={entry.kategorie}>
                      {badge.code}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  className="date"
                  value={entry.date || ""}
                  onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <AmountInput
                    value={entry.amount}
                    onChange={(v) => updateEntry(entry.id, { amount: v })}
                    className="amount"
                  />
                </div>
                <button
                  className="entry-delete"
                  onClick={() => deleteEntry(entry.id)}
                  title="Eintrag löschen"
                  aria-label="Eintrag löschen"
                >
                  <Icon.Trash />
                </button>
              </div>
              );
            })
          )}

          <button className="add-row" onClick={addEntry}>
            <span className="plus">+</span>
            <span>Eintrag hinzufügen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

(function _secureExport() {
  const _defs = { VariableDetail };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
