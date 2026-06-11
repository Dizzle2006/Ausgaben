# App-Audit: Ausgaben Trocken — Vollständige Prüfung
**Datum:** 26. Mai 2026  
**Geprüfte Dateien:** steuerbot.js, tax-engine.js, tax-optimizer.js, tax-interview.js, budgetbot.js/jsx, crypto.jsx, idb.jsx, index.html, service-worker.js  

---

## 1. GESAMTBEWERTUNG

Die App ist technisch sehr gut gebaut. Der Code ist strukturiert, gut kommentiert und zeigt einen ernsthaften Anspruch an Qualität. Die meisten Schwachstellen sind mittlerer Natur — keine kritischen Sicherheitslücken, keine Datenlecks im klassischen Sinne, aber einige Bereiche die verbessert werden sollten.

**Gesamtnote: 8/10**

---

## 2. STEUERBOT — FUNKTIONALITÄT & QUALITÄT

### Ist er voll funktionsfähig?

**JA, mit Einschränkungen.**

Der Steuerbot hat zwei Modi:
- **Ollama (lokal):** Vollwertiger LLM-Assistent über `http://localhost:11434` — nur wenn der Nutzer Ollama installiert hat.
- **Deterministischer Fallback:** Immer aktiv, ohne KI. 28 Themenbereiche, direkt aus der Tax-Engine.

Der deterministische Fallback deckt alle zentralen Steuerfelder ab (Homeoffice, Pendler, Brutto/Netto, Kapital, Steuerklassen, §35a, Fristen, Riester, Rürup, bAV, Außergewöhnliche Belastungen, Studenten, doppelte Haushaltsführung usw.). Er ist vollständig funktionsfähig ohne Internet oder KI.

**Einschränkung:** Ohne Ollama ist der Bot kein freier Gesprächspartner — er antwortet nur auf bekannte Intents. Für unbekannte Fragen landet alles im "default"-Handler.

### Erfüllt er die Funktion eines sehr guten Steuerberaters?

**Teils ja, teils nein.**

**Stärken:**
- Kennt alle relevanten §§ des EStG korrekt (§9, §10, §32a, §33, §33b, §35a, §10a, §3 Nr.63 etc.)
- Zitiert Paragraphen und erklärt sie verständlich
- Rechnet mit echten Nutzerdaten, nicht mit Fantasiezahlen
- Aktuelle Freibeträge für 2024/2025/2026 (live aus tax-config.json via GitHub)
- Guardrails: fragt aktiv nach wenn Daten fehlen (Bundesland für Kirchensteuer, Brutto für Berechnungen)
- Soli-Freigrenze, Grenzsteuersatz, BBG-Kappung: alles korrekt implementiert

**Schwächen:**
- **Kein echter Dialogfluss** im Fallback-Modus: Der Bot kann keine mehrstufigen Konversationen aufbauen (z.B. "Was kostet mich das?" → "Und wenn ich verheiratet wäre?")
- **Günstigerprüfung §32d:** Im Optimizer vorhanden, aber kein eigenständiger Handler im deterministischen Chat
- **Abgabepflicht-Prüfung** (§46 EStG) fehlt — der Bot kann nicht sagen ob jemand zur Abgabe verpflichtet ist

### Geht der Algorithmus wirklich auf den Nutzer ein?

**JA, deutlich besser als ein generisches Tool.**

Der `buildUserContext()`-Block ist einer der stärksten Teile der App: Bevor der Bot antwortet, wird ein strukturierter Kontext-Block mit echten Nutzerdaten injiziert — Jahresbrutto, Grenzsteuersatz, Homeoffice-Tage, Pendler-km, Belege nach Kategorie, Kapitalerträge, Bundesland, Kirchensteuerpflicht. Der Bot rechnet immer mit diesen echten Werten, nie mit Platzhaltern.

---

## 3. TAX-OPTIMIZER — SCHLUPFLOCH-FINDER

### Findet er echte Schlupflöcher?

**JA, und erstaunlich vollständig.**

Der Optimizer (`findOpportunities()`) prüft über 40 individuelle Steueroptimierungen:

