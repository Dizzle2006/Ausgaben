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
// Tesseract.js (Worker-Skript, WASM-Kern, Sprachpakete) wird per build.sh
// lokal nach libs/tesseract/ heruntergeladen und same-origin ausgeliefert
// (genau wie React) — kein Laufzeit-Zugriff auf cdn.jsdelivr.net mehr nötig.
// Das vermeidet CORS/CSP-Eigenheiten bei Cross-Origin Workern (v.a. iOS
// Safari), die zuvor zu einem endlosen "OCR wird initialisiert…" führen
// konnten, sowie Hänger bei langsamen/blockierten CDN-Verbindungen.
const TESS_BASE = new URL("libs/tesseract/", document.baseURI).href;
let _tesseractWorker = null;
let _tesseractReady = false;
let _tesseractLoading = false;
let _pendingResolvers = [];
let _tesseractLang = null;

// Erlaubt der App, die OCR-Sprache zur Laufzeit zu wechseln. Beim nächsten
// Scan wird der Worker neu initialisiert, falls die Sprache abweicht.
function setOcrLang(lang) {
  const next = (lang || "deu+eng").trim();
  window.__ocrLang = next;
  if (_tesseractLang && _tesseractLang !== next) {
    // Worker invalidieren — beim nächsten OCR neu laden
    try {
      _tesseractWorker?.terminate?.();
    } catch {}
    _tesseractWorker = null;
    _tesseractReady = false;
    _tesseractLoading = false;
    _tesseractLang = null;
  }
}
window.setOcrLang = setOcrLang;
async function _ensureTesseract(onProgress) {
  const lang = (window.__ocrLang || "deu+eng").trim();
  if (_tesseractReady && _tesseractLang === lang) return _tesseractWorker;
  if (_tesseractLoading) {
    return new Promise((resolve, reject) => _pendingResolvers.push({
      resolve,
      reject,
      onProgress
    }));
  }
  _tesseractLoading = true;
  const loadStart = Date.now();

  // Fortschritt an diesen Aufruf UND an alle wartenden Aufrufe melden
  // (z.B. den Klick auf "Beleg erkennen", während im Hintergrund bereits
  // ein Pre-Warm-Ladevorgang läuft) — sonst sieht der wartende Aufruf nur
  // die statische Erstmeldung "OCR wird initialisiert…" ohne Updates.
  let basePhase = "OCR wird initialisiert…";
  const emit = msg => {
    onProgress?.(msg);
    _pendingResolvers.forEach(p => p.onProgress?.(msg));
  };
  const elapsed = () => Math.round((Date.now() - loadStart) / 1000);
  const broadcast = msg => {
    basePhase = msg;
    emit(`${msg} (${elapsed()}s)`);
  };
  // Heartbeat: aktualisiert die Anzeige jede Sekunde mit der verstrichenen
  // Zeit, auch wenn Tesseract.js gerade keine Fortschritts-Events liefert
  // (z.B. während des ~4 MB großen WASM-Kern-Downloads, der per blockierendem
  // importScripts ohne Zwischenmeldungen läuft). So sieht man im UI, dass im
  // Hintergrund noch etwas passiert, statt dass die Anzeige stehen bleibt.
  const heartbeat = setInterval(() => emit(`${basePhase} (${elapsed()}s)`), 1000);
  let errorPoll;
  try {
    // Script-Tag lazy ins DOM – nur einmal. FIX: Diese Ladephase lag bisher
    // *außerhalb* des try/catch — schlug sie fehl (CDN nicht erreichbar,
    // Timeout, …), blieb _tesseractLoading dauerhaft "true" und jeder
    // weitere Scan-Versuch hing in der "if (_tesseractLoading)"-Warteschlange
    // ohne je aufzulösen → endlos drehender Lade-Spinner.
    if (typeof Tesseract === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = TESS_BASE + "tesseract.min.js";
        const timer = setTimeout(() => {
          reject(new Error("Tesseract.js konnte nicht geladen werden (Zeitüberschreitung).\n" + "Bitte die App neu laden und erneut versuchen."));
        }, 20000);
        s.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        s.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Tesseract.js konnte nicht geladen werden.\n" + "Bitte die App neu laden und erneut versuchen."));
        };
        document.head.appendChild(s);
      });
    }
    broadcast("Sprachpaket wird geladen…");

    // FIX: Wenn in tesseract.js v5 das Laden des Sprachpakets ("loadLanguage")
    // oder die Initialisierung fehlschlägt (z.B. Netzwerkfehler beim Abruf
    // von deu.traineddata.gz, fehlerhafte Gzip-Daten, …), wird das von
    // createWorker() zurückgegebene Promise NIE aufgelöst oder abgelehnt —
    // es hängt für immer (workerResReject wird nur bei Fehlern in der
    // allerersten "load"-Phase aufgerufen). Ohne errorHandler würde der
    // Fehler intern nur in die Konsole geworfen und wir würden 2 Minuten
    // auf den Sicherheits-Timeout warten, bevor wir (mit einer generischen,
    // wenig hilfreichen Meldung) abbrechen. Mit errorHandler bekommen wir
    // den konkreten Fehlertext sofort und können direkt damit abbrechen.
    let workerError = null;
    const createWorker = Tesseract.createWorker(lang, 1, {
      workerPath: TESS_BASE + "worker.min.js",
      corePath: TESS_BASE,
      langPath: TESS_BASE + "lang",
      logger: m => {
        if (m.status === "recognizing text") {
          broadcast(`Texterkennung… ${Math.round((m.progress || 0) * 100)}%`);
        } else if (m.status === "loading tesseract core") {
          broadcast(m.progress >= 1 ? "Tesseract-Kern geladen" : "Tesseract-Kern wird heruntergeladen…");
        } else if (m.status === "loading language traineddata") {
          broadcast(`Sprachdaten werden geladen… ${Math.round((m.progress || 0) * 100)}%`);
        } else if (m.status === "initializing tesseract") {
          broadcast(m.progress >= 1 ? "Tesseract-Kern initialisiert" : "Tesseract-Kern wird initialisiert…");
        } else if (m.status === "initializing api") {
          broadcast("Letzte Vorbereitungen…");
        }
      },
      errorHandler: err => {
        workerError = err;
      },
      cacheMethod: "readWrite"
    });
    let timedOut = false;
    // Falls der Worker doch noch zustande kommt, nachdem wir bereits per
    // Timeout aufgegeben haben: nicht unbemerkt im Hintergrund weiterlaufen
    // lassen, sondern direkt wieder schließen.
    createWorker.then(w => {
      if (timedOut) {
        try {
          w.terminate?.();
        } catch {}
      }
    }, () => {});
    const worker = await Promise.race([createWorker,
    // Pollt auf den (sonst stillen) errorHandler-Fehler oben — bricht
    // sofort mit der konkreten Ursache ab, statt 2 Minuten zu warten.
    new Promise((_, reject) => {
      errorPoll = setInterval(() => {
        if (workerError) {
          reject(new Error(`OCR-Initialisierung fehlgeschlagen: ${workerError}`));
        }
      }, 250);
    }), new Promise((_, reject) => setTimeout(() => {
      timedOut = true;
      reject(new Error("OCR-Initialisierung hat zu lange gedauert (Zeitüberschreitung nach 2 Minuten).\n" + "Bitte Internetverbindung prüfen oder in den Einstellungen unter\n" + "„Scanner & OCR“ die Sprache auf „Deutsch“ stellen und erneut versuchen."));
    }, 120000))]);
    _tesseractWorker = worker;
    _tesseractReady = true;
    _tesseractLoading = false;
    _tesseractLang = lang;
    _markOcrInstalled(lang);
    _pendingResolvers.forEach(p => p.resolve(worker));
    _pendingResolvers = [];
    return worker;
  } catch (e) {
    _tesseractLoading = false;
    // FIX: Die konkrete Fehlermeldung (z.B. "Network error while fetching
    // …deu.traineddata.gz. Response code: 404" oder die 2-Minuten-
    // Zeitüberschreitung) wurde bisher durch eine generische "Einmalig ist
    // eine Internetverbindung nötig"-Meldung ersetzt — selbst wenn eine
    // Internetverbindung bestand. Jetzt wird die tatsächliche Ursache immer
    // angezeigt, damit erkennbar ist, woran es wirklich liegt.
    const detail = e instanceof Error ? e.message : String(e);
    const err = /^(Tesseract\.js konnte nicht|OCR-Initialisierung)/.test(detail) ? e instanceof Error ? e : new Error(detail) : new Error(`OCR konnte nicht initialisiert werden:\n${detail}`);
    _pendingResolvers.forEach(p => p.reject(err));
    _pendingResolvers = [];
    throw err;
  } finally {
    clearInterval(heartbeat);
    clearInterval(errorPoll);
  }
}

