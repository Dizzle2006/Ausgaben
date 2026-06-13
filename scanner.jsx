/* global React, Icon, fmtEUR, fmtDate, uid, STEUER_KATEGORIEN, STEUERKAT_MAP */

// ====================== Beleg-Scanner ======================
//
// Drei Eingabe-Modi:
//   1) Live-Kamera (navigator.mediaDevices.getUserMedia) — in der App scannen
//   2) Datei-Upload (Bild oder PDF)
//   3) (mobil) Native Kamera-App via <input capture="environment">
//
// Bilder werden auf max. 1600px (lange Seite) als JPEG komprimiert,
// damit das Persistieren in localStorage praktikabel bleibt.
//
// LOKALE OCR: Tesseract.js wird per CDN lazy ins DOM geladen, der Worker
// einmalig initialisiert und im Modul-Level gehalten. Sprachpakete landen
// dank cacheMethod "readWrite" im IndexedDB-Cache — danach läuft alles offline.

// ====================== Tesseract Singleton + lazy loader ==================
let _tesseractWorker = null;
let _tesseractReady  = false;
let _tesseractLoading = false;
let _pendingResolvers = [];
let _tesseractLang   = null;

// Erlaubt der App, die OCR-Sprache zur Laufzeit zu wechseln. Beim nächsten
// Scan wird der Worker neu initialisiert, falls die Sprache abweicht.
function setOcrLang(lang) {
  const next = (lang || "deu+eng").trim();
  window.__ocrLang = next;
  if (_tesseractLang && _tesseractLang !== next) {
    // Worker invalidieren — beim nächsten OCR neu laden
    try { _tesseractWorker?.terminate?.(); } catch {}
    _tesseractWorker  = null;
    _tesseractReady   = false;
    _tesseractLoading = false;
    _tesseractLang    = null;
  }
}
window.setOcrLang = setOcrLang;

async function _ensureTesseract(onProgress) {
  const lang = (window.__ocrLang || "deu+eng").trim();
  if (_tesseractReady && _tesseractLang === lang) return _tesseractWorker;

  if (_tesseractLoading) {
    return new Promise((resolve, reject) =>
      _pendingResolvers.push({ resolve, reject })
    );
  }
  _tesseractLoading = true;

  try {
    // Script-Tag lazy ins DOM – nur einmal. FIX: Diese Ladephase lag bisher
    // *außerhalb* des try/catch — schlug sie fehl (CDN nicht erreichbar,
    // Timeout, …), blieb _tesseractLoading dauerhaft "true" und jeder
    // weitere Scan-Versuch hing in der "if (_tesseractLoading)"-Warteschlange
    // ohne je aufzulösen → endlos drehender Lade-Spinner.
    if (typeof Tesseract === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        const timer = setTimeout(() => {
          reject(new Error(
            "Tesseract.js konnte nicht geladen werden (Zeitüberschreitung).\n" +
            "Bitte Internetverbindung prüfen und erneut versuchen."
          ));
        }, 20000);
        s.onload  = () => { clearTimeout(timer); resolve(); };
        s.onerror = () => {
          clearTimeout(timer);
          reject(new Error(
            "Tesseract.js konnte nicht geladen werden.\n" +
            "Einmalig ist eine Internetverbindung nötig, um das Sprachpaket herunterzuladen."
          ));
        };
        document.head.appendChild(s);
      });
    }

    onProgress?.("Sprachpaket wird geladen…");

    const worker = await Tesseract.createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          onProgress?.(`Texterkennung… ${Math.round((m.progress || 0) * 100)}%`);
        } else if (m.status === "loading tesseract core") {
          onProgress?.("Tesseract-Kern lädt…");
        } else if (m.status === "loading language traineddata") {
          onProgress?.("Sprachdaten werden geladen…");
        } else if (m.status === "initializing tesseract") {
          onProgress?.("Wird initialisiert…");
        }
      },
      cacheMethod: "readWrite",
    });

    _tesseractWorker  = worker;
    _tesseractReady   = true;
    _tesseractLoading = false;
    _tesseractLang    = lang;
    _pendingResolvers.forEach((p) => p.resolve(worker));
    _pendingResolvers = [];
    return worker;
  } catch (e) {
    _tesseractLoading = false;
    const err = (e instanceof Error && /Tesseract\.js konnte nicht/.test(e.message))
      ? e
      : new Error(
          "OCR konnte nicht initialisiert werden.\n" +
          "Einmalig ist eine Internetverbindung nötig, um das Sprachpaket herunterzuladen."
        );
    _pendingResolvers.forEach((p) => p.reject(err));
    _pendingResolvers = [];
    throw err;
  }
}

