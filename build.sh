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
  # CSP ohne unpkg.com (lokal = sicherer)
  CSP_SCRIPT_SRC="script-src 'self'"
  echo "  ✓ Lokales React aktiv — CDN aus CSP entfernt"
else
  REACT_SCRIPT="<script src=\"https://unpkg.com/react@18.3.1/umd/react.production.min.js\" integrity=\"$REACT_SRI\" crossorigin=\"anonymous\"></script>"
  REACTDOM_SCRIPT="<script src=\"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js\" integrity=\"$REACTDOM_SRI\" crossorigin=\"anonymous\"></script>"
  CSP_SCRIPT_SRC="script-src 'self' https://unpkg.com"
  echo "  ⚠️  CDN-Fallback aktiv (React lokal nicht verfügbar)"
fi

# ── index.html ohne Babel, ohne unsafe-eval ───────────────────────────
# index.html mit dynamischer CSP + React-Pfaden generieren
cat > "$DIST/index.html" << HTMLEOF
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <!-- CSP: unsafe-eval + unsafe-inline(scripts) entfernt; React lokal wenn verfügbar -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${CSP_SCRIPT_SRC}; style-src-elem 'self'; style-src-attr 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://raw.githubusercontent.com http://localhost:11434 blob:; worker-src 'self'; manifest-src 'self'; frame-src 'none'; form-action 'self'; object-src 'none'; base-uri 'self';">
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
      .register("service-worker.js")
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