// ====================== OCR-Paket: Vorab-Installation (Einstellungen) =====
// Merkt sich pro Sprache, ob Worker/Kern/Sprachdaten schon einmal erfolgreich
// geladen wurden — damit die Einstellungen "Installiert" anzeigen können,
// auch nach einem Reload (Service-Worker-Cache bleibt erhalten).
function _markOcrInstalled(lang) {
  try {
    const installed = JSON.parse(localStorage.getItem("ocrInstalledLangs") || "[]");
    if (!installed.includes(lang)) {
      installed.push(lang);
      localStorage.setItem("ocrInstalledLangs", JSON.stringify(installed));
    }
  } catch {}
}
function isOcrInstalled(lang) {
  const l = (lang || window.__ocrLang || "deu+eng").trim();
  if (_tesseractReady && _tesseractLang === l) return true;
  try {
    const installed = JSON.parse(localStorage.getItem("ocrInstalledLangs") || "[]");
    return installed.includes(l);
  } catch {
    return false;
  }
}
window.isOcrInstalled = isOcrInstalled;

// Lädt Worker/Kern/Sprachpaket vorab (z.B. über WLAN), damit beim eigentlichen
// Scan nichts mehr nachgeladen werden muss und Download + Bildverarbeitung
// nicht um Ressourcen konkurrieren.
function installOcrPackage(onProgress) {
  return _ensureTesseract(onProgress);
}
window.installOcrPackage = installOcrPackage;

