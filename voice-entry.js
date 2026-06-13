/* global React, uid, todayISO, Icon */
// ────────────────────────────────────────────────────────────────────────
// voice-entry.jsx
// Diktierfunktion für Variable-Ausgaben: per Spracheingabe (Web Speech API)
// "Edeka 12,99 am 15.05.26" sagen → Ort, Betrag, Datum werden erkannt und
// einer Budget-Kategorie zugeordnet (gelernt + Stichwort-Fallback).
//
// Liefert auf window:
//   • parseVoiceText(text)              → { place, amount, date }
//   • guessCategoryLabel(place, cats)   → Kategorie-Label | null
//   • VoiceKat.learn(place, kategorie)
//   • VoiceKat.predict(place)           → Kategorie-Label | null
//   • VoiceEntryModal (Komponente)
// ────────────────────────────────────────────────────────────────────────

// ── Stichwort-Fallback: Händler → Budget-Kategorie ─────────────────────
const VOICE_CATEGORY_KEYWORDS = {
  "Lebensmittel": ["edeka", "rewe", "aldi", "lidl", "penny", "netto", "kaufland", "real", "norma", "tegut", "denns", "denn's", "biomarkt", "bio company", "spar"],
  "Drogerie": ["rossmann", "dm", "müller", "mueller", "douglas", "flaconi", "ihr platz"],
  "Restaurant": ["restaurant", "bäcker", "baecker", "bakery", "mcdonald", "burger king", "kfc", "imbiss", "café", "cafe", "pizza", "döner", "doener", "subway", "starbucks", "bistro", "eis", "lieferando"],
  "Kleidung": ["zara", "h&m", "primark", "c&a", "zalando", "asos", "tk maxx", "esprit", "vero moda"],
  "Freizeit": ["kino", "cinema", "fitx", "fitness", "mcfit", "spotify", "netflix", "steam", "playstation", "buch"],
  "KFZ / Mobilität": ["aral", "shell", "esso", "jet", "tankstelle", "tanken", "db", "bahn", "uber", "taxi", "parken", "parkhaus", "werkstatt"],
  "Reisen / Urlaub": ["hotel", "booking", "airbnb", "ryanair", "lufthansa", "fluege", "flug"]
};

