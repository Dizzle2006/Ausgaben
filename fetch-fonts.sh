#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# fetch-fonts.sh — Google Fonts lokal herunterladen (Einmalvorgang)
#
# Führe dieses Script einmal aus:
#   bash fetch-fonts.sh
#   npm run fetch-fonts    (alternativ)
#
# Danach: fonts/ enthält .woff2-Dateien und fonts/fonts.css
# → index.html lädt Fonts lokal, kein Request an Google mehr.
# ══════════════════════════════════════════════════════════════
set -e

FONTS_DIR="fonts"
mkdir -p "$FONTS_DIR"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
GFONTS_URL="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"

echo "📥 Lade Font-CSS..."
CSS=$(curl -sfL -A "$UA" "$GFONTS_URL")
if [ -z "$CSS" ]; then
  echo "❌ Fehler: Google Fonts nicht erreichbar. Netz prüfen."
  exit 1
fi

echo "📥 Lade Woff2-Dateien..."
# macOS-kompatibel: grep -oE statt grep -oP
URLS=$(echo "$CSS" | grep -oE 'https://[^)]+')

if [ -z "$URLS" ]; then
  echo "❌ Fehler: Keine Font-URLs in der CSS gefunden."
  exit 1
fi

while IFS= read -r url; do
  # macOS-kompatibel: shasum statt md5sum
  HASH=$(echo -n "$url" | shasum | cut -c1-8)
  FILE="$FONTS_DIR/${HASH}.woff2"
  curl -sfL -A "$UA" "$url" -o "$FILE"
  # sed mit | als Trennzeichen, um Konflikte mit / in URLs zu vermeiden
  CSS=$(echo "$CSS" | sed "s|$url|fonts/${HASH}.woff2|g")
  echo "  ✓ ${HASH}.woff2"
done <<< "$URLS"

printf "/* Lokal eingebettete Google Fonts — kein Metadaten-Leak (Prio 2b) */\n%s\n" "$CSS" > "$FONTS_DIR/fonts.css"

COUNT=$(ls "$FONTS_DIR"/*.woff2 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "✅ Fertig! fonts/ enthält $COUNT Font-Dateien."
echo "   Starte die App — keine Google-Anfragen mehr."
