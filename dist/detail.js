/* global React, fmtEUR, fmtDate, todayISO, uid, AmountInput, Icon, TAX_BADGES */

function VariableDetail({
  category,
  onUpdate,
  onBack,
  onUpdateBudget
}) {
  const entries = category.entries || [];
  const total = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const addEntry = () => {
    const newEntry = {
      id: uid(),
      place: "",
      amount: 0,
      date: todayISO()
    };
    onUpdate({
      ...category,
      entries: [...entries, newEntry]
    });
  };
  const updateEntry = (id, patch) => {
    onUpdate({
      ...category,
      entries: entries.map(e => e.id === id ? {
        ...e,
        ...patch
      } : e)
    });
  };
  const deleteEntry = id => {
    onUpdate({
      ...category,
      entries: entries.filter(e => e.id !== id)
    });
  };

  // Sort entries by date descending (most recent first)
  const sortedEntries = [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return /*#__PURE__*/React.createElement("div", {
    className: "detail-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-inner"
  }, /*#__PURE__*/React.createElement("button", {
    className: "detail-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon.Back, null), /*#__PURE__*/React.createElement("span", null, "\xDCbersicht")), /*#__PURE__*/React.createElement("div", {
    className: "detail-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, category.label), /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, entries.length, " ", entries.length === 1 ? "Eintrag" : "Einträge", entries.length > 0 && ` · Ø ${fmtEUR(total / entries.length)}`)), /*#__PURE__*/React.createElement("div", {
    className: "total"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label"
  }, "Gesamt"), /*#__PURE__*/React.createElement("div", {
    className: "value"
  }, fmtEUR(total)))), onUpdateBudget && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 0 12px",
      borderBottom: "1px solid var(--border)",
      marginBottom: "10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "var(--text-faint)",
      flexShrink: 0
    }
  }, "Monatsbudget:"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "10",
    value: category.budget || "",
    placeholder: "kein Limit",
    onChange: e => {
      const newBudget = Number(e.target.value) || 0;
      onUpdateBudget(newBudget);
    },
    style: {
      width: "100px",
      padding: "4px 8px",
      fontSize: "13px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      color: "var(--text)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "var(--text-faint)"
    }
  }, "\u20AC"), category.budget > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: total > category.budget ? "var(--danger)" : "var(--text-faint)"
    }
  }, "(", fmtEUR(total), " / ", fmtEUR(category.budget), ")")), /*#__PURE__*/React.createElement("div", {
    className: "entries"
  }, /*#__PURE__*/React.createElement("div", {
    className: "entries-head"
  }, /*#__PURE__*/React.createElement("div", null, "Wo gekauft"), /*#__PURE__*/React.createElement("div", null, "Datum"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, "Betrag"), /*#__PURE__*/React.createElement("div", null)), sortedEntries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "entries-empty"
  }, "Noch keine Eintr\xE4ge. Klicke unten auf \u201EEintrag hinzuf\xFCgen\", um zu starten.") : sortedEntries.map(entry => {
    const badge = entry.kategorie && TAX_BADGES?.[entry.kategorie];
    return /*#__PURE__*/React.createElement("div", {
      className: "entry",
      key: entry.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      placeholder: "z.B. Edeka, Rossmann \u2026",
      value: entry.place,
      onChange: e => updateEntry(entry.id, {
        place: e.target.value
      }),
      style: {
        flex: 1,
        minWidth: 0
      }
    }), badge && /*#__PURE__*/React.createElement("span", {
      className: `receipt-badge ${badge.className}`,
      title: entry.kategorie
    }, badge.code)), /*#__PURE__*/React.createElement("input", {
      type: "date",
      className: "date",
      value: entry.date || "",
      onChange: e => updateEntry(entry.id, {
        date: e.target.value
      })
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement(AmountInput, {
      value: entry.amount,
      onChange: v => updateEntry(entry.id, {
        amount: v
      }),
      className: "amount"
    })), /*#__PURE__*/React.createElement("button", {
      className: "entry-delete",
      onClick: () => deleteEntry(entry.id),
      title: "Eintrag l\xF6schen",
      "aria-label": "Eintrag l\xF6schen"
    }, /*#__PURE__*/React.createElement(Icon.Trash, null)));
  }), /*#__PURE__*/React.createElement("button", {
    className: "add-row",
    onClick: addEntry
  }, /*#__PURE__*/React.createElement("span", {
    className: "plus"
  }, "+"), /*#__PURE__*/React.createElement("span", null, "Eintrag hinzuf\xFCgen")))));
}
(function _secureExport() {
  const _defs = {
    VariableDetail
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