// Verkleinert das Bild für die OCR auf max. 1000px (lange Seite).
// Die Erkennungszeit von Tesseract skaliert etwa quadratisch mit der
// Bildgröße — bei 1600px (Speicher-/Vorschaugröße) dauert ein Scan ein
// Vielfaches länger als bei ~1000px, ohne dass die Texterkennung bei
// typischen Kassenbons spürbar schlechter wird.
// Verbessert das Bild für die Texterkennung: skaliert auf eine für OCR
// sinnvolle Auflösung und wandelt es in kontrastreiche Graustufen um.
// Kassenbons sind oft blass/grau gedruckt — Graustufen + Kontrastanhebung
// verbessert die Tesseract-Trefferquote deutlich, ohne das Originalbild
// (das gespeichert wird) zu verändern.
async function _downscaleForOcr(dataUrl, maxDim = 1600) {
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    let {
      width: w,
      height: h
    } = img;
    if (Math.max(w, h) > maxDim) {
      if (w > h) {
        h = Math.round(h * maxDim / w);
        w = maxDim;
      } else {
        w = Math.round(w * maxDim / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    const contrast = 1.35;
    for (let i = 0; i < px.length; i += 4) {
      const gray = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
      px[i] = px[i + 1] = px[i + 2] = adjusted;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return dataUrl; // Fallback: Original verwenden
  }
}
async function runOCR(imageDataUrl, onProgress) {
  onProgress?.("OCR wird initialisiert…");
  const worker = await _ensureTesseract(onProgress);
  onProgress?.("Bild wird verarbeitet…");
  const ocrImage = await _downscaleForOcr(imageDataUrl);
  const {
    data
  } = await worker.recognize(ocrImage);
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
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ── Datum ──────────────────────────────────────────────────────
  // Auf deutschen Kassenbons steht das (Transaktions-)Datum meist ganz unten,
  // oft bei "Start"/"Ende" (Kartenzahlungs-Beleg) oder "Datum". Diese Zeilen
  // haben Vorrang vor einem irgendwo sonst im Text gefundenen Datum (z.B.
  // einem Mindesthaltbarkeitsdatum auf einem Coupon).
  const DATE_PATTERNS = [{
    re: /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/,
    fmt: m => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }, {
    re: /\b(\d{1,2})\.(\d{1,2})\.(\d{2})\b/,
    fmt: m => {
      const y = +m[3] < 50 ? `20${m[3]}` : `19${m[3]}`;
      return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }, {
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    fmt: m => `${m[1]}-${m[2]}-${m[3]}`
  }, {
    re: /\b(\d{1,2})[\/](\d{1,2})[\/](\d{4})\b/,
    fmt: m => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  }];
  const matchDate = text => {
    for (const {
      re,
      fmt
    } of DATE_PATTERNS) {
      const m = text.match(re);
      if (!m) continue;
      const candidate = fmt(m);
      const yr = parseInt(candidate.slice(0, 4));
      if (yr < 1990 || yr > 2099) continue;
      return {
        candidate,
        conf: re.source.includes("\\d{4}") ? "hoch" : "mittel"
      };
    }
    return null;
  };
  let datum = null;
  let datumConf = "niedrig";
  for (const keyword of [/start/i, /ende/i, /datum/i]) {
    for (const line of lines) {
      if (!keyword.test(line)) continue;
      const found = matchDate(line);
      if (found) {
        datum = found.candidate;
        datumConf = found.conf;
        break;
      }
    }
    if (datum) break;
  }
  if (!datum) {
    const found = matchDate(rawText);
    if (found) {
      datum = found.candidate;
      datumConf = found.conf;
    }
  }

  // ── Gesamtbetrag ───────────────────────────────────────────────
  let gesamtbetrag = 0;
  let betragsConf = "niedrig";
  let m;

  // Schritt 1: "Summe" (nicht "Zwischensumme") – auf deutschen Kassenbons
  // praktisch immer der Endbetrag, gedruckt ganz unten. Von unten nach
  // oben suchen; der Betrag kann in derselben oder der folgenden Zeile
  // stehen.
  for (let i = lines.length - 1; i >= 0 && !gesamtbetrag; i--) {
    if (!/\bsumme\b/i.test(lines[i]) || /zwischensumme/i.test(lines[i])) continue;
    for (const line of [lines[i], lines[i + 1] || ""]) {
      const nums = [...line.matchAll(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)].map(x => parseDE(x[1]));
      if (nums.length) {
        gesamtbetrag = Math.max(...nums);
        betragsConf = "hoch";
        break;
      }
    }
  }

  // Schritt 2: andere Schlüsselwörter (Gesamt, Total, zu zahlen, …)
  if (!gesamtbetrag) {
    const TOTAL_RE = /(?:ge?samt(?:betrag)?|total|zu\s*zahlen|endbetrag|zahlbetrag|rechnungsbetrag|bar|gegeben)[^\d\n]{0,30}([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/gi;
    const totalMatches = [];
    while ((m = TOTAL_RE.exec(rawText)) !== null) totalMatches.push(parseDE(m[1]));
    if (totalMatches.length) {
      gesamtbetrag = Math.max(...totalMatches);
      betragsConf = "hoch";
    }
  }

  // Schritt 3: Fallback – größter €-Betrag im Text
  if (!gesamtbetrag) {
    const EUR_RE = /([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*[€E]/g;
    let maxV = 0;
    while ((m = EUR_RE.exec(rawText)) !== null) {
      const v = parseDE(m[1]);
      if (v > maxV && v < 50000) maxV = v;
    }
    if (maxV) {
      gesamtbetrag = maxV;
      betragsConf = "mittel";
    }
  }

  // Schritt 4: Fallback – größte Zahl in oder direkt nach einer
  // Gesamt/Summe-Zeile (manche Kassenbons drucken den Betrag in der
  // nächsten Zeile statt in derselben)
  if (!gesamtbetrag) {
    for (let i = 0; i < lines.length; i++) {
      if (/gesamt|summe|total|zu zahlen|endbetrag|zahlbetrag/i.test(lines[i])) {
        const candidates = [lines[i], lines[i + 1] || ""];
        for (const line of candidates) {
          const nums = [...line.matchAll(/([\d]{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)].map(x => parseDE(x[1]));
          if (nums.length) {
            gesamtbetrag = Math.max(...nums);
            betragsConf = "mittel";
            break;
          }
        }
        if (gesamtbetrag) break;
      }
    }
  }

  // ── MwSt 19% / 7% ──────────────────────────────────────────────
  // Auf deutschen Kassenbons steht die MwSt-Aufstellung direkt über der
  // Summe, gekennzeichnet mit "A" (= 19%, Regelsatz) und "B" (= 7%,
  // ermäßigter Satz) — zusätzlich zu den expliziten "MwSt"/"USt"-Varianten
  // mit Dezimal-Prozentangaben ("19,0%", "7,00 %").
  const MwSt19_RE = /(?:mwst\.?\s*(?:a\s*)?19(?:[.,]\d+)?\s*%?|ust\.?\s*19(?:[.,]\d+)?\s*%?|19(?:[.,]\d+)?\s*%\s*(?:mwst|ust)?|\bA[\s=:]{0,3}19(?:[.,]\d+)?\s*%?)[^\d\n]{0,25}([\d]+[.,][\d]{2})/i;
  const MwSt7_RE = /(?:mwst\.?\s*(?:b\s*)?7(?:[.,]\d+)?\s*%?|ust\.?\s*7(?:[.,]\d+)?\s*%?|7(?:[.,]\d+)?\s*%\s*(?:mwst|ust)?|\bB[\s=:]{0,3}7(?:[.,]\d+)?\s*%?)[^\d\n]{0,25}([\d]+[.,][\d]{2})/i;
  const m19 = rawText.match(MwSt19_RE);
  const m7 = rawText.match(MwSt7_RE);
  const mwst_19 = m19 ? parseDE(m19[1]) : 0;
  const mwst_7 = m7 ? parseDE(m7[1]) : 0;

  // ── Rechnungsnummer ─────────────────────────────────────────────
  const RECH_RE = /(?:rechnungs(?:nummer|nr\.?|no\.?)|rechnung\s*#|invoice\s*(?:no\.?|nr\.?|#)|beleg(?:s?-?nr\.?|nummer)|bon(?:-?nr\.?|nummer)|kassenbon(?:-?nr\.?|nummer)?|trx[-\s]?nr\.?|transaktions(?:nr\.?|nummer)|vorgangs(?:nr\.?|nummer))\s*:?\s*#?\s*([A-Z0-9][A-Z0-9\-\/\.]{3,29})/i;
  const rechnm = rawText.match(RECH_RE);
  const rechnungsnummer = rechnm ? rechnm[1].trim() : null;
  const rechnConf = rechnungsnummer ? "hoch" : "niedrig";

  // ── Händlername ─────────────────────────────────────────────────
  // Der Händlername steht immer ganz oben auf dem Bon: erste Zeile mit
  // mindestens einem Buchstaben, die kein Datum / keine Zahl-dominierte
  // Zeile / kein bekanntes Label / keine reine Trennlinie ist.
  const SKIP_RE = /^(\d{1,2}[.:\/]\d{1,2}|bon|beleg|kassenbon|quittung|rechnung|tel\.|fax|www\.|http|ust|steuernr|datum|uhrzeit|kasse|vielen dank|danke)/i;
  let haendler = "";
  let haendlerConf = "niedrig";
  for (const line of lines.slice(0, 12)) {
    if (!/[a-zA-ZäöüÄÖÜß]/.test(line)) continue; // reine Zahlen/Trennlinien
    const digits = (line.match(/\d/g) || []).length;
    if (digits / line.length > 0.45) continue; // zahlen-dominiert
    if (SKIP_RE.test(line)) continue;
    if (line.length < 3) continue;
    haendler = line.replace(/[^\w\s\-\.&äöüÄÖÜß]/g, "").trim();
    if (haendler.length >= 2) {
      haendlerConf = "mittel";
      break;
    }
  }

  // ── Steuerkat-Heuristik ─────────────────────────────────────────
  const tl = rawText.toLowerCase();
  let steuerkat = "privat";
  if (/apotheke|medikament|arzt|zahnarzt|optiker|brille|therapie|krankenhaus|rezept/i.test(tl)) steuerkat = "aussergewoehnlich";else if (/versicherung|haftpflicht|kirchensteuer|spende|beitrag/i.test(tl)) steuerkat = "sonderausgaben";else if (/bürobedarf|fachliteratur|arbeitsmittel|berufskleidung|fortbildung|fachbuch/i.test(tl)) steuerkat = "werbungskosten";else if (/handwerker|reinigung|gärtner|hauswirtschaft|sanitär|elektriker/i.test(tl)) steuerkat = "haushaltsnahe";
  return {
    haendler,
    datum,
    gesamtbetrag,
    mwst_19,
    mwst_7,
    rechnungsnummer,
    steuerkat,
    konfidenz: {
      haendler: haendlerConf,
      datum: datumConf,
      gesamtbetrag: betragsConf,
      rechnungsnummer: rechnConf
    }
  };
}

// ====================== Bild-Komprimierung ======================

// FIX #3: EXIF-Orientierung aus JPEG-Header auslesen (DataView, IFD0, Tag 0x0112)
async function _readExifOrientation(blob) {
  try {
    const buf = await blob.slice(0, 65536).arrayBuffer();
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
        if (view.getUint32(offset + 4) !== 0x45786966 || view.getUint16(offset + 8) !== 0x0000) {
          offset += 2 + segLen;
          continue;
        }
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949; // "II"
        const ifd0 = tiff + view.getUint32(tiff + 4, little);
        if (ifd0 + 2 > view.byteLength) break;
        const count = view.getUint16(ifd0, little);
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
  const swapDims = orientation >= 5 && orientation <= 8;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(blob);
  });
  let {
    width: w,
    height: h
  } = img;
  if (Math.max(w, h) > maxDim) {
    if (w > h) {
      h = Math.round(h * maxDim / w);
      w = maxDim;
    } else {
      w = Math.round(w * maxDim / h);
      h = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = swapDims ? h : w;
  canvas.height = swapDims ? w : h;
  const ctx = canvas.getContext("2d");
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, w, 0);
      break;
    // flip H
    case 3:
      ctx.transform(-1, 0, 0, -1, w, h);
      break;
    // 180°
    case 4:
      ctx.transform(1, 0, 0, -1, 0, h);
      break;
    // flip V
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    // transpose
    case 6:
      ctx.transform(0, 1, -1, 0, h, 0);
      break;
    // 90° CW
    case 7:
      ctx.transform(0, -1, -1, 0, h, w);
      break;
    // transverse
    case 8:
      ctx.transform(0, -1, 1, 0, 0, w);
      break;
    // 90° CCW
    default:
      break;
  }
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    dataUrl,
    base64,
    mediaType: "image/jpeg"
  };
}

// PDF: nicht resizen, direkt einlesen
async function readPdf(blob) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve({
        dataUrl,
        base64,
        mediaType: "application/pdf"
      });
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
      konfidenz: {
        haendler: "niedrig",
        datum: "niedrig",
        gesamtbetrag: "niedrig",
        rechnungsnummer: "niedrig"
      },
      _isPdf: true
    };
  }
  const rawText = await runOCR(imageDataUrl, onProgress);
  onProgress?.("Text wird ausgewertet…");
  const result = parseReceiptText(rawText);
  result._rawText = rawText;

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
function ConfDot({
  level
}) {
  const cls = (level || "empty").toLowerCase();
  return /*#__PURE__*/React.createElement("span", {
    className: `conf-chip ${cls}`,
    title: `Konfidenz: ${level || "unbekannt"}`
  });
}

// ====================== Modus-Auswahl ======================
function ModeChooser({
  onCamera,
  onUpload,
  cameraSupported
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "scanner-modes"
  }, /*#__PURE__*/React.createElement("button", {
    className: "scanner-mode primary",
    onClick: onCamera,
    disabled: !cameraSupported,
    title: cameraSupported ? "Mit Kamera scannen" : "Kamera nicht verfügbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-icon"
  }, /*#__PURE__*/React.createElement(Icon.ScanFrame, null)), /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-main"
  }, "Beleg scannen"), /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-sub"
  }, "Mit der Kamera direkt aufnehmen")), /*#__PURE__*/React.createElement("button", {
    className: "scanner-mode",
    onClick: onUpload
  }, /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-icon"
  }, /*#__PURE__*/React.createElement(Icon.Upload, null)), /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-main"
  }, "Datei hochladen"), /*#__PURE__*/React.createElement("div", {
    className: "scanner-mode-sub"
  }, "JPG, PNG oder PDF \xB7 max. 10 MB")));
}

