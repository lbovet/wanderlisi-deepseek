**Wanderlisi V2.0 – MVP**

**Ziel**

Entwickle **Wanderlisi V2.0**, eine schlanke Web-App zum Sammeln, Planen und Verwalten eigener Wanderungen in der Schweiz.

Referenz für Design und Look & Feel ist die bestehende Version:

<https://www.windmaster.ch/wanderlisi/>

**Logo, Favicon, Farben, Schrift und die visuelle Grundsprache von V1.0 sollen übernommen und für V2.0 weiterentwickelt werden.** Die Kernfunktionen werden neu aufgebaut.

Der erste Schritt ist ein **Frontend-MVP**, der ohne PHP lokal getestet werden kann.

**Kernfunktionen**

**Wanderungen**

Eine Wanderung enthält:

- GPX-Datei

Anhand der GPX Datei, die man hochladen kann, sollen folgende Infos automatisch pro Wanderung angezeigt werden:

- Titel, z. B. „First – Faulhorn – Schynige Platte"
- Dauer
- Distanz
- Aufstieg
- Abstieg
- Schwierigkeit (T1, T2, T3 ...)
- kurze Beschreibung wir mit KI automatisch generiert
- 3–4 passende Internetbilder

Zusätzliche Felder optional:

- eigene Bilder
- Status: „gemacht" / „noch nicht gemacht"

Wanderungen können erstellt, bearbeitet und gelöscht werden.

**Karte**

Die zentrale Ansicht ist eine **Schweizer Karte mit den Wanderungen**.

- GPX-Tracks auf der Karte darstellen
- 30–100 Wanderungen müssen problemlos möglich sein
- gemachte / nicht gemachte Wanderungen farblich unterscheiden
- Klick auf eine Route öffnet die Detailansicht
- Zoom, Pan und automatische Anpassung an die Route
- auf Desktop und Mobile gut nutzbar
- bei Bedarf Clustering oder eine ähnliche Lösung für viele nahe beieinanderliegende Wanderungen

Leaflet oder eine vergleichbare schlanke Kartenlösung verwenden.

**Detailansicht**

Zeigt:

- Titel
- Schwierigkeit
- Dauer
- Distanz
- Aufstieg / Abstieg
- Beschreibung
- GPX-Karte
- Internetbilder
- eigene Bilder

**Internetbilder**

Für jede Wanderung sollen möglichst automatisch 3–4 passende Bilder gefunden und angezeigt werden.

Die Bildsuche als separaten Service kapseln, damit später problemlos eine konkrete API verwendet oder ausgetauscht werden kann.

**KI-Beschreibung**

Optionaler Button:

**„Beschreibung mit KI erstellen"**

Aus den vorhandenen Wanderungsdaten soll eine kurze Beschreibung generiert werden.

Die eigentliche KI-API muss im MVP noch nicht zwingend implementiert sein. Die Architektur soll eine spätere Anbindung ermöglichen.

**Eigene Bilder**

Mehrere eigene Bilder hochladen, anzeigen und löschen.

Für den MVP lokal im Browser speichern; für grössere Dateien bevorzugt IndexedDB verwenden.

**Speicherung**

Im MVP:

- keine Datenbank
- kein Login
- keine Benutzerverwaltung
- Speicherung direkt im Browser

Bevorzugt:

- localStorage für einfache Daten
- IndexedDB für Bilder und grössere Dateien

Die Daten müssen nach einem Reload erhalten bleiben.

Die Datenstruktur soll später einfach auf einen **PHP-Service mit JSON-Dateien** umgestellt werden können.

**Technologie**

Die Lösung soll:

- lightweight
- schnell
- wartbar
- modular
- erweiterbar

sein.

Möglicher Stack:

- HTML / CSS
- JavaScript oder TypeScript
- Leaflet
- schlanke Frontend-Struktur

Ein Framework wie React/Vue nur verwenden, wenn es einen konkreten Vorteil bringt.

**Keine unnötigen Abhängigkeiten und kein Overengineering.**

Der MVP muss ohne PHP lokal startbar und testbar sein.

**Design / UX**

Das Design soll:

- modern
- minimalistisch
- ruhig
- hochwertig
- schnell
- übersichtlich

sein.

**V1.0 ist die visuelle Referenz.** Kein komplett neues Design entwickeln.

Responsive für Desktop, Tablet und Smartphone.

Die Karte und die eigenen Wanderungen stehen klar im Mittelpunkt.

**Spätere Erweiterungen**

Noch nicht implementieren, aber Architektur dafür offen halten:

- SAC-Hütten
- historische Hotels
- Listenansicht
- weitere Nutzer / Benutzerkonten
- PHP/JSON-Backend

**MVP-Prioritäten**

1. Wanderungen verwalten
2. GPX importieren
3. Wanderungen auf Schweizer Karte anzeigen
4. Status „gemacht / nicht gemacht"
5. lokale Speicherung
6. eigene Bilder
7. Internetbilder
8. KI-Beschreibung

**Entwicklungsprinzip**

**Keep it simple.**

Baue zuerst einen funktionierenden und optisch hochwertigen MVP.

Nicht bereits die spätere Plattform entwickeln.

Technische Lösungen sollen so gewählt werden, dass sie für **30–100 Wanderungen** zuverlässig funktionieren und später erweitert werden können.

Bei jeder Entscheidung gilt:

Ist diese Komplexität für den aktuellen MVP wirklich notwendig?

Wenn nicht, die einfachere Lösung wählen.

**Vorgehen**

1. Bestehende V1.0 analysieren.
2. Kurzen Architekturvorschlag machen.
3. MVP schrittweise implementieren.
4. Nach jedem grösseren Schritt soll die Anwendung weiterhin lauffähig sein.
5. Keine unnötigen Funktionen ergänzen, die nicht in dieser Spezifikation stehen.