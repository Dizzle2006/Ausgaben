/* global React, fmtEUR, fmtDate, AmountInput, Icon, uid */

// ============ Editable Label ============
function EditableLabel({ value, onChange, readOnly = false }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <input
      className="row-label"
      value={draft}
      readOnly={readOnly}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onChange(draft || "—")}
      onKeyDown={(e) => {if (e.key === "Enter") e.target.blur();}} />);


}

// ============ Date Input ============
function DateField({ value, onChange }) {
  return (
    <input
      className="row-date"
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)} />);


}

// ============ Generic editable row (income, fixed, savings) ============
function ItemRow({ item, hasDate, onUpdate, onDelete, canDelete = true, onToggleRecurring }) {
  return (
    <div className="row">
      <div className="row-main">
        <EditableLabel value={item.label} onChange={(v) => onUpdate({ ...item, label: v })} />
      </div>
      <div className="row-right">
        {hasDate &&
        <DateField
          value={item.date}
          onChange={(v) => onUpdate({ ...item, date: v })} />

        }
        <AmountInput
          value={item.amount}
          onChange={(v) => onUpdate({ ...item, amount: v })} />

        {onToggleRecurring && (
          <button
            onClick={onToggleRecurring}
            title={item.recurring !== false ? "Wiederkehrend — klicken zum Deaktivieren" : "Einmalig — klicken für wiederkehrend"}
            className="row-recurring"
            data-on={item.recurring !== false ? "true" : "false"}
            aria-label={item.recurring !== false ? "Wiederkehrend" : "Einmalig"}
          >
            <Icon.Repeat />
          </button>
        )}

        {canDelete &&
        <button className="row-delete" onClick={onDelete} title="Löschen" aria-label="Löschen">
            <Icon.Trash />
          </button>
        }
      </div>
    </div>);

}

// ============ Variable category row (with chevron, opens detail) ============
function VariableRow({ item, total, entryCount, onUpdate, onDelete, onOpen }) {
  const [editingLimit, setEditingLimit] = React.useState(false);
  const [limitDraft, setLimitDraft] = React.useState("");

  const limit = Number(item.budget) || 0;
  const hasLimit = limit > 0;
  const pct = hasLimit ? Math.min(100, total / limit * 100) : 0;
  const isWarn = hasLimit && pct >= 70 && pct < 100;
  const isOver = hasLimit && pct >= 100;
  const barColor = isOver ? "var(--danger)" : isWarn ? "var(--warning)" : "var(--accent)";

  const openLimitEdit = (e) => {
    e.stopPropagation();
    setLimitDraft(limit > 0 ? String(limit).replace(".", ",") : "");
    setEditingLimit(true);
  };

  const commitLimit = () => {
    setEditingLimit(false);
    const normalized = limitDraft.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    onUpdate({ ...item, budget: isNaN(num) || num <= 0 ? 0 : num });
  };

  return (
    <div>
      <div className="row interactive" onClick={(e) => {
        // Don't open when clicking on input or button
        if (e.target.closest("input") || e.target.closest("button")) return;
        onOpen();
      }}>
        <div className="row-main">
          <EditableLabel value={item.label} onChange={(v) => onUpdate({ ...item, label: v })} />
        </div>
        <div className="row-right">
          <div className="row-subtotal">
            <span>{entryCount} {entryCount === 1 ? "Eintrag" : "Einträge"}</span>
          </div>

          {/* Budget-Limit Badge / Edit */}
          {editingLimit ?
          <input
            autoFocus
            className="row-amount"
            style={{ width: 80 }}
            type="text"
            inputMode="decimal"
            placeholder="Limit €"
            value={limitDraft}
            onChange={(e) => setLimitDraft(e.target.value.replace(/[^0-9,.]/g, ""))}
            onBlur={commitLimit}
            onKeyDown={(e) => {if (e.key === "Enter") e.target.blur();if (e.key === "Escape") {setEditingLimit(false);}}}
            onClick={(e) => e.stopPropagation()} /> :


          <button
            className="budget-limit-btn"
            onClick={openLimitEdit}
            title={hasLimit ? `Limit: ${fmtEUR(limit)} – klicken zum Ändern` : "Budget-Limit setzen"}
            style={{
              background: hasLimit ? isOver ? "var(--danger-soft)" : isWarn ? "oklch(0.95 0.04 75)" : "var(--accent-soft)" : "var(--surface-2)",
              color: hasLimit ? isOver ? "var(--danger)" : isWarn ? "var(--warning)" : "var(--accent)" : "var(--text-faint)",
            }}>
            
              {hasLimit ? `${fmtEUR(total)} / ${fmtEUR(limit)}` : "+ Limit"}
            </button>
          }

          <div className="row-amount computed" style={{ pointerEvents: "none" }}>
            {Number(total) === 0 ? "—" : fmtEUR(total)}
          </div>
          <button className="row-delete" onClick={(e) => {e.stopPropagation();onDelete();}} title="Löschen" aria-label="Löschen">
            <Icon.Trash />
          </button>
          <Icon.Chevron />
        </div>
      </div>

      {/* Progress Bar */}
      {hasLimit &&
      <div style={{
        height: 3,
        background: "var(--surface-2)",
        overflow: "hidden",
        marginTop: -1
      }}>
          <div style={{
          height: "100%",
          width: `${pct}%`,
          background: barColor,
          transition: "width 0.3s ease, background 0.3s ease"
        }} />
        </div>
      }
    </div>);

}

// ============ Section wrapper ============
function Section({ title, total, dotClass, children, onAdd, addLabel }) {
  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title" style={{ borderColor: "rgb(0, 0, 0)" }}>
          <div className={`section-dot ${dotClass}`}></div>
          <h2>{title}</h2>
        </div>
        <div className="section-total" style={{ color: total < 0 ? "var(--danger)" : undefined }}>
          {fmtEUR(total)}
        </div>
      </div>
      <div className="section-body">
        {children}
      </div>
      {onAdd &&
      <button className="add-row" onClick={onAdd}>
          <span className="plus">+</span>
          <span>{addLabel}</span>
        </button>
      }
    </div>);

}

(function _secureExport() {
  const _defs = { EditableLabel, DateField, ItemRow, VariableRow, Section };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();