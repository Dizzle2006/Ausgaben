#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# build.sh — Ausgaben Trocken Build-Script
# Kompiliert JSX → JS (Babel), kopiert Assets, erzeugt dist/index.html
# ohne Babel-CDN und ohne unsafe-eval in der CSP.
#
# Verwendung:
#   npm run build       (empfohlen)
#   bash build.sh
#
# Voraussetzung: npm install (einmalig)
# ══════════════════════════════════════════════════════════════════════

set -e

DIST="dist"
SRC_DIR="."

echo "🔨 Ausgaben Trocken — Build startet …"

# ── dist/ vorbereiten ──────────────────────────────────────────────────
rm -rf "$DIST"
mkdir -p "$DIST"

# ── JSX-Dateien mit Babel kompilieren ─────────────────────────────────
JSX_FILES=(
  tweaks-panel.jsx
  idb.jsx
  utils.jsx
  tax-engine.jsx
  elster-export.jsx
  tax-fristen.jsx
  tax-interview.jsx
  tax-einspruch.jsx
  components.jsx
  detail.jsx
  investments.jsx
  scanner-patches.jsx
  scanner.jsx
  crypto.jsx
  steuerbot.jsx
  budgetbot.jsx
  budget-heatmap.jsx
  monatsarchiv.jsx
  tax-optimizer.jsx
  voice-entry.jsx
  app.jsx
)

for f in "${JSX_FILES[@]}"; do
  out="${DIST}/${f%.jsx}.js"
  ./node_modules/.bin/babel "$f" --out-file "$out" --source-maps false 2>/dev/null
  echo "  ✓ $f → ${out##*/}"
done

# ── Statische Assets kopieren ─────────────────────────────────────────
cp styles.css        "$DIST/"
cp tax-config.json   "$DIST/"
cp manifest.webmanifest "$DIST/"
# Service Worker: .jsx-Pfade auf .js umschreiben (dist/ hat keine .jsx-Dateien)
sed 's/\.jsx/\.js/g' service-worker.js > "$DIST/service-worker.js"
cp -r icons          "$DIST/" 2>/dev/null || true
cp -r prompts        "$DIST/" 2>/dev/null || true
cp -r fonts          "$DIST/" 2>/dev/null || true

echo "  ✓ Assets kopiert"

# ── React lokal hosten (CDN-Unabhängigkeit / Offline-Zuverlässigkeit) ──
# Sicherheit: Keine CDN-Abhängigkeit zur Laufzeit.
# Die Dateien werden beim Build einmalig heruntergeladen und danach lokal
# aus dist/ geladen — kein unpkg.com im script-src der CSP nötig.
REACT_DIR="$DIST/libs"
REACT_URL="https://unpkg.com/react@18.3.1/umd/react.production.min.js"
REACTDOM_URL="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"
REACT_SRI="sha384-YT2GHBxbBQA6SCFfMRzHSZEiMBFKYKHFPEE7YrWCzMKoJlBHRiGbUKdA9R3Xajp"
REACTDOM_SRI="sha384-Bj+IdMCJMTZMYpVMVMmqLJI35M8dnrKMz3sVK5fC6aHe41z8tVtP0xWFkT3V+qI"

mkdir -p "$REACT_DIR"
REACT_OK=false
REACTDOM_OK=false

if curl -sL --max-time 15 "$REACT_URL" -o "$REACT_DIR/react.production.min.js" 2>/dev/null; then
  echo "  ✓ react.production.min.js heruntergeladen"
  REACT_OK=true
else
  echo "  ⚠️  React-Download fehlgeschlagen (kein Internet?) — CDN-Fallback in index.html"
fi

if curl -sL --max-time 15 "$REACTDOM_URL" -o "$REACT_DIR/react-dom.production.min.js" 2>/dev/null; then
  echo "  ✓ react-dom.production.min.js heruntergeladen"
  REACTDOM_OK=true
else
  echo "  ⚠️  ReactDOM-Download fehlgeschlagen (kein Internet?) — CDN-Fallback in index.html"
fi