// ====================== Live-Kamera ======================
function CameraView({
  onCapture,
  onCancel,
  onError
}) {
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment"
            },
            width: {
              ideal: 1920
            },
            height: {
              ideal: 1920
            }
          },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        onError(e.message?.includes("Permission") || e.name === "NotAllowedError" ? "Kamera-Zugriff wurde verweigert. Bitte in den Browser-Einstellungen erlauben." : "Kamera konnte nicht gestartet werden. Bitte stattdessen eine Datei hochladen.");
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
    let cw = w,
      ch = h;
    const maxDim = 1600;
    if (Math.max(w, h) > maxDim) {
      if (w > h) {
        ch = Math.round(h * maxDim / w);
        cw = maxDim;
      } else {
        cw = Math.round(w * maxDim / h);
        ch = maxDim;
      }
    }
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d").drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    onCapture({
      dataUrl,
      base64,
      mediaType: "image/jpeg"
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "camera-view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "camera-stage"
  }, /*#__PURE__*/React.createElement("video", {
    ref: videoRef,
    playsInline: true,
    autoPlay: true,
    muted: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "camera-guides"
  }, /*#__PURE__*/React.createElement("span", {
    className: "g tl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "g tr"
  }), /*#__PURE__*/React.createElement("span", {
    className: "g bl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "g br"
  })), !ready && /*#__PURE__*/React.createElement("div", {
    className: "camera-loading"
  }, "Kamera wird gestartet\u2026")), /*#__PURE__*/React.createElement("div", {
    className: "camera-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: "camera-cancel",
    onClick: onCancel
  }, "Abbrechen"), /*#__PURE__*/React.createElement("button", {
    className: "camera-shutter",
    onClick: handleCapture,
    disabled: !ready,
    "aria-label": "Aufnehmen"
  }, /*#__PURE__*/React.createElement("span", {
    className: "camera-shutter-ring"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 86
    }
  })));
}