- Pendlerpauschale mit korrekter Aufteilung nach Bürotagen/HO-Tagen
- Homeoffice-Pauschale mit Max-Tages-Kappung
- **§35a Abs.2 + Abs.3**: Getrennte Berechnung für DL und Handwerker, mit Jahres-Ausschöpfungs-Analyse und "Rest ins Folgejahr verschieben"-Hinweis — echtes Steuerberater-Wissen
- **Verlustverrechnungstopf**: Getrennte Berechnung für Aktien vs. Sonstige (§20 Abs.6 EStG) — korrekt und nicht trivial
- **Günstigerprüfung §32d Abs.6** mit echter Grenzsteuersatz-Berechnung
- **Kirchensteuer auf Kapitalerträge als Sonderausgabe** — ein echter "versteckter" Vorteil
- Rückwirkende Steuererklärungen mit 4-Jahres-Frist
- Kontoführungsgebühren-Pauschale (16 €)
- Telefon/Internet 20%-Regel
- Gewerkschaftsbeitrag ab 2026 (neue Regelung korrekt implementiert!)
- Pflegepauschbetrag §33b Abs.6
- Behinderten-Pauschbetrag mit GdB-gestaffelter Berechnung
- Studenten: korrekte Unterscheidung Erst- vs. Zweitstudium (SA vs. WK)

### Sind die Schlupflöcher in der Realität anwendbar?

**JA, alle implementierten Strategien sind real und rechtskonform.**

Geprüfte Werte stimmen mit geltendem Recht überein:
- Tarifzonen §32a EStG 2024/2025/2026: ✅ korrekt (BMF-Formelkoeffizienten)
- Homeoffice-Pauschale 6€/Tag, max 210 Tage: ✅
- Pendlerpauschale 0,38€/km ab 2026 (vereinheitlicht): ✅
- Sparerpauschbetrag 1.000€/2.000€: ✅
- §35a Grenzen: ✅
- Verlustverrechnungstopf Aktien getrennt: ✅

**Kleine Ungenauigkeit:** Der ROI-Score-Algorithmus (`calcROIScore`) ist ein heuristischer Score, kein echter ROI. Für eine Priorisierungs-UI akzeptabel, solange das kommuniziert wird.

---

## 4. BUDGETBOT — BEWERTUNG

**Sehr solide gebaut.**

- **Alert-Engine**: 4 Prioritätsstufen (Kritisch / Warnung / Tipp / OK), mit Muster-Erkennung über 3 Monate
- **Bedarfsanalyse**: Nettoeinkommen, Sparziel, Notgroschen — verschlüsselt in localStorage
- **Context-Builder**: Aggregiert Kategorie-Ausgaben, Monatssummen und 3-Monats-Historie
- **19 Intents** mit Regex + semantischem Keyword-Fallback

**Schwäche:** Der `forecast`-Intent wird erkannt, aber es gibt keinen echten Hochrechnungs-Handler. Die vorhandene 3-Monats-Historie würde eine echte Prognose ermöglichen — das Potenzial liegt brach. Einige andere Intents (schulden, versicherung) geben ebenfalls nur generische Antworten.

---

## 5. SICHERHEITSANALYSE

### Datenlecks: KEINE identifiziert

- Kein Cloud-Backend, kein Proxy, keine externen APIs (außer GitHub-Raw für tax-config.json und optionalem localhost:11434)
- Keine Tracking-Skripte, keine Analytics
- Keine Google Fonts (lokal geladen)
- Die einzige externe Verbindung ist `raw.githubusercontent.com` für Steuerkonstanten — keine Nutzerdaten

### Verschlüsselung: HERVORRAGEND

- AES-256-GCM mit zufälligem IV pro Verschlüsselung ✅
- PBKDF2, 600.000 Iterationen, SHA-256 (OWASP 2024) ✅
- 32-Byte PBKDF2-Salt (NIST SP 800-132) ✅
- Brute-Force-Schutz: 3 Fehlversuche → exponentieller Backoff (30s, 60s, 120s…) ✅
- Dual-Storage Lock-State (localStorage + sessionStorage) — Manipulation durch Löschen eines Stores wird erkannt ✅
- FNV-1a Prüfsumme auf Lock-State ✅
- Read-only Getter-Closure für `window.__decryptedInterviewAnswers` ✅
- `Object.freeze()` auf Tax-Config ✅

### CSP: GUT, aber eine Lücke

```
script-src 'self' https://unpkg.com
```

React ist mit SRI-Hash eingebunden (`integrity="sha384-..."`), aber der CSP-Header erzwingt `require-sri-for` nicht. Bei einem CDN-Supply-Chain-Angriff auf unpkg.com würde der Browser das Skript laden, bevor er den Hash prüft — in manchen Konfigurationen.

### Service Worker: KORREKT

- `tax-config.json` wird bewusst nie gecacht ✅
- Stale-while-revalidate für lokale Assets ✅
- React von CDN wird cache-first gecacht — bei einem kritischen React-Update bleibt die alte Version im Cache (kleines Problem)

### Absicherung gegen Eindringen: GUT