# Wähle script-Pfade basierend auf ob Download erfolgreich war
if [ "$REACT_OK" = true ] && [ "$REACTDOM_OK" = true ]; then
  REACT_SCRIPT='<script src="libs/react.production.min.js"></script>'
  REACTDOM_SCRIPT='<script src="libs/react-dom.production.min.js"></script>'
  # CSP ohne unpkg.com (lokal = sicherer). 'wasm-unsafe-eval' wird vom
  # Tesseract-OCR-Kern für WebAssembly.instantiate() benötigt — ohne dieses
  # Token blockieren moderne Browser die WASM-Kompilierung und das dadurch
  # ausgelöste (von tesseract.js nicht abgefangene) Promise hängt für immer,
  # was wie ein endloser "OCR-Initialisierung"-Hänger ohne Fehlermeldung wirkt.
  CSP_SCRIPT_SRC="script-src 'self' 'wasm-unsafe-eval'"
  echo "  ✓ Lokales React aktiv — CDN aus CSP entfernt"
else
  REACT_SCRIPT="<script src=\"https://unpkg.com/react@18.3.1/umd/react.production.min.js\" integrity=\"$REACT_SRI\" crossorigin=\"anonymous\"></script>"
  REACTDOM_SCRIPT="<script src=\"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js\" integrity=\"$REACTDOM_SRI\" crossorigin=\"anonymous\"></script>"
  CSP_SCRIPT_SRC="script-src 'self' 'wasm-unsafe-eval' https://unpkg.com"
  echo "  ⚠️  CDN-Fallback aktiv (React lokal nicht verfügbar)"
fi

# ── Tesseract.js (lokale OCR) lokal hosten ────────────────────────────
# Wie React: Worker-Skript, WASM-Kern (LSTM-only/best_int — kleinste Variante,
# passend zu OEM.LSTM_ONLY in scanner.jsx) und das deutsche Sprachpaket werden
# einmalig heruntergeladen und same-origin ausgeliefert. Vermeidet Laufzeit-
# Abhängigkeit von cdn.jsdelivr.net (CORS/CSP-Probleme bei Cross-Origin-
# Workern, v.a. iOS Safari, führten zu endlosem "OCR wird initialisiert…").
TESS_VERSION="5.1.1"
TESS_DIR="$DIST/libs/tesseract"
mkdir -p "$TESS_DIR/lang"
TESS_OK=true

fetch_tess() {
  if ! curl -sL --max-time 120 "$1" -o "$2" 2>/dev/null; then
    TESS_OK=false
  fi
}

fetch_tess "https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/tesseract.min.js" "$TESS_DIR/tesseract.min.js"
fetch_tess "https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/worker.min.js" "$TESS_DIR/worker.min.js"
fetch_tess "https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESS_VERSION}/tesseract-core-simd-lstm.wasm.js" "$TESS_DIR/tesseract-core-simd-lstm.wasm.js"
fetch_tess "https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESS_VERSION}/tesseract-core-lstm.wasm.js" "$TESS_DIR/tesseract-core-lstm.wasm.js"
fetch_tess "https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0_best_int/deu.traineddata.gz" "$TESS_DIR/lang/deu.traineddata.gz"
fetch_tess "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz" "$TESS_DIR/lang/eng.traineddata.gz"

if [ "$TESS_OK" = true ]; then
  CSP_OCR_SRC=""
  echo "  ✓ Tesseract.js (OCR) lokal gebündelt — cdn.jsdelivr.net aus CSP entfernt"
else
  CSP_OCR_SRC=" https://cdn.jsdelivr.net"
  echo "  ⚠️  Tesseract.js-Download unvollständig (kein Internet?) — jsdelivr-Fallback in CSP"
fi