// ====================== Datei-Dropzone ======================
function UploadZone({
  onFile,
  onBack,
  error
}) {
  const inputRef = React.useRef(null);
  const [dragOver, setDragOver] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "scanner-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon.Back, null), " ", /*#__PURE__*/React.createElement("span", null, "zur\xFCck")), /*#__PURE__*/React.createElement("div", {
    className: `scanner-dropzone ${dragOver ? "dragover" : ""}`,
    onClick: () => inputRef.current?.click(),
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: e => {
      e.preventDefault();
      setDragOver(false);
      onFile(e.dataTransfer.files[0]);
    },
    role: "button",
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
    }
  }, /*#__PURE__*/React.createElement(Icon.Upload, null), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, "Datei w\xE4hlen oder hierher ziehen"), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "JPG, PNG oder PDF \xB7 max. 10 MB"), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/*,application/pdf",
    style: {
      display: "none"
    },
    onChange: e => onFile(e.target.files[0])
  })), error && /*#__PURE__*/React.createElement("div", {
    className: "scanner-error"
  }, error));
}

// ====================== Vorschau + Analysieren ======================
function PreviewStep({
  image,
  isPdf,
  fileName,
  onRetake,
  onAnalyze,
  loading,
  error,
  statusText
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scanner-preview large"
  }, isPdf ? /*#__PURE__*/React.createElement("div", {
    className: "pdf-pill"
  }, /*#__PURE__*/React.createElement(Icon.FileText, null), /*#__PURE__*/React.createElement("span", null, fileName || "PDF-Dokument")) : /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "Beleg-Vorschau"
  })), isPdf && /*#__PURE__*/React.createElement("div", {
    className: "scanner-error",
    style: {
      background: "var(--accent-soft)",
      color: "var(--accent)",
      border: "none"
    }
  }, "PDFs k\xF6nnen nicht automatisch ausgelesen werden \u2013 Felder nach dem Klick manuell ausf\xFCllen."), error && /*#__PURE__*/React.createElement("div", {
    className: "scanner-error"
  }, error), /*#__PURE__*/React.createElement("div", {
    className: "preview-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onRetake,
    disabled: loading
  }, "Neu aufnehmen"), /*#__PURE__*/React.createElement("button", {
    className: "scanner-analyze",
    onClick: onAnalyze,
    disabled: loading
  }, loading ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "scanner-spinner"
  }), /*#__PURE__*/React.createElement("span", null, statusText || "Wird analysiert…")) : /*#__PURE__*/React.createElement("span", null, "Beleg erkennen"))));
}

// ====================== Zuschneiden (Perspektive) ======================
// Berechnet die projektive Transformation, die das Einheitsquadrat (0,0)-(1,1)
// auf das Viereck src = [TL, TR, BR, BL] abbildet (Heckbert-Quad-Mapping).
// Damit lässt sich für jeden Zielpixel der zugehörige Quellpixel im Originalbild
// finden, auch wenn das Viereck schräg/verzerrt ("Apple-Scanner"-Stil) ist.
function _quadToSquareTransform(src) {
  const [p0, p1, p2, p3] = src;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    f = p0.y;
    g = 0;
    h = 0;
  } else {
    const denom = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / denom;
    h = (dx1 * dy3 - dx3 * dy1) / denom;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }
  return {
    a,
    b,
    c,
    d,
    e,
    f,
    g,
    h
  };
}

