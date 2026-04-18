# Mashia App


>>> **Also: Ziel ist nicht Gefangenschaft, sondern "Warum sollte ich je zurück?"**

![[livestock_platform_system_layers.svg]]

## Die vier Schichten – und was der echte "Moat" ist

Lies die Architektur von unten nach oben, denn der eigentliche Wert liegt unten:

**Schicht 1 – Nutzer:** Du hast hier bereits einen kritischen strategischen Fehler vermieden, der die meisten Gründer killt: Du willst _nicht_ Broker ausschließen, sondern einbeziehen. Das ist **klug**. Broker haben bereits die Beziehungen zu den Bauern – sie sind deine Abkürzung zum Markt, nicht dein Feind. Mach sie zu Power-Usern, gib ihnen ein eigenes Broker-Dashboard.

**Schicht 2 – Marktplatz-Core:** Das ist, was jeder baut. Listings, Chat, Bezahlung. Nichts Besonderes. Hier gewinnt man _nicht_.

**Schicht 3 – Moat-Services:** Hier fängt dein echter Vorsprung an. _Das_ ist die Antwort auf deine ursprüngliche Frage "wie binde ich die Leute ans System". Nicht durch künstliche Schwierigkeiten beim Ausstieg, sondern weil du vier Dinge anbietest, die sie **nirgendwo sonst zusammen** bekommen:

- **Veterinär-Zertifizierung** löst dein "Vertrauen/Betrug"-Problem – ein Käufer zahlt mehr für ein Tier mit digitalem Gesundheitszertifikat
- **Integrierte Logistik** löst dein "Transport-Chaos" – entweder eigene Partner oder Uber-Modell für LKW-Fahrer
- **Reputation** – ein Bauer mit 200 erfolgreichen Verkäufen und 4,8-Sterne-Rating wird diese Reputation _nie_ auf eine Konkurrenz-App mitnehmen können. Das ist dein Lock-in – _freiwillig_, weil wertvoll.
- **Finanzierung** (später): Sobald du Handelsdaten hast, weißt du welcher Bauer kreditwürdig ist – Banken wissen das nicht.

**Schicht 4 – Daten-Asset:** Das ist der Endgame. Nach 2 Jahren hast du den einzigen echten **Live-Preisindex für Vieh im Golf**. Bauern werden die App öffnen, nur um aktuelle Preise zu checken – auch wenn sie gar nicht verkaufen wollen. Dieser Preisindex ist so wertvoll wie die App selbst.

---

## Die Reihenfolge, in der du bauen musst

Ich sage das sehr deutlich, weil hier die meisten scheitern: **Baue nicht alles auf einmal.** Alles, was du oben siehst, ist die Ziel-Architektur. Aber die erste Version muss radikal kleiner sein.

**Phase 0 – Marktvalidierung (4–6 Wochen, null Code):** Bevor eine einzige Zeile Code geschrieben wird, brauchst du Gespräche mit:

- 20 Bauern (wie verkaufen sie heute? Wie viel Zeit verlieren sie? Zu welchem Preis?)
- 10 Brokern (wie viel Marge? Was ist ihr Schmerz?)
- 5 Schlachthöfen/Restaurants (wie beschaffen sie? Zuverlässigkeit-Probleme?)

Ohne diese Gespräche baust du blind. Mit ihnen weißt du, welches Feature zuerst.

**Phase 1 – MVP (3–4 Monate):** Nur eine Stadt/Region. Nur Schafe (nicht Kühe + Schafe + Kamele). Nur drei Features: Listing + Chat + Preis-Transparenz. Kein Escrow, keine Logistik, keine Vet-Zertifikate. Nur: Können Verkäufer und Käufer finden und handeln? Funktioniert der Matchmaking-Mechanismus?

**Phase 2 – Vertrauensschicht (Monat 4–9):** Jetzt kommt Veterinär-Verifikation und optional Escrow. Das ist, wann du beginnst, traditionelle Methoden _echt_ zu schlagen – weil niemand sonst die Gesundheit garantieren kann.