# ── index.html ohne Babel, ohne unsafe-eval ───────────────────────────
# index.html mit dynamischer CSP + React-Pfaden generieren
cat > "$DIST/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <!-- CSP: unsafe-eval + unsafe-inline(scripts) entfernt; React + Tesseract-OCR
       lokal gebündelt (siehe build.sh). jsdelivr.net nur als Fallback, falls
       der Build ohne Internetverbindung lief. blob: für den OCR-Worker. -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${CSP_SCRIPT_SRC}${CSP_OCR_SRC}; style-src-elem 'self'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://raw.githubusercontent.com${CSP_OCR_SRC} http://localhost:11434 blob:; worker-src 'self' blob:; manifest-src 'self'; frame-src 'none'; form-action 'self'; object-src 'none'; base-uri 'self';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Ausgaben Trocken</title>
  <meta name="description" content="Persönliches Budget & Investment-Tracker" />

  <!-- PWA Manifest -->
  <link rel="manifest" href="manifest.webmanifest" />
  <meta name="theme-color" content="#f1ead8" />

  <!-- iOS / Safari -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Ausgaben" />
  <meta name="mobile-web-app-capable" content="yes" />
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="192x192" href="icons/icon-192.png" />
  <link rel="apple-touch-icon" sizes="512x512" href="icons/icon-512.png" />

  <!-- Favicons -->
  <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="64x64" href="icons/favicon-64.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png" />

  <!-- Fonts lokal (kein Google-Request) -->
  <link rel="stylesheet" href="fonts/fonts.css" />

  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root" style="color: rgb(0, 0, 0); font-family: &quot;Open Sans&quot;; font-weight: 400"></div>

  <!-- React (lokal wenn verfügbar, sonst CDN mit SRI) -->
  ${REACT_SCRIPT}
  ${REACTDOM_SCRIPT}

  <!-- Vorkompilierte App (kein type="text/babel" mehr) -->
  <script src="tweaks-panel.js"></script>
  <script src="idb.js"></script>
  <script src="utils.js"></script>
  <script src="tax-engine.js"></script>
  <script src="elster-export.js"></script>
  <script src="tax-fristen.js"></script>
  <script src="tax-interview.js"></script>
  <script src="tax-einspruch.js"></script>
  <script src="components.js"></script>
  <script src="detail.js"></script>
  <script src="investments.js"></script>
  <script src="scanner-patches.js"></script>
  <script src="scanner.js"></script>
  <script src="crypto.js"></script>
  <script src="steuerbot.js"></script>
  <script src="budgetbot.js"></script>
  <script src="budget-heatmap.js"></script>
  <script src="monatsarchiv.js"></script>
  <script src="tax-optimizer.js"></script>
  <script src="voice-entry.js"></script>
  <script src="app.js"></script>

  <!-- PWA service worker registration (externes File — kein inline script für CSP) -->
  <script src="register-sw.js"></script>
</body>
</html>
HTMLEOF

# register-sw.js als externe Datei (CSP: script-src 'self' ohne unsafe-inline)
cat > "$DIST/register-sw.js" << 'SWEOF'
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      // updateViaCache: "none" -> Browser darf den HTTP-Cache (GitHub Pages:
      // Cache-Control: max-age=600) NIEMALS für service-worker.js verwenden.
      // Ohne das kann registration.update() bis zu 10 Minuten lang dieselbe
      // alte SW-Datei aus dem HTTP-Cache bekommen und denkt, es gäbe kein Update.
      .register("service-worker.js", { updateViaCache: "none" })
      .then(function (registration) {
        // Sofort auf eine neue Version prüfen (umgeht den 24h-Browser-Intervall)
        registration.update();

        // Bei jedem Sichtbarwerden der App (z.B. PWA aus Hintergrund geholt)
        // erneut auf Updates prüfen — wichtig für lang offene PWA-Tabs.
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") registration.update();
        });

        // Reload, sobald eine neue SW-Version übernommen hat (skipWaiting + clients.claim
        // im Service Worker führen dazu, dass "controllerchange" feuert)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(function (err) { console.warn("SW registration failed:", err); });
  });
}
SWEOF

echo "  ✓ dist/index.html generiert (CSP: ${CSP_SCRIPT_SRC})"
echo ""
echo "✅ Build fertig → dist/"
echo "   Starte die App mit: npx serve dist  (oder direkt im Browser öffnen)"
echo ""
echo "⚠️  DEPLOYMENT: Immer dist/ verwenden — niemals Root-index.html deployen!"