// Lässt den Nutzer die vier Eckpunkte des Bons unabhängig voneinander auf dem
// Foto positionieren (auch schräg, wie bei klassischen iPhone-Dokumentenscans).
// Beim Bestätigen wird das so markierte Viereck per Perspektiv-Transformation
// in ein gerades Rechteck "entzerrt" — das Ergebnis enthält keinen Rand mehr.
function CropStep({
  image,
  onConfirm,
  onSkip,
  onBack
}) {
  const imgRef = React.useRef(null);
  const stageRef = React.useRef(null);
  const dragIndexRef = React.useRef(null);
  const [imgSize, setImgSize] = React.useState({
    w: 0,
    h: 0
  });
  // Punkte in relativen Koordinaten (0..1): Reihenfolge TL, TR, BR, BL
  const [points, setPoints] = React.useState([{
    x: 0.04,
    y: 0.02
  }, {
    x: 0.96,
    y: 0.02
  }, {
    x: 0.96,
    y: 0.98
  }, {
    x: 0.04,
    y: 0.98
  }]);
  const [busy, setBusy] = React.useState(false);
  const relPos = (clientX, clientY) => {
    const el = stageRef.current;
    if (!el) return {
      x: 0,
      y: 0
    };
    const r = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height))
    };
  };
  const onMove = e => {
    const idx = dragIndexRef.current;
    if (idx == null) return;
    const pos = relPos(e.clientX, e.clientY);
    setPoints(prev => {
      const next = prev.slice();
      next[idx] = pos;
      return next;
    });
  };
  const onUp = () => {
    dragIndexRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  const startDrag = idx => e => {
    e.preventDefault();
    e.stopPropagation();
    dragIndexRef.current = idx;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !imgSize.w || !imgSize.h) {
      onSkip();
      return;
    }
    setBusy(true);
    // requestAnimationFrame, damit der "Wird zugeschnitten…"-Zustand noch
    // gerendert wird, bevor die synchrone Pixel-Schleife den Main-Thread blockiert.
    requestAnimationFrame(() => {
      try {
        const sw = imgSize.w,
          sh = imgSize.h;
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = sw;
        srcCanvas.height = sh;
        const sctx = srcCanvas.getContext("2d");
        sctx.drawImage(img, 0, 0, sw, sh);
        const srcData = sctx.getImageData(0, 0, sw, sh);
        const sp = srcData.data;
        const t = _quadToSquareTransform(points);
        const [p0, p1, p2, p3] = points;
        const edge = (a, b) => Math.hypot((b.x - a.x) * sw, (b.y - a.y) * sh);
        let outW = Math.round(Math.max(edge(p0, p1), edge(p3, p2)));
        let outH = Math.round(Math.max(edge(p0, p3), edge(p1, p2)));
        const MAX_DIM = 1600;
        if (Math.max(outW, outH) > MAX_DIM) {
          const scale = MAX_DIM / Math.max(outW, outH);
          outW = Math.round(outW * scale);
          outH = Math.round(outH * scale);
        }
        outW = Math.max(outW, 1);
        outH = Math.max(outH, 1);
        const outCanvas = document.createElement("canvas");
        outCanvas.width = outW;
        outCanvas.height = outH;
        const octx = outCanvas.getContext("2d");
        const outData = octx.createImageData(outW, outH);
        const dp = outData.data;
        for (let y = 0; y < outH; y++) {
          const v = (y + 0.5) / outH;
          for (let x = 0; x < outW; x++) {
            const u = (x + 0.5) / outW;
            const denom = t.g * u + t.h * v + 1;
            const sx = (t.a * u + t.b * v + t.c) / denom * sw;
            const sy = (t.d * u + t.e * v + t.f) / denom * sh;
            const di = (y * outW + x) * 4;
            if (!isFinite(sx) || !isFinite(sy) || sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
              dp[di] = 255;
              dp[di + 1] = 255;
              dp[di + 2] = 255;
              dp[di + 3] = 255;
              continue;
            }
            const x0 = Math.floor(sx),
              y0 = Math.floor(sy);
            const fx = sx - x0,
              fy = sy - y0;
            const i00 = (y0 * sw + x0) * 4,
              i10 = (y0 * sw + x0 + 1) * 4;
            const i01 = ((y0 + 1) * sw + x0) * 4,
              i11 = ((y0 + 1) * sw + x0 + 1) * 4;
            for (let c = 0; c < 4; c++) {
              const top = sp[i00 + c] * (1 - fx) + sp[i10 + c] * fx;
              const bot = sp[i01 + c] * (1 - fx) + sp[i11 + c] * fx;
              dp[di + c] = top * (1 - fy) + bot * fy;
            }
          }
        }
        octx.putImageData(outData, 0, 0);
        const dataUrl = outCanvas.toDataURL("image/jpeg", 0.88);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        onConfirm({
          dataUrl,
          base64,
          mediaType: "image/jpeg"
        });
      } catch (err) {
        console.error(err);
        onSkip();
      } finally {
        setBusy(false);
      }
    });
  };
  const polyPoints = points.map(p => `${p.x},${p.y}`).join(" ");
  const polyPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
  const maskPath = `M0,0 L1,0 L1,1 L0,1 Z ${polyPath}`;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "scanner-back",
    onClick: onBack
  }, /*#__PURE__*/React.createElement(Icon.Back, null), " ", /*#__PURE__*/React.createElement("span", null, "zur\xFCck")), /*#__PURE__*/React.createElement("div", {
    className: "crop-stage",
    ref: stageRef
  }, /*#__PURE__*/React.createElement("img", {
    ref: imgRef,
    src: image,
    alt: "Beleg",
    draggable: false,
    onLoad: e => setImgSize({
      w: e.target.naturalWidth,
      h: e.target.naturalHeight
    })
  }), /*#__PURE__*/React.createElement("svg", {
    className: "crop-overlay",
    viewBox: "0 0 1 1",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("path", {
    className: "crop-mask",
    fillRule: "evenodd",
    d: maskPath
  }), /*#__PURE__*/React.createElement("polygon", {
    className: "crop-outline",
    points: polyPoints
  })), points.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "crop-point",
    style: {
      left: `${p.x * 100}%`,
      top: `${p.y * 100}%`
    },
    onPointerDown: startDrag(i)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "crop-hint"
  }, "Ziehe die vier Eckpunkte auf die Ecken des Bons \u2013 auch schr\xE4g m\xF6glich. Der Bereich wird entzerrt und gerade ausgeschnitten."), /*#__PURE__*/React.createElement("div", {
    className: "preview-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onSkip,
    disabled: busy
  }, "Ganzes Bild verwenden"), /*#__PURE__*/React.createElement("button", {
    className: "scanner-analyze",
    onClick: handleConfirm,
    disabled: busy
  }, /*#__PURE__*/React.createElement("span", null, busy ? "Wird zugeschnitten…" : "Zuschneiden"))));
}