// ── Lernende Zuordnung Händler → Budget-Kategorie (analog AutoKat) ─────
const VOICEKAT_KEY = "ausgaben-voicekat-budget-v1";
const VoiceKat = (() => {
  function normalize(s) {
    return (s || "").toLowerCase().trim().replace(/[^a-z0-9äöüß\s]/g, "").replace(/\s+/g, " ");
  }
  function load() {
    try {
      return JSON.parse(localStorage.getItem(VOICEKAT_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function save(map) {
    try {
      localStorage.setItem(VOICEKAT_KEY, JSON.stringify(map));
    } catch {}
  }
  function learn(place, categoryLabel) {
    if (!place || !categoryLabel) return;
    const map = load();
    const key = normalize(place);
    if (!key) return;
    const entry = map[key] || {};
    entry[categoryLabel] = (entry[categoryLabel] || 0) + 1;
    map[key] = entry;
    save(map);
  }
  function _winner(counts) {
    return Object.entries(counts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }
  function predict(place) {
    if (!place) return null;
    const map = load();
    const key = normalize(place);
    if (!key) return null;
    if (map[key]) return _winner(map[key]);
    for (const k of Object.keys(map)) if (k.length >= 3 && (key.includes(k) || k.includes(key))) return _winner(map[k]);
    return null;
  }
  return {
    learn,
    predict
  };
})();

// ── Kategorie-Vorschlag: gelernte Zuordnung, sonst Stichwort-Fallback ──
function guessCategoryLabel(place, categories) {
  if (!place || !Array.isArray(categories)) return null;
  const learned = VoiceKat.predict(place);
  if (learned && categories.some(c => c.label === learned)) return learned;
  const normalized = place.toLowerCase();
  for (const [label, keywords] of Object.entries(VOICE_CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      if (categories.some(c => c.label === label)) return label;
    }
  }
  return null;
}

// ── Datums-Helfer ───────────────────────────────────────────────────────
const _isoFromYMD = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const _isoFromDate = d => _isoFromYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
const MONTH_NAMES = {
  "januar": 1,
  "februar": 2,
  "märz": 3,
  "marz": 3,
  "april": 4,
  "mai": 5,
  "juni": 6,
  "juli": 7,
  "august": 8,
  "september": 9,
  "oktober": 10,
  "november": 11,
  "dezember": 12
};

// Wörter, die nach Erkennung von Datum/Betrag entfernt werden, um den
// verbleibenden Text als "Wo gekauft" (Händler/Ort) zu interpretieren.
const FILLER_WORDS = ["ich habe", "ich hab", "habe ich", "hab ich", "heute", "gestern", "vorgestern", "ausgegeben", "bezahlt", "gekauft", "war", "bin", "gewesen", "für", "fuer", "und zwar", "und", "also", "bei", "am", "den", "der", "die", "das", "vom", "circa", "ca", "etwa", "ungefähr", "ungefaehr", "euro", "eur"];

// Erkennt aus diktiertem/eingegebenem Text Ort, Betrag und Datum.
// Beispiel: "Edeka 12,99 am 15.05.26" → { place: "Edeka", amount: 12.99, date: "2026-05-15" }
function parseVoiceText(rawText) {
  let text = ` ${(rawText || "").trim().replace(/\s+/g, " ")} `;
  let date = null;
  const now = new Date();
  if (/\bvorgestern\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    date = _isoFromDate(d);
    text = text.replace(/\bvorgestern\b/gi, " ");
  } else if (/\bgestern\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    date = _isoFromDate(d);
    text = text.replace(/\bgestern\b/gi, " ");
  } else if (/\bheute\b/i.test(text)) {
    date = todayISO();
    text = text.replace(/\bheute\b/gi, " ");
  }

  // "15.05.26" / "15.05.2026" / "15.05."
  if (!date) {
    const m = text.match(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})?\b/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = _isoFromYMD(year, month, day);
        text = text.replace(m[0], " ");
      }
    }
  }

  // "15. Mai" / "15. Mai 2026"
  if (!date) {
    const monthRe = new RegExp(`\\b(\\d{1,2})\\.?\\s*(${Object.keys(MONTH_NAMES).join("|")})\\b(\\s+(\\d{4}))?`, "i");
    const m = text.match(monthRe);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = MONTH_NAMES[m[2].toLowerCase()];
      const year = m[4] ? parseInt(m[4], 10) : now.getFullYear();
      if (day >= 1 && day <= 31) {
        date = _isoFromYMD(year, month, day);
        text = text.replace(m[0], " ");
      }
    }
  }

  // Betrag: "12 Euro 99" | "12,99 €" | "12.99 euro" | "45 Euro"
  let amount = null;
  {
    let m = text.match(/\b(\d{1,5})\s*(?:€|euro)\s*(\d{1,2})\b/i);
    if (m) {
      amount = parseInt(m[1], 10) + parseInt(m[2], 10) / 100;
      text = text.replace(m[0], " ");
    } else {
      m = text.match(/\b(\d{1,5}[.,]\d{1,2})\s*(?:€|euro)?\b/i);
      if (m) {
        amount = parseFloat(m[1].replace(",", "."));
        text = text.replace(m[0], " ");
      } else {
        m = text.match(/\b(\d{1,5})\s*(?:€|euro)\b/i);
        if (m) {
          amount = parseInt(m[1], 10);
          text = text.replace(m[0], " ");
        }
      }
    }
  }

  // Restlicher Text = Ort/Händler — Füllwörter entfernen
  let place = text;
  for (const w of FILLER_WORDS) {
    place = place.replace(new RegExp(`\\b${w}\\b`, "gi"), " ");
  }
  place = place.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  place = place.split(" ").filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return {
    place,
    amount,
    date
  };
}
const NEW_CAT = "__new__";

// ── Diktier-Modal ────────────────────────────────────────────────────────
function VoiceEntryModal({
  open,
  onClose,
  categories,
  onSave
}) {
  const [listening, setListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");
  const [hasResult, setHasResult] = React.useState(false);
  const [place, setPlace] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState("");
  const [categoryLabel, setCategoryLabel] = React.useState("");
  const [newCategoryLabel, setNewCategoryLabel] = React.useState("");
  const [error, setError] = React.useState(null);
  const recognitionRef = React.useRef(null);
  const liveTextRef = React.useRef("");
  const timeoutRef = React.useRef(null);
  const SpeechRecognitionImpl = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  React.useEffect(() => {
    if (open) {
      setListening(false);
      setTranscript("");
      setHasResult(false);
      setPlace("");
      setAmount("");
      setDate(todayISO());
      setCategoryLabel("");
      setNewCategoryLabel("");
      setError(null);
    }
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const applyTranscript = text => {
    const parsed = parseVoiceText(text);
    setTranscript(text);
    setPlace(parsed.place || "");
    setAmount(parsed.amount != null ? String(parsed.amount) : "");
    setDate(parsed.date || todayISO());
    const guess = guessCategoryLabel(parsed.place, categories) || "Sonstige Ausgaben";
    setCategoryLabel(categories.some(c => c.label === guess) ? guess : "");
    setHasResult(true);
  };

  // Beendet die Aufnahme einmalig: wertet den bis dahin erkannten Text aus
  // (oder zeigt eine Fehlermeldung, falls nichts erkannt wurde). Wird sowohl
  // von "onend" als auch von einem manuellen Stop/Timeout aufgerufen — der
  // recognitionRef-Reset verhindert doppelte Auswertung.
  const finalizeListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setListening(false);
    const text = liveTextRef.current.trim();
    liveTextRef.current = "";
    if (text) {
      applyTranscript(text);
    } else {
      setError(prev => prev || "Keine Eingabe erkannt. Bitte erneut versuchen oder Text eingeben.");
    }
  };
  const startListening = () => {
    if (!SpeechRecognitionImpl) return;
    setError(null);
    setTranscript("");
    liveTextRef.current = "";
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = "de-DE";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = e => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      liveTextRef.current = text;
      setTranscript(text);
    };
    recognition.onerror = e => {
      if (e.error === "no-speech") return;
      setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Mikrofon-Zugriff wurde nicht erlaubt." : "Spracherkennung fehlgeschlagen. Bitte erneut versuchen oder Text eingeben.");
    };
    recognition.onend = finalizeListening;
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      // Sicherheits-Timeout: falls "onend" nie kommt, nach 15s automatisch beenden
      timeoutRef.current = setTimeout(() => {
        try {
          recognitionRef.current?.stop();
        } catch {}
        finalizeListening();
      }, 15000);
    } catch {
      recognitionRef.current = null;
      setError("Spracherkennung konnte nicht gestartet werden.");
    }
  };
  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    finalizeListening();
  };
  const handleCatChange = val => {
    if (val === NEW_CAT) {
      setCategoryLabel(NEW_CAT);
      setNewCategoryLabel("");
    } else {
      setCategoryLabel(val);
      setNewCategoryLabel("");
    }
  };
  const isNewCat = categoryLabel === NEW_CAT;
  const finalCategoryLabel = isNewCat ? newCategoryLabel.trim() : categoryLabel;
  const amountNum = parseFloat(String(amount).replace(",", "."));
  const canSave = amountNum > 0 && finalCategoryLabel.length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      place: place.trim(),
      amount: amountNum,
      date: date || todayISO(),
      categoryLabel: finalCategoryLabel
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "scanner-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-modal",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-header"
  }, /*#__PURE__*/React.createElement("h2", null, "Ausgabe diktieren"), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null))), /*#__PURE__*/React.createElement("div", {
    className: "scanner-body"
  }, !SpeechRecognitionImpl && /*#__PURE__*/React.createElement("div", {
    className: "voice-warning"
  }, "Spracherkennung wird von diesem Browser nicht unterst\xFCtzt \u2014 du kannst den Text trotzdem unten eingeben."), !hasResult && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "voice-mic-row"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: `voice-mic-btn${listening ? " listening" : ""}`,
    onClick: listening ? stopListening : startListening,
    disabled: !SpeechRecognitionImpl,
    "aria-label": listening ? "Aufnahme beenden" : "Aufnahme starten"
  }, listening ? /*#__PURE__*/React.createElement(Icon.Close, null) : /*#__PURE__*/React.createElement(Icon.Mic, null)), /*#__PURE__*/React.createElement("div", {
    className: "voice-mic-hint"
  }, listening ? "Ich höre zu … Zum Beenden hier tippen." : /*#__PURE__*/React.createElement(React.Fragment, null, "Antippen und sprechen, z.\xA0B. \u201EEdeka 12,99 heute\u201C"))), listening && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "receipt-btn secondary",
    onClick: stopListening
  }, "Aufnahme beenden"), error && /*#__PURE__*/React.createElement("div", {
    className: "voice-error"
  }, error), /*#__PURE__*/React.createElement("textarea", {
    className: "voice-manual-input",
    placeholder: "\u2026oder Text eingeben, z. B. \u201EEdeka 12,99 am 15.05.26\u201C",
    value: transcript,
    onChange: e => setTranscript(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: () => applyTranscript(transcript),
    disabled: !transcript.trim()
  }, "Erkennen")), hasResult && /*#__PURE__*/React.createElement(React.Fragment, null, transcript && /*#__PURE__*/React.createElement("div", {
    className: "voice-transcript"
  }, "\u201E", transcript, "\u201C"), /*#__PURE__*/React.createElement("div", {
    className: "receipt-fields",
    style: {
      borderBottom: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Wo gekauft"), /*#__PURE__*/React.createElement("input", {
    className: "receipt-field-value voice-input",
    type: "text",
    placeholder: "z.B. Edeka, Rossmann \u2026",
    value: place,
    onChange: e => setPlace(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Datum"), /*#__PURE__*/React.createElement("input", {
    className: "receipt-field-value voice-input",
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field total"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "Betrag"), /*#__PURE__*/React.createElement("input", {
    className: "receipt-field-value voice-input",
    type: "number",
    step: "0.01",
    min: "0",
    placeholder: "0,00",
    value: amount,
    onChange: e => setAmount(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-category"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-category-label"
  }, "Budget-Kategorie"), /*#__PURE__*/React.createElement("select", {
    className: "receipt-cat-select",
    value: categoryLabel,
    onChange: e => handleCatChange(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "Kategorie w\xE4hlen\u2026"), categories.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.label
  }, c.label)), /*#__PURE__*/React.createElement("option", {
    value: NEW_CAT
  }, "\uFF0B Neue Kategorie anlegen\u2026")), isNewCat && /*#__PURE__*/React.createElement("input", {
    className: "receipt-cat-new",
    placeholder: "Name der neuen Kategorie",
    value: newCategoryLabel,
    onChange: e => setNewCategoryLabel(e.target.value),
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: () => setHasResult(false)
  }, "Erneut diktieren"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: handleSave,
    disabled: !canSave,
    style: !canSave ? {
      opacity: 0.55,
      cursor: "not-allowed"
    } : {}
  }, "Eintragen"))))));
}
(function _secureExport() {
  const _defs = {
    parseVoiceText,
    guessCategoryLabel,
    VoiceKat,
    VoiceEntryModal
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