// Verkleinert das Bild für die OCR auf max. 1100px (lange Seite).
// Die Erkennungszeit von Tesseract skaliert etwa quadratisch mit der
// Bildgröße — bei 1600px (Speicher-/Vorschaugröße) dauert ein Scan ein
// Vielfaches länger als bei ~1100px, ohne dass die Texterkennung bei
// typischen Kassenbons spürbar schlechter wird.
async function _downscaleForOcr(dataUrl, maxDim = 1100) {
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    let { width: w, height: h } = img;
    if (Math.max(w, h) <= maxDim) return dataUrl;
    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
    else      { w = Math.round(w * maxDim / h); h = maxDim; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl; // Fallback: Original verwenden
  }
}

async function runOCR(imageDataUrl, onProgress) {
  onProgress?.("OCR wird initialisiert…");
  const worker = await _ensureTesseract(onProgress);
  onProgress?.("Bild wird verarbeitet…");
  const ocrImage = await _downscaleForOcr(imageDataUrl);
  const { data } = await worker.recognize(ocrImage);
  return data.text || "";
}

// ====================== Lokaler Parser =====================================

// Hilfsfunktion: deutsches Zahlenformat → float
// "1.234,56" → 1234.56  |  "12,99" → 12.99  |  "12.99" → 12.99
function parseDE(s) {
  const str = String(s).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(str)) {
    // Tausenderpunkt: 1.234,56 oder 1.234
    return parseFloat(str.replace(/\./g, "").replace(",", "."));
  }
  if (/,\d{2}$/.test(str)) {
    // Komma als Dezimaltrennzeichen: 12,99
    return parseFloat(str.replace(",", "."));
  }
  return parseFloat(str); // bereits englisches Format: 12.99
}