// ====================== Beleg-Karte (Ergebnis) ======================
function ReceiptCard({
  data,
  categories,
  image,
  onChange,
  onAccept,
  onDiscard
}) {
  const conf = data.konfidenz || {};
  const update = patch => onChange({
    ...data,
    ...patch
  });
  const hasTotal = Number(data.gesamtbetrag) > 0;
  const dateLabel = data.datum ? fmtDate(data.datum) : "—";

  // Kategorie-Auswahl
  const NEW_CAT = "__new__";
  const handleCatChange = val => {
    if (val === NEW_CAT) {
      update({
        categoryId: NEW_CAT,
        newCategoryLabel: data.newCategoryLabel || ""
      });
    } else {
      update({
        categoryId: val,
        newCategoryLabel: ""
      });
    }
  };
  const isNewCat = data.categoryId === NEW_CAT;
  const canSave = hasTotal && (data.categoryId && data.categoryId !== NEW_CAT || isNewCat && (data.newCategoryLabel || "").trim().length > 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "receipt-card"
  }, image && /*#__PURE__*/React.createElement("div", {
    className: "receipt-card-image"
  }, /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "Beleg"
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-head"
  }, /*#__PURE__*/React.createElement("input", {
    className: "receipt-merchant",
    value: data.haendler || "",
    placeholder: "H\xE4ndler unbekannt",
    onChange: e => update({
      haendler: e.target.value
    }),
    style: {
      border: "none",
      background: "transparent",
      outline: "none",
      flex: 1,
      fontFamily: "inherit"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "receipt-date"
  }, dateLabel)), /*#__PURE__*/React.createElement("div", {
    className: "receipt-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field total"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, /*#__PURE__*/React.createElement(ConfDot, {
    level: conf.gesamtbetrag
  }), "Gesamtbetrag"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    min: "0",
    value: data.gesamtbetrag != null ? data.gesamtbetrag : "",
    placeholder: "Nicht erkannt",
    onChange: e => {
      const v = e.target.value;
      update({
        gesamtbetrag: v === "" ? null : parseFloat(v)
      });
    },
    className: `receipt-field-value ${hasTotal ? "" : "empty"}`,
    style: {
      border: "none",
      background: "transparent",
      outline: "none",
      fontFamily: "var(--font-num)",
      padding: 0,
      width: "100%",
      textAlign: "right"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, /*#__PURE__*/React.createElement(ConfDot, {
    level: conf.datum
  }), "Datum"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: data.datum || "",
    onChange: e => update({
      datum: e.target.value
    }),
    className: "receipt-field-value",
    style: {
      border: "none",
      background: "transparent",
      outline: "none",
      fontFamily: "var(--font-num)",
      padding: 0,
      width: "100%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "MwSt. 19%"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    min: "0",
    value: data.mwst_19 != null && data.mwst_19 !== 0 ? data.mwst_19 : "",
    placeholder: "\u2014",
    onChange: e => {
      const v = e.target.value;
      update({
        mwst_19: v === "" ? 0 : parseFloat(v)
      });
    },
    className: `receipt-field-value ${Number(data.mwst_19) > 0 ? "" : "empty"}`,
    style: {
      border: "none",
      background: "transparent",
      outline: "none",
      fontFamily: "var(--font-num)",
      padding: 0,
      width: "100%"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-field-label"
  }, "MwSt. 7%"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    min: "0",
    value: data.mwst_7 != null && data.mwst_7 !== 0 ? data.mwst_7 : "",
    placeholder: "\u2014",
    onChange: e => {
      const v = e.target.value;
      update({
        mwst_7: v === "" ? 0 : parseFloat(v)
      });
    },
    className: `receipt-field-value ${Number(data.mwst_7) > 0 ? "" : "empty"}`,
    style: {
      border: "none",
      background: "transparent",
      outline: "none",
      fontFamily: "var(--font-num)",
      padding: 0,
      width: "100%"
    }
  }))), data._rawText && /*#__PURE__*/React.createElement("details", {
    className: "receipt-rawtext"
  }, /*#__PURE__*/React.createElement("summary", null, "Erkannter Rohtext (OCR)"), /*#__PURE__*/React.createElement("pre", null, data._rawText)), /*#__PURE__*/React.createElement("div", {
    className: "receipt-category"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-category-label"
  }, "Steuer-Kategorie"), data._katFromLearning && /*#__PURE__*/React.createElement("div", {
    className: "autokat-hint"
  }, "Kategorie aus deinem Verlauf vorgeschlagen"), /*#__PURE__*/React.createElement("div", {
    className: "steuerkat-grid"
  }, STEUER_KATEGORIEN.map(kat => /*#__PURE__*/React.createElement("button", {
    key: kat.id,
    type: "button",
    className: `steuerkat-option ${data.steuerkat === kat.id ? "active" : ""}`,
    onClick: () => update({
      steuerkat: kat.id
    }),
    style: data.steuerkat === kat.id ? {
      borderColor: kat.farbe,
      background: kat.bg
    } : {}
  }, /*#__PURE__*/React.createElement("span", {
    className: "steuerkat-badge",
    style: {
      background: kat.bg,
      color: kat.farbe
    }
  }, kat.kurz), /*#__PURE__*/React.createElement("div", {
    className: "steuerkat-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "steuerkat-title"
  }, kat.label), /*#__PURE__*/React.createElement("div", {
    className: "steuerkat-desc"
  }, kat.beschreibung)))))), /*#__PURE__*/React.createElement("div", {
    className: "receipt-category"
  }, /*#__PURE__*/React.createElement("div", {
    className: "receipt-category-label"
  }, "Budget-Kategorie"), /*#__PURE__*/React.createElement("select", {
    className: "receipt-cat-select",
    value: data.categoryId || "",
    onChange: e => handleCatChange(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "Kategorie w\xE4hlen\u2026"), categories.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.label)), /*#__PURE__*/React.createElement("option", {
    value: NEW_CAT
  }, "\uFF0B Neue Kategorie anlegen\u2026")), isNewCat && /*#__PURE__*/React.createElement("input", {
    className: "receipt-cat-new",
    placeholder: "Name der neuen Kategorie",
    value: data.newCategoryLabel || "",
    onChange: e => update({
      newCategoryLabel: e.target.value
    }),
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "receipt-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: onDiscard
  }, "Verwerfen"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: onAccept,
    disabled: !canSave,
    style: !canSave ? {
      opacity: 0.55,
      cursor: "not-allowed"
    } : {}
  }, "\xDCbernehmen")));
}

