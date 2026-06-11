# Verbesserungen v2.1.0 (11. Juni 2026)

## 1. SteuerBot — NLU-Upgrade des deterministischen Fallbacks

Der Fallback versteht jetzt deutlich mehr Frage-Kombinationen — ohne KI-Backend:

### Slot-Extraktion (Zahlen direkt aus der Frage)
- „Ich fahre **25 km an 200 Tagen**" → rechnet mit diesen Werten, nicht nur mit Interview-Daten
- Erkennt: km, Arbeitstage, HO-Tage, „3 Tage die Woche" (→ ×46 Wochen), Brutto (auch „55k",
  „4.500 € im Monat" → ×12), Steuerklasse (auch römisch „Klasse III"), Kinderzahl (auch
  Wortzahlen), GdB, Spenden, Steuerjahr („für 2024" → rechnet mit 2024er-Werten)
- Antwort zeigt transparent: „🎯 *Aus deiner Nachricht übernommen: …*"

### Dialog-Gedächtnis (Folgefragen)
- „Was bleibt netto von 50.000?" → „und mit Steuerklasse 3?" → „was wäre bei 65000?" →
  „und bei 80k?" — jede Folgefrage behält Thema + bisherige Parameter und ändert nur das Neue
- Nackte Zahlen werden dem Kontext-Thema zugeordnet (bruttoNetto → €, pendler → km, …)
- Kontext gilt 30 Minuten pro Session

### Fuzzy-Matching (Stufe 3, Tippfehler-tolerant)
- Damerau-Levenshtein (Buchstabendreher = Distanz 1) gegen erweitertes Fachbegriff-Lexikon
- „miniojb", „homofice", „pendlerpauschae", „freistellungsauftrg" → korrekt erkannt
- Kennzeichnet Interpretation: „🔎 *Tippfehler-tolerant interpretiert als …*"

### Negations-Filter
- „Ich habe **kein** Homeoffice, aber pendle 30 km" → triggert nur Pendler, nicht Homeoffice
- „nicht verheiratet" / „keine Kinder" überschreibt Profil-Annahmen für diese Frage

### Szenario-Vergleiche (neu)
- „**55.000 oder 62.000** € brutto?" → Seite-an-Seite-Tabelle inkl. „X % vom Mehr-Brutto kommen an"
- „20 oder 35 km?" → Pendlerpauschale beider Strecken + Steuerersparnis
- „Klasse III bei **70k und Partner 30k**?" → **neuer III/V-vs-IV/IV-Rechner** mit gemeinsamem
  Jahres-Netto, Liquiditätsvorteil und Hinweis auf Faktorverfahren (§ 39f EStG)

### ELSTER-Direktantworten
- „Wo trage ich … ein?" → sofortige Zeilen-/Anlagen-Angabe vor der ausführlichen Antwort
  (Mapping für 16 Themen: Anlage N Z. 45, Z. 31–40, Anlage KAP, AV, Kind, ESt 1 A Z. 71–79 …)

**Getestet:** 29-Intent-Smoke + 20 Stress-Formulierungen + 4-stufige Dialog-Kette — alle grün.

## 2. Tax-Engine — Bugfixes & Präzision

### 🐛 Grenzsteuersatz-Bug (kritisch, app-weit)
`calcGrenzsteuersatz` bildete die Differenz zweier **gerundeter** ESt-Werte bei +1 € zvE —
Ergebnis war immer 0 oder 1 (= 0 % oder 100 %, geklemmt auf 14 %/45 %). Alle
„Ersparnis ≈ X € (Grenzsteuersatz ~Y %)"-Angaben in Bot, Optimizer und App waren dadurch
verfälscht. **Fix:** neue ungerundete Tarif-Funktion `_calcEStRaw` + 100-€-Differenzquotient.
Jetzt: 19,3 % bei 15 k · 28,4 % bei 30 k · 39,3 % bei 60 k · 42 %/45 % in den Flat-Zonen.

### Soli-Milderungszone (§ 4 S. 2 SolzG)
Bisher harter Sprung auf volle 5,5 % oberhalb der Freigrenze. Jetzt:
`min(5,5 % × ESt; 11,9 % × (ESt − Freigrenze))`. Beispiel 110 k brutto: Soli 262 € statt
fälschlich 1.240 €. Der Satz 11,9 % kommt aus `tax-config.json`
(neues Feld `soli_milderung_satz`, Fallback 0.119) — Prinzip „alle Werte aus der Config" bleibt.

### Steuerklasse V
Berücksichtigt jetzt WK-Pauschale + Sonderausgaben-Pauschale im Lohnsteuerabzug
(nur der Grundfreibetrag bleibt beim SK-III-Partner) — vorher wurde SK V deutlich überschätzt.

## 3. Infrastruktur
- `tax-config.json` (Root + dist): `soli_milderung_satz` ergänzt, Quellenliste + Datum aktualisiert.
  **Lade-Mechanik unverändert:** GitHub-Raw → lokal → localStorage → Inline-Bootstrap.
- Service Worker: Cache-Version v19 → v20 (Clients holen die neuen Dateien).
- `dist/` ist vollständig mitgepatcht (identische Pure-JS-Blöcke) — kein Rebuild nötig;
  `npm run build` reproduziert denselben Stand aus den `.jsx`-Quellen.
- package.json: 2.0.0 → 2.1.0.

## Ehrliche Einordnung („besser als jeder Steuerberater"?)
Der Bot rechnet die abgedeckten Standardfälle (Tarif §32a, Pendler, HO, §35a, KapESt,
Günstigerprüfung, Riester/Rürup/bAV, zumutbare Eigenbelastung …) jetzt schnell, konsistent
und mit tagesaktuellen Werten — darin schlägt er menschliche Reaktionszeit. Was er prinzipbedingt
**nicht** ersetzt: Haftung, Einzelfall-Gestaltung (Immobilien, Erbschaft, Betriebsvermögen),
Verhandlung mit dem Finanzamt. Die eingebauten Steuerberater-Hinweise bei hohen Beträgen
bleiben deshalb bewusst erhalten.

## Sinnvolle nächste Schritte
1. Vorsorgeaufwand-Höchstbetragsrechnung (§ 10 Abs. 4) in calcBruttoNetto verfeinern
2. Verpflegungsmehraufwand-Rechner (14 €/28 €) als eigener Intent mit Slot „Reisetage"
3. Unit-Test-Datei (`tests/engine.test.js`) ins Repo aufnehmen — Testfälle aus diesem Audit

---

# Verbesserungen v2.2.0 (11. Juni 2026) — „KI-Level“-Ausbau

## 1. Strukturierte Wissensdatenbank (`_WISSEN`) + Kompositions-Engine
Kern der Anforderung „Wissensdatenbank, die wie eine KI interpretiert wird“:
- **17 deklarative Wissens-Einträge** (Pendlerpauschale, Grundfreibetrag, Abgeltungsteuer,
  FSA, Teilfreistellung, Vorabpauschale, Günstigerprüfung, Riester, Rürup, bAV,
  zumutbare Eigenbelastung, §35a, GWG, AfA, Progressionsvorbehalt, Fünftelregelung,
  Progression, Dienstwagen) mit Schema: Definition · Funktionsweise · Werte ·
  Voraussetzungen · lohnt/lohnt-nicht · Beispiel · Eintrag (ELSTER) · Fallstricke ·
  situationsspezifische Fakten (Student/Azubi/selbständig/verheiratet/Rentner/Minijob) ·
  verwandte Konzepte.
- **Kompositions-Engine `_kbAntwort()`**: interpretiert die Einträge zur Laufzeit nach
  Fragetyp × Situation × Profil. „Was ist X?“, „Lohnt sich X?“, „Wo trage ich X ein?“,
  „Gilt X für mich als Student?“ → jeweils individuell komponierte Antwort aus
  denselben Fakten. Profil fließt ein (persönlicher Grenzsteuersatz pro Antwort).
- **Alle Beträge als {token}** → live aus `tax-config.json` aufgelöst. Neue Konzepte =
  ein Datensatz, kein neuer Code. Kollisions-Auflösung: spezifische KB-Konzepte
  schlagen generische Muster.

## 2. Statistischer Intent-Klassifikator (Stufe 2.5) — „Mini-ML“
- Zeichen-Trigramm-Vektorisierung + Kosinus-Ähnlichkeit gegen vortrainierte
  Zentroide aus **~240 Trainings-Paraphrasen** über 27 Themen (fastText-Prinzip,
  komplett offline, deterministisch).
- Versteht beliebige Formulierungen: „was kommt bei mir aufs konto“ → Brutto-Netto
  (sim 0,39), robust gegen Flexion/Wortstellung/Tippfehler.
- **Konfidenz-Logik wie eine KI**: sicher → antworten · unsicher → **Rückfrage**
  („1️⃣ Brutto-Netto oder 2️⃣ Doppelte Haushaltsführung?“) · Antwort „1“/„2“/Themenname
  ODER ein eindeutiger Wert („60k“ → Brutto-Netto) löst die Wahl auf.

## 3. Aktives Slot-Filling (Gegenfragen)
- Fehlt ein Pflichtwert (km/HO-Tage/Brutto), fragt der Bot konkret nach statt aufs
  Interview zu verweisen; die nächste Nachricht („ungefähr 47.000“) füllt den Wert
  und löst die Berechnung aus. Themenwechsel bricht die Erwartung sauber ab.

## 4. Optimierungs-Algorithmus v2: exakte sequenzielle Simulation
`simulateOptimalPlan()` ersetzt die naive „Betrag × Grenzsteuersatz“-Summe:
- **Greedy über den echten § 32a-Tarif**: jede Runde wird die Maßnahme mit der höchsten
  tatsächlichen Steuer-Differenz gewählt, das zvE fortgeschrieben (Progressionseffekt!).
- **WK-Pauschalen-Logik korrekt**: Werbungskosten-Maßnahmen wirken nur oberhalb der
  1.230-€-Schwelle — Profil-WK (Pendler + Homeoffice) füllen den Pool vorab, keine
  Doppelzählung.
- Wirkungs-Typologie: Werbungskosten / zvE-Abzug / direkte Ermäßigung (§ 35a) / Sondereffekt.
- Bot-Ausgabe „Was kann ich optimieren?“: **umsetzungs-optimale Reihenfolge** mit exaktem
  € je Schritt, kumulierter Ersparnis, ehrlicher Korrektur der naiven Summe
  (Beispiel-Profil: exakt 1.089 € statt naiv 1.359 €) und zvE-/Grenzsteuersatz-Verlauf.
- Export: `window.simulateOptimalPlan` (für künftige UI-Nutzung im 💡-Optimierer).

## 5. Weitere Fixes
- 🐛 `_calcPreciseGST`: Grundfreibetrag wurde **doppelt** abgezogen (einmal vorab, einmal
  im Tarif) → Grenzsteuersatz app-weit zu niedrig. Behoben.
- `buildUserProfile` akzeptiert `brutto` UND `jahresbrutto`.
- Service Worker v20 → v21, Version 2.2.0.

## Tests (alle grün)
29-Intent-Smoke · 48er KB-Matrix (16 Konzepte × 3 Fragetypen) · Klassifikator-Rückfrage-
Kette (mehrdeutig → „60k“ → Berechnung → „und in SK 4 mit 2 Kindern?“) · Slot-Filling-
Dialog · §35a-/ELSTER-Routing · Optimierer-Simulation gegen Handrechnung.

## Ehrliche Einordnung
Das ist die Obergrenze dessen, was ohne echtes Sprachmodell geht: statistische
Klassifikation + interpretierbare Wissensbasis + exakte Tarif-Simulation + Dialogverhalten
(Rückfragen, Gedächtnis, Slot-Filling). Ein echtes LLM-Verständnis liefert weiterhin nur
der Ollama-Modus. Und: schneller/konsistenter als ein Steuerberater in den Standardfällen — 
Haftung und Einzelfall-Gestaltung ersetzt das System bewusst nicht.