function parseReceiptText(rawText) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ── Datum ──────────────────────────────────────────────────────
  const DATE_PATTERNS = [
    { re: /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/, fmt: (m) => `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` },
    { re: /\b(\d{1,2})\.(\d{1,2})\.(\d{2})\b/,  fmt: (m) => { const y = +m[3] < 50 ? `20${m[3]}` : `19${m[3]}`; return `${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; } },
    { re: /\b(\d{4})-(\d{2})-(\d{2})\b/,         fmt: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { re: /\b(\d{1,2})[\/](\d{1,2})[\/](\d{4})\b/, fmt: (m) => `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` },
  ];
  let datum = null;
  let datumConf = "niedrig";
  for (const { re, fmt } of DATE_PATTERNS) {
    const m = rawText.match(re);
    if (!m) continue;
    const candidate = fmt(m);
    const yr = parseInt(candidate.slice(0, 4));
    if (yr < 1990 || yr > 2099) continue;
    datum = candidate;
    // Konfidenz: 4-stelliges Jahr = hoch, 2-stellig = mittel
    datumConf = re.source.includes("\\d{4}") ? "hoch" : "mittel";
    break;
  }

  // ── Gesamtbetrag ───────────────────────────────────────────────
  // Schritt 1: Keyword-Suche
  const TOTAL_RE = /(?:ge?samt(?:betrag)?|total|summe|zu\s*zahlen|endbetrag|zahlbetrag|rechnungsbetrag|bar|gegeben)[^\d\n]{0,30}([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;
  let gesamtbetrag = 0;
  let betragsConf = "niedrig";
  let m;
  const totalMatches = [];
  while ((m = TOTAL_RE.exec(rawText)) !== null) totalMatches.push(parseDE(m[1]));
  if (totalMatches.length) {
    gesamtbetrag = Math.max(...totalMatches);
    betragsConf = "hoch";
  }

  // Schritt 2: Fallback – größter €-Betrag im Text
  if (!gesamtbetrag) {
    const EUR_RE = /([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*[€E]/g;
    let maxV = 0;
    while ((m = EUR_RE.exec(rawText)) !== null) {
      const v = parseDE(m[1]);
      if (v > maxV && v < 50000) maxV = v;
    }
    if (maxV) { gesamtbetrag = maxV; betragsConf = "mittel"; }
  }

  // Schritt 3: Fallback – größte Zahl in Gesamt/Summe-Zeile
  if (!gesamtbetrag) {
    for (const line of lines) {
      if (/gesamt|summe|total|zu zahlen/i.test(line)) {
        const nums = [...line.matchAll(/([\d]+[.,][\d]{2})/g)].map((x) => parseDE(x[1]));
        if (nums.length) { gesamtbetrag = Math.max(...nums); betragsConf = "mittel"; break; }
      }
    }
  }

  // ── MwSt 19% / 7% ──────────────────────────────────────────────
  const MwSt19_RE = /(?:mwst\.?\s*19\s*%?|ust\.?\s*19\s*%?|19\s*%\s*mwst)[^\d\n]{0,25}([\d]+[.,][\d]{2})/i;
  const MwSt7_RE  = /(?:mwst\.?\s*7\s*%?|ust\.?\s*7\s*%?|7\s*%\s*mwst)[^\d\n]{0,25}([\d]+[.,][\d]{2})/i;
  const m19 = rawText.match(MwSt19_RE);
  const m7  = rawText.match(MwSt7_RE);
  const mwst_19 = m19 ? parseDE(m19[1]) : 0;
  const mwst_7  = m7  ? parseDE(m7[1])  : 0;

  // ── Rechnungsnummer ─────────────────────────────────────────────
  const RECH_RE = /(?:rechnungs(?:nummer|nr\.?|no\.?)|rechnung\s*#|invoice\s*(?:no\.?|nr\.?|#)|beleg(?:nr\.?|nummer)?)\s*:?\s*([A-Z0-9][A-Z0-9\-\/\.]{3,29})/i;
  const rechnm = rawText.match(RECH_RE);
  const rechnungsnummer = rechnm ? rechnm[1].trim() : null;
  const rechnConf = rechnungsnummer ? "hoch" : "niedrig";

  // ── Händlername ─────────────────────────────────────────────────
  // Erste Zeile, die kein Datum / keine Zahl-dominierte Zeile / kein bekanntes Label ist
  const SKIP_RE = /^(\d{1,2}[.:\/]\d{1,2}|bon|beleg|kassenbon|quittung|rechnung|tel\.|fax|www\.|http|ust|steuernr|datum|uhrzeit|kasse|vielen dank|danke)/i;
  let haendler = "";
  let haendlerConf = "niedrig";
  for (const line of lines.slice(0, 12)) {
    const digits = (line.match(/\d/g) || []).length;
    if (digits / line.length > 0.45) continue; // zahlen-dominiert
    if (SKIP_RE.test(line)) continue;
    if (line.length < 3) continue;
    haendler = line.replace(/[^\w\s\-\.&äöüÄÖÜß]/g, "").trim();
    if (haendler.length >= 2) { haendlerConf = "mittel"; break; }
  }

  // ── Steuerkat-Heuristik ─────────────────────────────────────────
  const tl = rawText.toLowerCase();
  let steuerkat = "privat";
  if (/apotheke|medikament|arzt|zahnarzt|optiker|brille|therapie|krankenhaus|rezept/i.test(tl))
    steuerkat = "aussergewoehnlich";
  else if (/versicherung|haftpflicht|kirchensteuer|spende|beitrag/i.test(tl))
    steuerkat = "sonderausgaben";
  else if (/bürobedarf|fachliteratur|arbeitsmittel|berufskleidung|fortbildung|fachbuch/i.test(tl))
    steuerkat = "werbungskosten";
  else if (/handwerker|reinigung|gärtner|hauswirtschaft|sanitär|elektriker/i.test(tl))
    steuerkat = "haushaltsnahe";

  return {
    haendler,
    datum,
    gesamtbetrag,
    mwst_19,
    mwst_7,
    rechnungsnummer,
    steuerkat,
    konfidenz: {
      haendler:       haendlerConf,
      datum:          datumConf,
      gesamtbetrag:   betragsConf,
      rechnungsnummer: rechnConf,
    },
  };
}

// ====================== Bild-Komprimierung ======================

// FIX #3: EXIF-Orientierung aus JPEG-Header auslesen (DataView, IFD0, Tag 0x0112)
async function _readExifOrientation(blob) {
  try {
    const buf  = await blob.slice(0, 65536).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xFFD8) return 1; // kein JPEG
    let offset = 2;
    while (offset + 3 < view.byteLength) {
      if (view.getUint8(offset) !== 0xFF) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xD9 || marker === 0xDA) break; // EOI / SOS
      const segLen = view.getUint16(offset + 2);
      if (marker === 0xE1 && offset + 10 < view.byteLength) {
        // APP1: "Exif\0\0" erwartet
        if (view.getUint32(offset + 4) !== 0x45786966 ||
            view.getUint16(offset + 8) !== 0x0000) { offset += 2 + segLen; continue; }
        const tiff   = offset + 10;
        const little = view.getUint16(tiff) === 0x4949; // "II"
        const ifd0   = tiff + view.getUint32(tiff + 4, little);
        if (ifd0 + 2 > view.byteLength) break;
        const count  = view.getUint16(ifd0, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (entry + 12 > view.byteLength) break;
          if (view.getUint16(entry, little) === 0x0112) {
            return view.getUint16(entry + 8, little); // SHORT-Wert
          }
        }
        break;
      }
      offset += 2 + segLen;
    }
  } catch {}
  return 1;
}

// Liefert { dataUrl, base64, mediaType } — JPEG, max 1600px lange Seite
async function compressImage(blob, maxDim = 1600, quality = 0.82) {
  // FIX #3: Orientierung lesen und per Canvas-Transform korrigieren
  const orientation = await _readExifOrientation(blob);
  const swapDims    = orientation >= 5 && orientation <= 8;

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(blob);
  });
  let { width: w, height: h } = img;
  if (Math.max(w, h) > maxDim) {
    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
    else      { w = Math.round(w * maxDim / h); h = maxDim; }
  }
  const canvas = document.createElement("canvas");
  canvas.width  = swapDims ? h : w;
  canvas.height = swapDims ? w : h;
  const ctx = canvas.getContext("2d");
  switch (orientation) {
    case 2: ctx.transform(-1,  0,  0,  1,  w,  0); break; // flip H
    case 3: ctx.transform(-1,  0,  0, -1,  w,  h); break; // 180°
    case 4: ctx.transform( 1,  0,  0, -1,  0,  h); break; // flip V
    case 5: ctx.transform( 0,  1,  1,  0,  0,  0); break; // transpose
    case 6: ctx.transform( 0,  1, -1,  0,  h,  0); break; // 90° CW
    case 7: ctx.transform( 0, -1, -1,  0,  h,  w); break; // transverse
    case 8: ctx.transform( 0, -1,  1,  0,  0,  w); break; // 90° CCW
    default: break;
  }
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { dataUrl, base64, mediaType: "image/jpeg" };
}

// PDF: nicht resizen, direkt einlesen
async function readPdf(blob) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve({ dataUrl, base64, mediaType: "application/pdf" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ====================== Analyse (lokal) ====================================
// Ersetzt die alte analyzeReceipt(base64, mediaType) komplett.
// onProgress: (statusText: string) => void
async function analyzeReceiptLocal(imageDataUrl, mediaType, onProgress) {
  if (mediaType === "application/pdf") {
    // PDFs können nicht per Canvas-OCR gelesen werden
    onProgress?.("PDF erkannt – bitte Felder manuell ausfüllen.");
    return {
      haendler: "",
      datum: "",
      gesamtbetrag: 0,
      mwst_19: 0,
      mwst_7: 0,
      rechnungsnummer: null,
      steuerkat: "privat",
      konfidenz: { haendler: "niedrig", datum: "niedrig", gesamtbetrag: "niedrig", rechnungsnummer: "niedrig" },
      _isPdf: true,
    };
  }

  const rawText = await runOCR(imageDataUrl, onProgress);
  onProgress?.("Text wird ausgewertet…");
  const result = parseReceiptText(rawText);

  // AutoKat-Vorhersage nur wenn Heuristik nichts erkannt hat (Default "privat")
  if (result.steuerkat === "privat" && window.AutoKat) {
    const predicted = window.AutoKat.predict(result.haendler);
    if (predicted) {
      result.steuerkat = predicted;
      result._katFromLearning = true;
    }
  }

  return result;
}

// ====================== Konfidenz-Punkt ======================
function ConfDot({ level }) {
  const cls = (level || "empty").toLowerCase();
  return <span className={`conf-chip ${cls}`} title={`Konfidenz: ${level || "unbekannt"}`} />;
}

// ====================== Modus-Auswahl ======================
function ModeChooser({ onCamera, onUpload, cameraSupported }) {
  return (
    <div className="scanner-modes">
      <button
        className="scanner-mode primary"
        onClick={onCamera}
        disabled={!cameraSupported}
        title={cameraSupported ? "Mit Kamera scannen" : "Kamera nicht verfügbar"}
      >
        <div className="scanner-mode-icon"><Icon.ScanFrame /></div>
        <div className="scanner-mode-main">Beleg scannen</div>
        <div className="scanner-mode-sub">Mit der Kamera direkt aufnehmen</div>
      </button>

      <button className="scanner-mode" onClick={onUpload}>
        <div className="scanner-mode-icon"><Icon.Upload /></div>
        <div className="scanner-mode-main">Datei hochladen</div>
        <div className="scanner-mode-sub">JPG, PNG oder PDF · max. 10 MB</div>
      </button>
    </div>
  );
}

// ====================== Live-Kamera ======================
function CameraView({ onCapture, onCancel, onError }) {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        onError(e.message?.includes("Permission") || e.name === "NotAllowedError"
          ? "Kamera-Zugriff wurde verweigert. Bitte in den Browser-Einstellungen erlauben."
          : "Kamera konnte nicht gestartet werden. Bitte stattdessen eine Datei hochladen.");
      }
    })();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    let cw = w, ch = h;
    const maxDim = 1600;
    if (Math.max(w, h) > maxDim) {
      if (w > h) { ch = Math.round(h * maxDim / w); cw = maxDim; }
      else      { cw = Math.round(w * maxDim / h); ch = maxDim; }
    }
    canvas.width = cw; canvas.height = ch;
    canvas.getContext("2d").drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    onCapture({ dataUrl, base64, mediaType: "image/jpeg" });
  };

  return (
    <div className="camera-view">
      <div className="camera-stage">
        <video ref={videoRef} playsInline autoPlay muted />
        <div className="camera-guides">
          <span className="g tl" /><span className="g tr" />
          <span className="g bl" /><span className="g br" />
        </div>
        {!ready && <div className="camera-loading">Kamera wird gestartet…</div>}
      </div>
      <div className="camera-controls">
        <button className="camera-cancel" onClick={onCancel}>Abbrechen</button>
        <button className="camera-shutter" onClick={handleCapture} disabled={!ready} aria-label="Aufnehmen">
          <span className="camera-shutter-ring" />
        </button>
        <div style={{ width: 86 }} />
      </div>
    </div>
  );
}

// ====================== Datei-Dropzone ======================
function UploadZone({ onFile, onBack, error }) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <React.Fragment>
      <button className="scanner-back" onClick={onBack}>
        <Icon.Back /> <span>zurück</span>
      </button>
      <div
        className={`scanner-dropzone ${dragOver ? "dragover" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <Icon.Upload />
        <div className="main">Datei wählen oder hierher ziehen</div>
        <div className="sub">JPG, PNG oder PDF · max. 10 MB</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files[0])}
        />
      </div>
      {error && <div className="scanner-error">{error}</div>}
    </React.Fragment>
  );
}