// ====================== Scanner-Modal (Hauptkomponente) ======================
function ReceiptScanner({
  open,
  onClose,
  currentMonth,
  categories,
  onAccept,
  receipts = []
}) {
  // step: "choose" | "camera" | "upload" | "crop" | "preview" | "result"
  const [step, setStep] = React.useState("choose");
  const [image, setImage] = React.useState(null); // { dataUrl, base64, mediaType }
  const [fileName, setFileName] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [statusText, setStatusText] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [dupWarning, setDupWarning] = React.useState(null);
  const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext !== false;

  // Reset beim Schließen
  React.useEffect(() => {
    if (!open) {
      setStep("choose");
      setImage(null);
      setFileName(null);
      setError(null);
      setLoading(false);
      setStatusText("");
      setResult(null);
      setDupWarning(null);
    }
  }, [open]);

  // Pre-Warm: Tesseract.js (Skript-Download + Sprachpaket + Worker-Init)
  // bereits beim Öffnen des Scanners im Hintergrund starten — nicht erst
  // beim Klick auf "Beleg erkennen". Dadurch laufen Download/Initialisierung
  // parallel zur Aufnahme/Auswahl des Belegs, was den gefühlten Wartevorgang
  // beim eigentlichen Scan deutlich verkürzt. Fehler werden hier ignoriert,
  // sie werden beim eigentlichen Scan erneut behandelt und angezeigt.
  React.useEffect(() => {
    if (!open) return;
    _ensureTesseract().catch(() => {});
  }, [open]);

  // Escape-Taste + Scroll-Lock
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
  const handleFile = async f => {
    setError(null);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Datei zu groß (max. 10 MB).");
      return;
    }
    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf";
    if (!isImage && !isPdf) {
      setError("Nur Bilder oder PDF werden unterstützt.");
      return;
    }
    try {
      setFileName(f.name);
      const data = isPdf ? await readPdf(f) : await compressImage(f);
      setImage(data);
      setStep(isPdf ? "preview" : "crop");
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
      const data = await analyzeReceiptLocal(image.dataUrl, image.mediaType, msg => setStatusText(msg) // Live-Fortschritt
      );
      setResult({
        haendler: data.haendler || "",
        datum: data.datum || "",
        gesamtbetrag: Number(data.gesamtbetrag) || 0,
        mwst_19: Number(data.mwst_19) || 0,
        mwst_7: Number(data.mwst_7) || 0,
        rechnungsnummer: data.rechnungsnummer || "",
        konfidenz: data.konfidenz || {},
        categoryId: "",
        newCategoryLabel: "",
        steuerkat: data.steuerkat || "privat"
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
      const {
        isDuplicate,
        match
      } = window.detectDuplicate(result, receipts);
      if (isDuplicate) {
        setDupWarning(match);
        return; // Banner anzeigen, noch nicht speichern
      }
    }
    setDupWarning(null);
    const ym = result.datum && result.datum.slice(0, 7) || currentMonth;
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
      imageType: image?.mediaType || null
    });
    onClose();
  };
  const goBack = () => {
    setError(null);
    if (step === "preview") {
      setImage(null);
      setStep("choose");
    } else if (step === "result") {
      setResult(null);
      setStep("preview");
    } else if (step === "crop") {
      setImage(null);
      setStep("choose");
    } else {
      setStep("choose");
    }
  };
  const isPdfPreview = image?.mediaType === "application/pdf";
  const headerTitle = step === "result" ? "Beleg prüfen" : step === "preview" ? "Vorschau" : step === "crop" ? "Zuschneiden" : step === "camera" ? "Beleg scannen" : step === "upload" ? "Datei hochladen" : "Beleg erfassen";
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
  }, /*#__PURE__*/React.createElement("h2", null, headerTitle), /*#__PURE__*/React.createElement("button", {
    className: "settings-close",
    onClick: onClose,
    "aria-label": "Schlie\xDFen"
  }, /*#__PURE__*/React.createElement(Icon.Close, null))), /*#__PURE__*/React.createElement("div", {
    className: "scanner-body"
  }, step === "choose" && /*#__PURE__*/React.createElement(ModeChooser, {
    cameraSupported: cameraSupported,
    onCamera: () => {
      setError(null);
      setStep("camera");
    },
    onUpload: () => {
      setError(null);
      setStep("upload");
    }
  }), step === "camera" && /*#__PURE__*/React.createElement(CameraView, {
    onCapture: data => {
      setImage(data);
      setFileName(null);
      setStep("crop");
    },
    onCancel: () => setStep("choose"),
    onError: msg => {
      setError(msg);
      setStep("choose");
    }
  }), step === "upload" && /*#__PURE__*/React.createElement(UploadZone, {
    onFile: handleFile,
    onBack: () => setStep("choose"),
    error: error
  }), step === "crop" && image && /*#__PURE__*/React.createElement(CropStep, {
    image: image.dataUrl,
    onConfirm: cropped => {
      setImage(cropped);
      setStep("preview");
    },
    onSkip: () => setStep("preview"),
    onBack: goBack
  }), step === "preview" && image && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "scanner-back",
    onClick: goBack
  }, /*#__PURE__*/React.createElement(Icon.Back, null), " ", /*#__PURE__*/React.createElement("span", null, "zur\xFCck")), /*#__PURE__*/React.createElement(PreviewStep, {
    image: image.dataUrl,
    isPdf: isPdfPreview,
    fileName: fileName,
    onRetake: goBack,
    onAnalyze: handleAnalyze,
    loading: loading,
    error: error,
    statusText: statusText
  })), step === "result" && result && /*#__PURE__*/React.createElement(React.Fragment, null, dupWarning && /*#__PURE__*/React.createElement("div", {
    className: "dup-warning"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dup-warning-title"
  }, "M\xF6gliches Duplikat"), /*#__PURE__*/React.createElement("div", {
    className: "dup-warning-body"
  }, /*#__PURE__*/React.createElement("strong", null, dupWarning.haendler || "Unbekannter Beleg"), " · ", dupWarning.datum ? fmtDate(dupWarning.datum) : "—", " · ", fmtEUR(dupWarning.gesamtbetrag || 0), " ist bereits gespeichert."), /*#__PURE__*/React.createElement("div", {
    className: "dup-warning-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn secondary",
    onClick: () => setDupWarning(null)
  }, "Abbrechen"), /*#__PURE__*/React.createElement("button", {
    className: "receipt-btn primary",
    onClick: handleAccept
  }, "Trotzdem speichern"))), /*#__PURE__*/React.createElement(ReceiptCard, {
    data: result,
    categories: categories || [],
    image: !isPdfPreview ? image?.dataUrl : null,
    onChange: setResult,
    onAccept: handleAccept,
    onDiscard: () => {
      setResult(null);
      setImage(null);
      setStep("choose");
    }
  })))));
}
(function _secureExport() {
  const _defs = {
    ReceiptScanner
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