- Keine Server-Komponente → kein klassischer Angriffsvektor ✅
- PIN-Gate blockiert komplette UI ✅
- Kein `eval()`, kein `innerHTML` mit User-Input erkennbar ✅
- `frame-src 'none'` (kein Clickjacking) ✅
- `form-action 'self'` ✅

---

## 6. SCHWACHSTELLEN (PRIORISIERT)

### 🔴 Mittel

**M1 — CSP: `script-src unpkg.com` ohne `require-sri-for`**  
SRI-Hashes sind gesetzt, aber die CSP erzwingt sie nicht formal. Ein kompromittiertes CDN könnte Schadcode liefern.  
→ `require-sri-for script style` hinzufügen, oder React lokal bundlen (dann `unpkg.com` aus CSP entfernen).

**M2 — PIN-Mindestlänge 4 Zeichen zu kurz**  
4-stellige PINs haben nur 10.000 Kombinationen. PBKDF2/600k macht Offline-Angriffe langsam, aber nicht unmöglich bei lokalem Zugriff auf die gestohlene Gerätedatei.  
→ Mindestlänge auf 6 erhöhen oder Passphrase empfehlen.

### 🟡 Klein

**K1 — `window.TAX_CONFIG_RAW` global beschreibbar**  
Der normalisierte Wert ist frozen, aber `TAX_CONFIG_RAW` selbst kann von beliebigem JS überschrieben werden. Bei einem XSS könnten Steuerwerte manipuliert werden.  
→ `Object.defineProperty(window, 'TAX_CONFIG_RAW', { writable: false })` nach erstem Setzen.

**K2 — Forecast-Handler im BudgetBot fehlt**  
Intent wird erkannt, aber die Antwort ist generisch. Echte Hochrechnung mit 3-Monats-Daten wäre möglich und wertvoll.

**K3 — Günstigerprüfungs-Handler im Steuerbot-Fallback fehlt**  
Intent `guenstiger` ist definiert und wird erkannt, fällt aber auf `default` zurück.

**K4 — Grenzsteuersatz-Inkonsistenz**  
`buildUserContext()` nutzt `brutto * 0.80` als Näherung, `_calcPreciseGST()` nutzt die exakte BBG-Kappung. Beide Werte werden dem Bot präsentiert und können abweichen.

**K5 — localStorage-Quota-Fehler still ignoriert**  
`try { localStorage.setItem(...) } catch {/* quota */}` — bei vollem Storage werden Daten ohne Nutzer-Feedback nicht gespeichert.

---

## 7. STÄRKEN (HERVORHEBUNGEN)

1. **Vollständige Offline-Fähigkeit** — INLINE_BOOTSTRAP + Service Worker + deterministischer Fallback
2. **Datenschutz by Design** — Keine Cloud, keine Telemetrie, nur GitHub-Raw für Steuerkonstanten
3. **Hervorragende Verschlüsselung** — Über dem Industrie-Standard für Browser-Apps
4. **Live-Steuerkonstanten aus GitHub** — Immer aktuell ohne App-Update
5. **Profil-basierter Optimizer** — Individuell nach Beschäftigungstyp, Studiumstyp etc. zugeschnitten
6. **Korrekte §20 Abs.6-Implementierung** — Getrennte Verlustverrechnung Aktien/Sonstige (häufige Fehlerquelle in anderen Apps)
7. **Günstigerprüfung §32d** mit echter Grenzsteuersatz-Differenzberechnung
8. **2026-Steuerrecht aktuell** — Gewerkschaftsbeitrag-Neuregelung, vereinheitlichte Pendlerpauschale korrekt

---

## 8. EMPFEHLUNGEN (PRIORITÄT)

| Priorität | Maßnahme |
|-----------|----------|
| 🔴 Mittel | `require-sri-for script` in CSP, oder React lokal bundlen |
| 🔴 Mittel | PIN-Mindestlänge auf 6 Zeichen erhöhen |
| 🟡 Klein | `window.TAX_CONFIG_RAW` nach Setzen mit `Object.defineProperty` einfrieren |
| 🟡 Klein | Forecast-Handler im BudgetBot implementieren (echte Hochrechnung) |
| 🟡 Klein | Günstigerprüfungs-Handler im Steuerbot-Fallback ergänzen |
| 🟢 Nice-to-have | `buildUserContext()` auf `_calcPreciseGST()` umstellen für konsistenten Grenzsteuersatz |
| 🟢 Nice-to-have | localStorage-Quota-Fehler bei Bedarfsanalyse sichtbar machen |
| 🟢 Nice-to-have | Abgabepflicht-Prüfung (§46 EStG) als eigenen Intent im Steuerbot |