// ====================== Vorschau + Analysieren ======================
function PreviewStep({ image, isPdf, fileName, onRetake, onAnalyze, loading, error, statusText }) {
  return (
    <React.Fragment>
      <div className="scanner-preview large">
        {isPdf ? (
          <div className="pdf-pill">
            <Icon.FileText />
            <span>{fileName || "PDF-Dokument"}</span>
          </div>
        ) : (
          <img src={image} alt="Beleg-Vorschau" />
        )}
      </div>

      {isPdf && (
        <div className="scanner-error" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "none" }}>
          PDFs können nicht automatisch ausgelesen werden – Felder nach dem Klick manuell ausfüllen.
        </div>
      )}

      {error && <div className="scanner-error">{error}</div>}

      <div className="preview-actions">
        <button className="receipt-btn secondary" onClick={onRetake} disabled={loading}>
          Neu aufnehmen
        </button>
        <button className="scanner-analyze" onClick={onAnalyze} disabled={loading}>
          {loading ? (
            <React.Fragment>
              <span className="scanner-spinner" />
              <span>{statusText || "Wird analysiert…"}</span>
            </React.Fragment>
          ) : (
            <span>Beleg erkennen</span>
          )}
        </button>
      </div>
    </React.Fragment>
  );
}

// ====================== Beleg-Karte (Ergebnis) ======================
function ReceiptCard({ data, categories, image, onChange, onAccept, onDiscard }) {
  const conf = data.konfidenz || {};
  const update = (patch) => onChange({ ...data, ...patch });

  const hasTotal = Number(data.gesamtbetrag) > 0;
  const dateLabel = data.datum ? fmtDate(data.datum) : "—";

  // Kategorie-Auswahl
  const NEW_CAT = "__new__";
  const handleCatChange = (val) => {
    if (val === NEW_CAT) {
      update({ categoryId: NEW_CAT, newCategoryLabel: data.newCategoryLabel || "" });
    } else {
      update({ categoryId: val, newCategoryLabel: "" });
    }
  };
  const isNewCat = data.categoryId === NEW_CAT;
  const canSave = hasTotal && (
    (data.categoryId && data.categoryId !== NEW_CAT) ||
    (isNewCat && (data.newCategoryLabel || "").trim().length > 0)
  );

  return (
    <div className="receipt-card">
      {image && (
        <div className="receipt-card-image">
          <img src={image} alt="Beleg" />
        </div>
      )}
      <div className="receipt-head">
        <input
          className="receipt-merchant"
          value={data.haendler || ""}
          placeholder="Händler unbekannt"
          onChange={(e) => update({ haendler: e.target.value })}
          style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontFamily: "inherit" }}
        />
        <div className="receipt-date">{dateLabel}</div>
      </div>

      <div className="receipt-fields">
        <div className="receipt-field total">
          <div className="receipt-field-label">
            <ConfDot level={conf.gesamtbetrag} />
            Gesamtbetrag
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={data.gesamtbetrag != null ? data.gesamtbetrag : ""}
            placeholder="Nicht erkannt"
            onChange={(e) => {
              const v = e.target.value;
              update({ gesamtbetrag: v === "" ? null : parseFloat(v) });
            }}
            className={`receipt-field-value ${hasTotal ? "" : "empty"}`}
            style={{
              border: "none", background: "transparent", outline: "none",
              fontFamily: "var(--font-num)", padding: 0, width: "100%",
              textAlign: "right",
            }}
          />
        </div>
        <div className="receipt-field">
          <div className="receipt-field-label">
            <ConfDot level={conf.datum} />
            Datum
          </div>
          <input
            type="date"
            value={data.datum || ""}
            onChange={(e) => update({ datum: e.target.value })}
            className="receipt-field-value"
            style={{
              border: "none", background: "transparent", outline: "none",
              fontFamily: "var(--font-num)", padding: 0, width: "100%",
            }}
          />
        </div>
        <div className="receipt-field">
          <div className="receipt-field-label">MwSt. 19%</div>
          <div className={`receipt-field-value ${Number(data.mwst_19) > 0 ? "" : "empty"}`}>
            {Number(data.mwst_19) > 0 ? fmtEUR(data.mwst_19) : "—"}
          </div>
        </div>
        <div className="receipt-field">
          <div className="receipt-field-label">MwSt. 7%</div>
          <div className={`receipt-field-value ${Number(data.mwst_7) > 0 ? "" : "empty"}`}>
            {Number(data.mwst_7) > 0 ? fmtEUR(data.mwst_7) : "—"}
          </div>
        </div>
        <div className="receipt-field mono" style={{ gridColumn: "1 / -1" }}>
          <div className="receipt-field-label">
            <ConfDot level={conf.rechnungsnummer} />
            Rechnungsnummer
          </div>
          <div className={`receipt-field-value ${data.rechnungsnummer ? "" : "empty"}`}>
            {data.rechnungsnummer || "—"}
          </div>
        </div>
      </div>

      <div className="receipt-category">
        <div className="receipt-category-label">Steuer-Kategorie</div>
        {data._katFromLearning && (
          <div className="autokat-hint">
            Kategorie aus deinem Verlauf vorgeschlagen
          </div>
        )}
        <div className="steuerkat-grid">
          {STEUER_KATEGORIEN.map((kat) => (
            <button
              key={kat.id}
              type="button"
              className={`steuerkat-option ${data.steuerkat === kat.id ? "active" : ""}`}
              onClick={() => update({ steuerkat: kat.id })}
              style={data.steuerkat === kat.id ? { borderColor: kat.farbe, background: kat.bg } : {}}
            >
              <span className="steuerkat-badge" style={{ background: kat.bg, color: kat.farbe }}>
                {kat.kurz}
              </span>
              <div className="steuerkat-text">
                <div className="steuerkat-title">{kat.label}</div>
                <div className="steuerkat-desc">{kat.beschreibung}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="receipt-category">
        <div className="receipt-category-label">Budget-Kategorie</div>
        <select
          className="receipt-cat-select"
          value={data.categoryId || ""}
          onChange={(e) => handleCatChange(e.target.value)}
        >
          <option value="" disabled>Kategorie wählen…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
          <option value={NEW_CAT}>＋ Neue Kategorie anlegen…</option>
        </select>
        {isNewCat && (
          <input
            className="receipt-cat-new"
            placeholder="Name der neuen Kategorie"
            value={data.newCategoryLabel || ""}
            onChange={(e) => update({ newCategoryLabel: e.target.value })}
            autoFocus
          />
        )}
      </div>

      <div className="receipt-actions">
        <button className="receipt-btn secondary" onClick={onDiscard}>Verwerfen</button>
        <button
          className="receipt-btn primary"
          onClick={onAccept}
          disabled={!canSave}
          style={!canSave ? { opacity: 0.55, cursor: "not-allowed" } : {}}
        >
          Übernehmen
        </button>
      </div>
    </div>
  );
}

// ====================== Scanner-Modal (Hauptkomponente) ======================
function ReceiptScanner({ open, onClose, currentMonth, categories, onAccept, receipts = [] }) {
  // step: "choose" | "camera" | "upload" | "preview" | "result"
  const [step, setStep] = React.useState("choose");
  const [image, setImage] = React.useState(null); // { dataUrl, base64, mediaType }
  const [fileName, setFileName] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [dupWarning, setDupWarning] = React.useState(null);

  const cameraSupported = typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia
    && window.isSecureContext !== false;

  // Reset beim Schließen
  React.useEffect(() => {
    if (!open) {
      setStep("choose"); setImage(null); setFileName(null);
      setError(null); setLoading(false); setStatusText(""); setResult(null);
      setDupWarning(null);
    }
  }, [open]);

  // Escape-Taste + Scroll-Lock
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleFile = async (f) => {
    setError(null);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("Datei zu groß (max. 10 MB)."); return; }
    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf";
    if (!isImage && !isPdf) { setError("Nur Bilder oder PDF werden unterstützt."); return; }
    try {
      setFileName(f.name);
      const data = isPdf ? await readPdf(f) : await compressImage(f);
      setImage(data);
      setStep("preview");
    } catch (e) {
      setError("Datei konnte nicht gelesen werden.");
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setStatusText("Startet…");

    try {
      const data = await analyzeReceiptLocal(
        image.dataUrl,
        image.mediaType,
        (msg) => setStatusText(msg)   // Live-Fortschritt
      );

      setResult({
        haendler:        data.haendler || "",
        datum:           data.datum    || "",
        gesamtbetrag:    Number(data.gesamtbetrag) || 0,
        mwst_19:         Number(data.mwst_19)       || 0,
        mwst_7:          Number(data.mwst_7)        || 0,
        rechnungsnummer: data.rechnungsnummer        || "",
        konfidenz:       data.konfidenz             || {},
        categoryId:      "",
        newCategoryLabel:"",
        steuerkat:       data.steuerkat             || "privat",
      });
      setStep("result");
    } catch (e) {
      setError(e.message || "Analyse fehlgeschlagen.");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleAccept = async () => {
    if (!result) return;

    // Duplikat-Check (nur beim ersten Klick — Bestaetigung ueberspringt ihn)
    if (!dupWarning && window.detectDuplicate) {
      const { isDuplicate, match } = window.detectDuplicate(result, receipts);
      if (isDuplicate) {
        setDupWarning(match);
        return; // Banner anzeigen, noch nicht speichern
      }
    }
    setDupWarning(null);

    const ym = (result.datum && result.datum.slice(0, 7)) || currentMonth;
    const receiptId = uid();

    // Bild in IndexedDB schreiben (NICHT in den State)
    if (image?.dataUrl) {
      try {
        await window.idbPutImage(receiptId, image.dataUrl, image.mediaType || "image/jpeg");
      } catch (e) {
        setError("Bild konnte nicht gespeichert werden: " + (e.message || e));
        return;
      }
    }

    onAccept({
      id: receiptId,
      haendler: result.haendler || "Unbekannter Beleg",
      datum: result.datum || null,
      gesamtbetrag: Number(result.gesamtbetrag) || 0,
      mwst_19: Number(result.mwst_19) || 0,
      mwst_7: Number(result.mwst_7) || 0,
      rechnungsnummer: result.rechnungsnummer || null,
      categoryId: result.categoryId === "__new__" ? null : result.categoryId,
      newCategoryLabel: result.categoryId === "__new__" ? (result.newCategoryLabel || "").trim() : null,
      steuerkat: result.steuerkat || "privat",
      month: ym,
      // Hinweis auf vorhandenes Bild — das eigentliche Bild liegt in IDB
      hasImage: !!image?.dataUrl,
      imageType: image?.mediaType || null,
    });
    onClose();
  };

  const goBack = () => {
    setError(null);
    if (step === "preview") { setImage(null); setStep("choose"); }
    else if (step === "result") { setResult(null); setStep("preview"); }
    else { setStep("choose"); }
  };

  const isPdfPreview = image?.mediaType === "application/pdf";
  const headerTitle = step === "result" ? "Beleg prüfen"
    : step === "preview" ? "Vorschau"
    : step === "camera" ? "Beleg scannen"
    : step === "upload" ? "Datei hochladen"
    : "Beleg erfassen";

  return (
    <div className="scanner-backdrop" onClick={onClose}>
      <div className="scanner-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="scanner-header">
          <h2>{headerTitle}</h2>
          <button className="settings-close" onClick={onClose} aria-label="Schließen">
            <Icon.Close />
          </button>
        </div>

        <div className="scanner-body">
          {step === "choose" && (
            <ModeChooser
              cameraSupported={cameraSupported}
              onCamera={() => { setError(null); setStep("camera"); }}
              onUpload={() => { setError(null); setStep("upload"); }}
            />
          )}

          {step === "camera" && (
            <CameraView
              onCapture={(data) => { setImage(data); setFileName(null); setStep("preview"); }}
              onCancel={() => setStep("choose")}
              onError={(msg) => { setError(msg); setStep("choose"); }}
            />
          )}

          {step === "upload" && (
            <UploadZone onFile={handleFile} onBack={() => setStep("choose")} error={error} />
          )}

          {step === "preview" && image && (
            <React.Fragment>
              <button className="scanner-back" onClick={goBack}>
                <Icon.Back /> <span>zurück</span>
              </button>
              <PreviewStep
                image={image.dataUrl}
                isPdf={isPdfPreview}
                fileName={fileName}
                onRetake={goBack}
                onAnalyze={handleAnalyze}
                loading={loading}
                error={error}
                statusText={statusText}
              />
            </React.Fragment>
          )}

          {step === "result" && result && (
            <React.Fragment>
              {dupWarning && (
                <div className="dup-warning">
                  <div className="dup-warning-title">Mögliches Duplikat</div>
                  <div className="dup-warning-body">
                    <strong>{dupWarning.haendler || "Unbekannter Beleg"}</strong>{" · "}
                    {dupWarning.datum ? fmtDate(dupWarning.datum) : "—"}{" · "}
                    {fmtEUR(dupWarning.gesamtbetrag || 0)} ist bereits gespeichert.
                  </div>
                  <div className="dup-warning-actions">
                    <button className="receipt-btn secondary" onClick={() => setDupWarning(null)}>
                      Abbrechen
                    </button>
                    <button className="receipt-btn primary" onClick={handleAccept}>
                      Trotzdem speichern
                    </button>
                  </div>
                </div>
              )}
              <ReceiptCard
              data={result}
              categories={categories || []}
              image={!isPdfPreview ? image?.dataUrl : null}
              onChange={setResult}
              onAccept={handleAccept}
              onDiscard={() => { setResult(null); setImage(null); setStep("choose"); }}
            />
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

(function _secureExport() {
  const _defs = { ReceiptScanner };
  for (const [k, v] of Object.entries(_defs)) {
    try {
      Object.defineProperty(window, k, {
        value: v, writable: false, configurable: false, enumerable: true,
      });
    } catch { window[k] = v; }
  }
})();