**Phase 3 – Logistik & Skalierung (Monat 9+):** Transport-Integration, zweite Stadt, dann Saudi/UAE-Expansion.

**Phase 4 – Daten-Monetarisierung (Jahr 2+):** Preisindex als B2B-Produkt, Finanzierung für Bauern basierend auf Handelshistorie.

## Deine Situation ist besser, als du denkst

Du hast die drei Dinge, die wirklich zählen – und die, die nur Geld kaufen kann, fehlen dir (das ist ok):

**Was du hast (die schwer erwerbbaren Assets):**

- **Marktzugang durch Familie/Kontakte** – das ist Gold. Die meisten Startups zahlen zehntausende Euro und verbringen Monate, um diesen Zugang aufzubauen. Du hast ihn geschenkt.
- **Technischer Gründer mit KI-Fokus** – du kannst bauen, ohne Agenturen zu bezahlen. Und KI ist in deinem Use Case _echt_ nützlich (dazu gleich).
- **Business-Co-Founder** – jemand, der die Gespräche führen, Preise verhandeln, Geschäftsmodell iterieren kann. 2-Gründer-Teams haben [laut Y Combinator signifikant bessere Überlebenschancen](https://www.ycombinator.com) als Solo-Gründer.

**Was dir fehlt (kann Geld kompensieren):**

- Kapital für Marketing, Anwälte, schnelles Skalieren

**Fazit:** Mit 5.000 € kommst du nicht weit für eine Skalierung, aber **völlig ausreichend für ein validiertes MVP mit echten Nutzern**. Ich habe Startups gesehen, die mit weniger gestartet sind.

Aber: Dein Budget zwingt dich zu einer bestimmten Strategie – und die ist tatsächlich die _beste_ Strategie, auch wenn du Millionen hättest. Mehr Geld würde dich nur verleiten, Fehler zu machen.

---

## Die Kern-Strategie: "Concierge MVP", nicht "App MVP"

Hier ist der wichtigste Rat, den ich dir geben kann – und genau das, was Airbnb, DoorDash und Stripe am Anfang gemacht haben:

**Baue in den ersten 60 Tagen KEINE App. Baue einen manuellen Service.**

Klingt kontraintuitiv. Lass mich erklären:
![[90_day_bootstrap_plan.svg]]

## Warum Concierge zuerst, nicht Code

Dein Informatiker-Instinkt wird sagen: "Lass mich die App bauen." **Widersteh dem.** Hier ist, warum:

- Airbnb-Gründer gingen selbst zu Wohnungen, machten die Fotos, redeten mit Gastgebern – Monate bevor die "Plattform" irgendetwas automatisierte
- DoorDash-Gründer liefer­ten selbst Essen und nahmen Bestellungen per Google Voice
- Stripe-Gründer integrierten den Zahlungscode manuell für die ersten 100 Kunden

Der Grund: **Du lernst Dinge, die dir kein Nutzer je in einem Interview sagen würde.** Zum Beispiel:

- Dass Bauern im Golf lieber Sprachnachrichten schicken als tippen → **deine App braucht Voice-Input an erster Stelle, nicht Text**
- Dass Broker Preise je nach Tageszeit ändern → **dein Preisindex muss stündlich aktualisiert werden**
- Dass manche Bauern Analphabeten sind → **deine UI muss piktogramm-basiert sein**
- Dass Eid-Saison 70 % des Jahresumsatzes ist → **deine Infrastruktur muss für Lastspitzen gebaut sein**

Wenn du zuerst die App baust, baust du für einen imaginären Nutzer. Wenn du zuerst manuell vermittelst, baust du danach für einen _echten_ Nutzer.

## Wie die 5.000 € sich verteilen

Konkrete Aufteilung für 12 Monate Bootstrap:

|Posten|Betrag|Wofür|
|---|---|---|
|Phase 1 (Validierung)|200 €|Reisekosten, Telefonkarten, kleine Dankeschön-Geschenke für Interviewpartner|
|Phase 2 (Concierge)|300 €|WhatsApp Business, evtl. bezahlte Ads in FB-Gruppen|
|Phase 3 (MVP-Build)|1.500 €|Apple Developer (99 €/Jahr), Google Play (25 € einmalig), Supabase (kostenlos bis ~500 Nutzer), Domain, Expo EAS Build, kleine KI-API-Kosten|
|Marketing Phase 3+|1.000 €|Gezielte Werbung in Zielregion, evtl. Video-Content|
|Rechtliches|800 €|Grund-Geschäftsbedingungen, Datenschutz, einfache Firmengründung|
|Puffer|1.200 €|Für Unvorhergesehenes – **kritisch, nicht weglassen**|

## Dein KI-Hebel – das, was Konkurrenz nicht hat

Dein KI-Hintergrund ist ein echter Differenziator. Konkrete Anwendungen, die mit bestehenden Modellen (OpenAI Vision, Claude Vision, oder Open-Source-Modelle) machbar sind:

1. **Foto-zu-Listing in 10 Sekunden:** Bauer macht Foto vom Schaf → App erkennt Rasse, schätzt Alter und Gewicht, schlägt Preis vor basierend auf deinem Preisindex. Das eliminiert die größte Friktion beim Einstellen.
2. **Gesundheits-Vorprüfung:** Vision-Modell erkennt offensichtliche Krankheitsanzeichen (Augen, Fell, Körperhaltung) → markiert verdächtige Tiere für manuelle Veterinär-Prüfung.
3. **Voice-zu-Listing auf Arabisch:** Bauer spricht 20 Sekunden über sein Tier → automatisch strukturiertes Listing mit Preis, Rasse, Standort.
4. **Preis-Prognose:** Mit wachsenden Transaktionsdaten → "Verkaufe jetzt oder in 2 Wochen? Preise steigen vor Eid um X %."

Keine dieser Features ist in Phase 1 oder 2 nötig. Alle werden in Phase 3+ zu deinem unkopierbaren Vorsprung.

## Die 5 Fehler, die du in den ersten 30 Tagen wahrscheinlich machen wirst

Schreib dir das irgendwo auf:

1. **Zu früh programmieren.** Dein Instinkt wird sein, nach Woche 1 mit React Native anzufangen. Tu es nicht. Warte bis Tag 60.
2. **Nach Features fragen statt nach Problemen.** "Würdest du eine App nutzen, die X macht?" bekommt höfliche Ja-Antworten. "Zeig mir, wie du letzten Monat ein Schaf verkauft hast" bekommt Wahrheit.
3. **Zu breit starten.** Nicht "alle Golfstaaten, alle Tiere." Sondern: eine Stadt, eine Tierart, eine Nutzergruppe zuerst.
4. **Broker als Feinde behandeln.** Du hast schon erkannt, dass sie Partner sind – bleib dabei, auch wenn sie dir zuerst misstrauen.
5. **Perfektionismus beim Branding.** Kein Logo-Contest, keine 10 Farbschemen. Arbeitstitel, weiter.

## Deine Aufgabe diese Woche

Bevor irgendetwas anderes passiert:

1. **Zwei-Gründer-Abstimmung:** Setz dich mit deinem Partner zusammen. Wer kümmert sich um was? Empfehlung: Du (KI) = Produkt/Tech, Partner (BWL) = Markt/Interviews. Aber beide führen die ersten Interviews gemeinsam.
2. **Hol dir 3 Zusagen von Familie/Kontakten** für erste Interviews nächste Woche.
3. **Schreib die 10 Fragen auf**, die du in jedem Interview stellen willst (ich kann dir helfen, diese zu formulieren).
4. **Arbeitsname für das Projekt** – egal welcher, Hauptsache es existiert.



![[roadmap_after_interviews.svg]]

Hier ist, was nach den Interviews kommt – ich erkläre jede Phase kurz, damit du das ganze Bild hast. Danach entscheidest du, wo wir ins Detail gehen.

## Phase 1: Synthese & Entscheidung (Tage 31–35)

Die wichtigste Woche des ganzen Projekts. Du und dein Partner setzt euch zusammen und beantwortet drei Fragen brutal ehrlich:

**Welches Problem ist das _eine_ Problem?** Nicht vier Probleme. Eines. Aus deinen Interviews wird ein Muster sichtbar – z.B. "Bauern verlieren durchschnittlich 15 % Marge an Broker, weil sie keinen direkten Käuferzugang haben." Oder: "Broker verlieren Deals, weil sie keine Preistransparenz haben." Wähle _eins_. Das wird dein nordstern.

**Wer ist der _eine_ Nutzer?** Du hast ursprünglich gesagt: Bauern → Broker → Schlachthöfe → Endkunden. Nach den Interviews weißt du, wer am meisten leidet und am ehesten zahlt. Baue für _die_ Gruppe zuerst. Die anderen kommen später.

**Go, Pivot, oder No-Go?** Drei mögliche Ergebnisse:

- **Go:** Starkes Signal, weiter mit Phase 2
- **Pivot:** Das Problem ist real, aber du hast die falsche Zielgruppe oder Lösung → neue Interview-Runde
- **No-Go:** Kein klares Problem gefunden → spart dir 2 Jahre Leben

## Phase 2: Concierge-MVP (Tage 36–60)

Das habe ich schon angerissen. Ihr seid die App – manuell. Konkret:

- WhatsApp Business Account für euch beide
- Excel-Tabelle mit Tieren (Foto, Bauer, Preis, Region, Status)
- Separate WhatsApp-Gruppen: "Verkäufer Riad", "Käufer Schlachthof X"
- Ihr nehmt 3–5 % Provision pro erfolgreichem Match

Ziel: **10 abgeschlossene Transaktionen**. Nicht 100. Nicht 1000. Zehn. Qualität über Quantität. Nach diesen 10 weißt du genau, was deine App tun muss.

## Phase 3: MVP-App v1 (Tage 61–90)

Jetzt erst Code. Der Tech-Stack (kann ich im Detail ausarbeiten):

- **React Native + Expo** (eine Codebase für iOS + Android)
- **Supabase** (Datenbank + Auth + Storage, kostenlos bis ~500 Nutzer)
- **Claude API oder OpenAI Vision** für Foto-Analyse
- **Arabic-first UI**, RTL-kompatibel

Features – nur diese drei, sonst nichts:

1. **Listing erstellen** (Foto → KI erkennt Rasse/Gewicht → Preisvorschlag)
2. **Chat + Anfrage** (zwischen Käufer und Verkäufer)
3. **Preisindex** (Live-Durchschnittspreise je Region)

Kein Escrow, keine Logistik, kein Veterinär. Das kommt später.

## Phase 4: Geschlossener Beta-Test (Monate 4–5)

Du lädst 20–50 Leute aus deinen Interviews ein. Genau die, die "Ja, ich teste es" gesagt haben. Niemand sonst.

**Warum geschlossen?** Weil du viele Bugs haben wirst. Wenn ein neuer Nutzer zum ersten Mal die App sieht und sie crasht, kommt er nie wieder. Ein Beta-Nutzer, der dich kennt, verzeiht und meldet.

Was du misst:

- Wie viele nutzen die App pro Woche?
- Wie viele Transaktionen werden _abgeschlossen_?
- Wo brechen Nutzer ab (Analytics)?
- Was wünschen sie sich zusätzlich?

## Phase 5: Vertrauensschicht (Monate 6–9)

Jetzt erst kommen die Features, die deinen Moat bauen – weil sie ohne Nutzer keinen Sinn machen:

- **Veterinär-Zertifikat digital** (Partnerschaft mit 2–3 lokalen Tierärzten, die bezahlt werden pro Prüfung)
- **Escrow-Zahlungen** (Geld wird erst freigegeben, wenn Käufer Tier akzeptiert)
- **Reputation-System** (Bewertungen, verifizierte Verkäufer, "Gold-Bauer"-Status)

Dann: öffentlicher Launch in _einer_ Stadt. Nicht Saudi + UAE + Kuwait gleichzeitig. Eine Stadt. Dominiere sie, dann expandiere.

## Phase 6: Logistik & Skalierung (Monate 9–15)

Transport war eines deiner vier Kernprobleme. Jetzt adressierst du es:

- Entweder eigene Partner-Spediteure
- Oder Uber-Modell: LKW-Fahrer registrieren sich in der App

Parallel: zweite und dritte Stadt. Mit echten Zahlen (Transaktionsvolumen, Nutzerzahl, Retention) bist du jetzt in der Position, **erste Investoren** anzusprechen. Im Golf gibt es ernsthafte Agritech- und MENA-Fonds, die genau solche Plattformen suchen.

## Phase 7: Daten-Monetarisierung (Jahr 2+)

Das ist, wo aus einer App ein _System_ wird:

- **Preisindex als B2B-Produkt:** Große Käufer (Schlachthöfe, Supermärkte, Regierung für Food Security) zahlen für Marktdaten
- **Finanzierung:** Du weißt, welcher Bauer zuverlässig ist → Partnerschaft mit Banken für Kleinkredite, du bekommst Provision
- **Versicherung:** Tiere versichern, Ernteausfall-Schutz
- **Expansion:** Saudi → UAE → Kuwait → Katar → Oman

An diesem Punkt ist deine App nicht mehr eine App. Sie ist die **digitale Infrastruktur für Viehhandel im Golf**. Das ist der Punkt, an dem große Player (Careem-Style, Talabat-Style) entweder übernehmen oder kopieren – aber deine Daten und dein Netzwerk sind dann 2 Jahre alt und nicht kopierbar.

---

## Die wichtigste Warnung für alle Phasen

**Überspring keine Phase.** Ich sehe das ständig: Gründer wollen direkt zu Phase 5 oder 7 springen, weil das "das richtige Geschäftsmodell" ist. Sie überspringen Concierge, sie überspringen Beta, sie bauen direkt eine Super-App.

Das Ergebnis: Eine App, die niemand nutzt, weil sie an imaginären Nutzern gebaut wurde.

Jede Phase _verdient_ die nächste. Du darfst keinen Escrow bauen, bevor du 10 Transaktionen manuell vermittelt hast. Du darfst keine Logistik-Integration machen, bevor 50 Nutzer regelmäßig die App nutzen. Jede übersprungene Phase kostet dich später das Dreifache an Zeit zum Fixen.

![[Pasted image 20260416195045.png]]


**Q: Welche Phase willst du als Nächstes durcharbeiten? A: Phase 1: Synthese – wie werte ich die 30 Interviews aus?**

**Du hast jetzt 40 Interviews (30 Bauern + 10 Broker) = ungefähr 20–30 Stunden Gespräche, hunderte Notizen, dutzende Zitate und Zahlen.** Das Problem ist nicht "habe ich genug Daten?" – das Problem ist: **wie verhindere ich, dass ich nur sehe, was ich sehen will?**

Das ist kein Softskill-Gelaber. Das ist _die_ Falle, in die Founder tappen. Dein Gehirn will bestätigen, dass deine ursprüngliche Idee richtig war, weil du sonst Monate umsonst "verloren" hast. **Dein Gehirn wird dich anlügen.** Unsere Aufgabe in Phase 1: einen Prozess aufbauen, der diese Lüge unmöglich macht.

## Der 5-Tage-Synthese-Prozess

Ich gebe dir einen strukturierten Plan. **Nicht länger als 5 Tage**, sonst verlierst du den Impuls.
![[synthesis_5_day_process.svg]]

## Tag 1: Rohdaten strukturieren

Du hast 40 Interview-Notizen in verschiedenen Google Docs oder Notion-Seiten liegen. Das ist unbrauchbar. Du brauchst _eine_ durchsuchbare Tabelle.

**Erstelle eine Google Sheet mit folgenden Spalten:**

|Spalte|Beispiel-Eintrag|
|---|---|
|Interview-ID|B-01 (Bauer 01), W-01 (Wasit/Broker 01)|
|Datum|2026-04-20|
|Name (anonymisiert)|Abu Mohammed|
|Rolle|Bauer / Broker / beides|
|Region|Riad-Nord|
|Herdengröße/Volumen|120 Schafe / 50 Tiere pro Monat|
|Alter/Digital-Komfort|55 J. / nutzt nur WhatsApp|
|Top-3 Schmerzpunkte|1. Käufer finden 2. Preistransparenz 3. Transport|
|Schlüsselzitat 1|"Ich verliere jeden Monat 3 Schafe, weil ich keinen Käufer finde"|
|Schlüsselzitat 2|"Die Broker wissen die Preise, ich nicht"|
|Schlüsselzitat 3|"..."|
|Genannte Zahlen|Preis/Schaf: 1500-1800 SAR, Broker-Marge: 15%|
|Frühere digitale Versuche|Hat WhatsApp-Gruppe, klappt nicht|
|Magic-Assistant-Antwort|"Käufer finden"|
|Follow-up zugesagt?|Ja, + 2 Kontakte weitergegeben|
|Signal|Starkes Ja / Schwaches Ja / Neutral / Nein|
|Mein Gefühl (1-10)|8|

**Praktischer Hack mit KI:** Dein Informatiker-Hintergrund mit KI-Schwerpunkt ist hier Gold wert. Wenn du die Gespräche aufgenommen hast (mit Erlaubnis):

1. Transkribiere mit **Whisper** (OpenAI) oder **AssemblyAI** – beide verstehen Arabisch gut
2. Schicke jede Transkription an Claude oder GPT-4 mit einem strukturierten Prompt:

```
"Hier ist ein Interview-Transkript mit einem Bauern in Saudi-Arabien. 
Extrahiere bitte:
- Top 3 Schmerzpunkte (wortwörtlich)
- Alle genannten Zahlen (Preise, Margen, Mengen, Zeitangaben)
- 3 emotionalste Zitate
- Hat er konkret gesagt, dass er die App testen würde? Ja/Nein/Unklar
- Auf einer Skala 1-10: wie akut ist sein Problem?
Gib mir die Antwort im JSON-Format."
```

Das spart dir 80 % der Zeit bei der Strukturierung. **Aber lies jedes Transkript trotzdem selbst mindestens einmal ganz durch** – die KI erkennt Muster, aber nicht den Unterton.

## Tag 2: Muster codieren

Jetzt kommt die Methode der Qualitativen Forschung, die auch Ethnographen und UX-Researcher nutzen. Sie heißt **thematisches Codieren**.

**Schritt 1 – Schmerzpunkte isolieren:** Aus deiner Tabelle alle genannten Schmerzpunkte extrahieren. Du wirst ~120–150 einzelne Nennungen haben.

**Schritt 2 – Clustern:** Ähnliche zu Themen gruppieren. Beispiel:

- "Ich weiß nicht, ob der Preis fair ist"
- "Der Broker gibt immer andere Zahlen"
- "Letzte Woche hörte ich, dass jemand 200 SAR mehr bekam"

→ Alle drei gehören zum Cluster **"Preisintransparenz"**

**Schritt 3 – Zählen:** Bei jedem Cluster notierst du:

- **Frequenz** (wie viele von 40 Interviewten nannten es?)
- **Intensität** (wie emotional wurde es beschrieben? 1-3 Skala)
- **Zahlung** (hat jemand konkret gesagt "dafür würde ich zahlen"?)

**Beispiel-Output nach Tag 2:**

|Cluster|Frequenz|Intensität|Zahlungsbereitschaft|
|---|---|---|---|
|Preisintransparenz|34/40 (85%)|2.8 (hoch)|18/40 erwähnten konkrete Summen|
|Käufer finden|28/40 (70%)|2.5|12/40|
|Transport-Chaos|22/40 (55%)|2.1|8/40|
|Gesundheits-Betrug|15/40 (37%)|2.9 (sehr hoch)|11/40|
|Zahlungssicherheit|11/40 (27%)|2.6|9/40|

**Die Lektion dieser Tabelle:** Frequenz allein lügt. "Preisintransparenz" wird von 85 % genannt, aber vielleicht ist "Gesundheits-Betrug" (nur 37 %, aber Intensität 2.9!) das _wirklich_ wertvolle Problem. Ein Mensch, der von Betrug stark gebrannt wurde, zahlt sofort für eine Lösung. Jemand, der unsichere Preise hat, lebt damit seit 30 Jahren.

**Die goldene Formel für Priorisierung:** `Frequenz × Intensität × Zahlungsbereitschaft = Problem-Score`

## Tag 3: Personas & Segmente

Jetzt identifizierst du, **wer** am meisten leidet. Deine Interviews werden 2–3 deutlich unterschiedliche Typen zeigen. Beispiel:

**Persona 1: Der traditionelle Kleinbauer**

- 40–65 Jahre, 50–150 Tiere
- Verkauft 2–4 Mal im Jahr
- Nutzt WhatsApp, aber keine Apps
- Schmerzpunkt Nr. 1: Käufer finden
- Zahlungsbereitschaft: niedrig (würde Gratis-App nutzen)
- Zitat: "Ich habe keinen, der mich anruft. Ich warte, bis Händler vorbeifahren."

**Persona 2: Der professionelle Züchter**

- 30–50 Jahre, 500+ Tiere
- Verkauft ständig, lebt davon
- Nutzt Instagram, hat Website
- Schmerzpunkt Nr. 1: Preistransparenz & Reputation
- Zahlungsbereitschaft: hoch (zahlt für Tools)
- Zitat: "Ich weiß, dass meine Tiere besser sind, aber Käufer glauben mir nicht."

**Persona 3: Der aktive Broker**

- 25–45 Jahre, handhabt 100+ Tiere/Monat
- Schmerzpunkt Nr. 1: Neue Käufer finden, Logistik
- Zahlungsbereitschaft: sehr hoch (lebt davon)
- Zitat: "Wenn ich 20% mehr Deals schaffen könnte, würde ich sofort jedes Tool bezahlen."

**Die entscheidende Frage:** Welche dieser Personas ist dein **Keil-Nutzer**? Das ist die Gruppe, die:

1. Den _akutesten_ Schmerz hat
2. Die _höchste_ Zahlungsbereitschaft hat
3. _Einfach erreichbar_ ist (eine klar definierbare Gruppe)
4. _Andere mitbringt_ als Nebeneffekt

**Spoiler aus der Startup-Literatur:** Meistens ist es nicht die größte Gruppe. Oft ist es die kleinste, aber mit intensivstem Schmerz. Facebook startete bei Harvard-Studenten, nicht bei "allen Menschen". Uber startete bei Tech-Arbeitern in San Francisco, nicht bei "allen Stadtbewohnern".

**Meine Vermutung für deinen Markt (zu verifizieren mit deinen Daten):** Dein Keil-Nutzer könnte der **professionelle Broker** sein. Warum? Weil er:

- Schon digital-affin ist (hat Smartphone, nutzt Business-Tools)
- Täglich Transaktionen macht (hohe App-Nutzungsfrequenz)
- _Andere_ in die App zieht (jeder Broker bringt 20 Bauern mit)
- Für Effizienzgewinne zahlt (BWL-Denken)

Falls das stimmt, würdest du deine App in Phase 2–3 _zuerst_ als **Broker-Tool** positionieren, nicht als Bauern-Marktplatz. Das ist ein großer strategischer Unterschied.

## Tag 4: Hypothesen-Check – der ehrliche Moment

Das ist die härteste Übung. Hol dir deinen Partner dazu. Nehmt ein leeres Blatt Papier und schreibt:

**Abschnitt A – Was wir VOR den Interviews glaubten:** Schreibt alle Annahmen auf, die ihr vor Tag 1 hattet. Beispiele:

- "Bauern wollen Broker umgehen"
- "Preis ist das Hauptproblem"
- "Eine WhatsApp-Alternative würde reichen"
- "Bauern würden sofort eine App installieren"

**Abschnitt B – Was die Interviews zeigten:** Für jede Annahme: **bestätigt**, **widerlegt**, oder **verkompliziert**? Mit Beleg (konkrete Interview-IDs und Zitate).

Beispiel:

- ~~"Bauern wollen Broker umgehen"~~ → **WIDERLEGT**. 22/30 Bauern schätzen Broker, weil diese den Transport und Beziehungen bringen. Interview B-04: "Ohne Abu Khaled könnte ich gar nicht verkaufen."
- "Preis ist das Hauptproblem" → **VERKOMPLIZIERT**. Preis ist oft genannt, aber Vertrauen/Betrug ist emotionaler und zahlungsstärker.

**Abschnitt C – Was wir jetzt wissen, das wir vorher nicht wussten:** Die "Aha-Momente". Das, was dich überrascht hat. Diese Überraschungen sind Gold – sie zeigen, wo deine Konkurrenten auch blind sind.

**Kritischer Check:** Wenn dein Abschnitt B hauptsächlich "BESTÄTIGT" enthält, habt ihr die Interviews schlecht gemacht. Echte Interviews zerstören mindestens 30 % der ursprünglichen Annahmen. Wenn alles "bestätigt" wurde, habt ihr unbewusst gelenkte Fragen gestellt oder seid nicht kritisch genug.

## Tag 5: Die Entscheidung

Jetzt die Meta-Entscheidung. Setzt euch mit eurem Partner für 2–3 Stunden zusammen. Schreibt gemeinsam ein **Entscheidungsdokument** (maximal 2 Seiten):

```
1. PROBLEM (ein Satz)
Das Problem, das wir lösen: _____________________

2. ZIELGRUPPE (eine Persona)
Wir bauen zuerst für: _____________________
Weil: _____________________

3. LÖSUNGS-HYPOTHESE (ein Satz)
Unsere Lösung: _____________________
Warum das funktionieren wird: _____________________

4. BELEGE (Zitate aus Interviews)
- "..."
- "..."
- "..."

5. RISIKEN / UNSICHERHEITEN
- _____________________
- _____________________

6. ENTSCHEIDUNG
[ ] GO → Start Phase 2 (Concierge-MVP) am _____
[ ] PIVOT → neue Hypothese: _____
[ ] NO-GO → Grund: _____

7. KILL-KRITERIEN für Phase 2
Wenn nach 30 Tagen Concierge folgendes nicht erreicht:
- _____ Transaktionen vermittelt
- _____ zahlende Nutzer
dann stoppen wir oder pivotieren.
```

Die **Kill-Kriterien** sind extrem wichtig. Sie schützen euch vor der Sunk-Cost-Falle. Ohne sie werdet ihr in 6 Monaten sagen "noch einen Monat, dann klappt's". Mit ihnen habt ihr einen ehrlichen Check-Punkt.

## Die drei häufigsten Synthese-Fehler (vermeide sie)

**Fehler 1: Cherry-Picking.** Du suchst die 3 Zitate, die deine Idee bestätigen, und ignorierst die 37 anderen. Schutz: Arbeite systematisch mit Tabelle und Zählung, nicht nach Gefühl.

**Fehler 2: Zu schnell zur Lösung springen.** Du hörst "Preistransparenz" und fängst sofort an, den Preisindex zu designen. Schutz: **Bleib in der Problem-Phase**. Die Lösung kommt in Phase 2, nicht in Phase 1.

**Fehler 3: "Aber meine Idee ist trotzdem gut."** Die Interviews zeigen etwas anderes, aber du fährst trotzdem fort. Schutz: Schreib das Entscheidungsdokument mit deinem Partner, der weniger emotional investiert ist als du.

## Was du mir jetzt zurückspielen solltest

Nach diesen 5 Tagen wirst du 3 konkrete Outputs haben:

1. **Die strukturierte Interview-Tabelle** (Rohdaten)
2. **Die Problem-Score-Tabelle** (Cluster mit Frequenz/Intensität)
3. **Das Entscheidungsdokument** (mit Go/Pivot/No-Go)

**Wenn du mit diesen Ergebnissen zu mir zurückkommst**, kann ich dir helfen, Phase 2 (Concierge-MVP) _exakt auf dein Ergebnis zugeschnitten_ zu designen. Ohne diese Daten würden wir für eine imaginäre Zielgruppe planen – genau der Fehler, den wir vermeiden wollen.