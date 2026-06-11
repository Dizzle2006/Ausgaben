# Ausgaben Trocken – als App installieren

Die App ist eine **PWA (Progressive Web App)**. Das heißt: Du musst sie irgendwo im Web hosten, kannst sie dann aber wie eine echte App auf iPhone und Macbook installieren – mit eigenem Icon, ohne Browser-Chrome, offline-fähig.

---

## Schritt 1: Hosten (einmalig, ~2 Minuten)

### Empfohlen: Netlify Drop (kostenlos, kein Account nötig)

1. Geh auf **https://app.netlify.com/drop**
2. Zieh den entpackten Ordner `Ausgaben-Trocken` einfach in das Fenster
3. Du bekommst sofort eine URL, z. B. `https://wundervoll-foo-123.netlify.app`
4. Falls du willst: Account erstellen (gratis) → URL bleibt für immer dieselbe und du kannst sie umbenennen, z. B. `ausgaben-trocken.netlify.app`

### Alternativen (auch kostenlos)
- **Vercel** (`vercel.com`) – ähnlich easy, Account nötig
- **Cloudflare Pages** – wenn du schon Cloudflare nutzt
- **GitHub Pages** – wenn du eh git nutzt

⚠️ Wichtig: Es muss **HTTPS** sein. Datei direkt aus Finder/Dateien doppelklicken funktioniert NICHT für PWA-Install.

---

## Schritt 2: Auf iPhone installieren

1. Öffne die URL in **Safari** (nicht Chrome – iOS unterstützt PWA nur in Safari)
2. Tippe auf das **Teilen-Icon** (Quadrat mit Pfeil nach oben)
3. Scroll runter zu **„Zum Home-Bildschirm"**
4. Tippe **Hinzufügen**
5. Das App-Icon erscheint auf deinem Home-Bildschirm. Beim Öffnen startet die App im Vollbild ohne Adressleiste.

---

## Schritt 3: Auf Macbook installieren

### Safari (macOS 14+)
1. Öffne die URL in Safari
2. **Ablage → Zum Dock hinzufügen…**
3. Das App-Icon landet im Dock. Klick startet die App in einem eigenen Fenster.

### Chrome / Edge / Brave
1. Öffne die URL
2. Rechts in der Adressleiste erscheint ein **Install-Icon** (kleiner Bildschirm mit Pfeil)
3. Klick → **Installieren**
4. App liegt im Programme-Ordner und kann ans Dock gepinnt werden.

---

## Daten teilen zwischen Handy und Mac?

Aktuell werden alle Daten **lokal pro Gerät** im Browser gespeichert (localStorage). Das heißt:
- Macbook und iPhone haben separate Daten
- Daten bleiben auch bei Internet-Ausfall verfügbar
- Du verlierst sie nur, wenn du Browser-Daten manuell löschst

Falls du **Daten synchronisieren** willst (Mac ↔ iPhone), bräuchten wir ein kleines Backend (z. B. Supabase, kostet 0€ für kleinen Use Case). Sag Bescheid, dann baue ich das.

Als Zwischenlösung kann ich dir auch einen **Export/Import** als JSON-Datei einbauen – dann kopierst du sie manuell rüber.

---

## Updates ausrollen

Wenn ich Änderungen mache und du sie aktualisieren willst:
1. Neue Version hochladen (auf Netlify einfach Ordner draufziehen)
2. App auf Handy/Mac einmal öffnen, kurz warten, einmal schließen + neu öffnen
3. Service Worker holt die neue Version automatisch

Der Service Worker cached so, dass die App **offline funktioniert** und beim Start sofort lädt.
