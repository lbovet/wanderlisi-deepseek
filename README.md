# Wanderlisi V2.0

Wanderlisi ist eine schlanke Web-App, um eigene Wanderungen in der Schweiz zu
sammeln, zu planen und zu verwalten. V2.0 ist ein **Frontend-MVP**: er läuft
ohne PHP, ohne Datenbank und ohne Login – alle Daten bleiben im Browser.

Design, Logo, Favicon, Farben und Schriftsprache stammen aus Wanderlisi V1.0,
die Kernfunktionen sind neu aufgebaut.

## Schnellstart

```bash
bun install   # keine Abhängigkeiten, nur zur Sicherheit
bun start     # http://localhost:3000
bun test      # Unit-Tests für GPX, Geo, Schwierigkeit, Services
```

Alternativ mit Docker:

```bash
docker build -t wanderlisi .
docker run -p 3000:3000 wanderlisi
```

## Funktionen

- **Wanderungen verwalten** – anlegen (GPX-Import), bearbeiten, löschen
- **GPX-Import** mit automatisch berechneten Werten: Titel, Distanz, Dauer,
  Aufstieg/Abstieg, höchster/tiefster Punkt und SAC-Schwierigkeit (T1–T6)
- **KI-Beschreibung** – Knopf «Beschreibung mit KI erstellen»; offline wird eine
  lokale Vorlage verwendet, ein echter Endpunkt kann in den Einstellungen
  hinterlegt werden
- **Internetbilder** – automatische Suche nach 3–4 Bildern (Wikimedia Commons),
  offline als generierte Illustrationen
- **Eigene Bilder** – mehrere Bilder hochladen, anzeigen und löschen (IndexedDB)
- **Schweizer Karte** (Leaflet + swisstopo) mit allen Tracks, farblich nach
  Status, Clustering der Startpunkte und Klick auf die Route
- **Detailansicht** mit Statistiken, Höhenprofil, Bildern und Aktionen
- **Filter & Suche** nach Status und Titel
- **Status** «gemacht» / «noch nicht gemacht»

## Architektur

```
index.js                 Bun-Server: liefert public/ und /health
public/
  index.html             App-Shell
  css/style.css          Design (V1-Sprache, responsive)
  img/, favicon.svg      Logo & Icons aus V1.0
  js/
    app.js               Controller: Store + Karte + Detail + Editor
    store.js             Persistenz (localStorage + IndexedDB)
    gpx.js               GPX-Parser & Statistik
    geo.js               Distanz, Bounding-Box, Douglas-Peucker
    difficulty.js        SAC-Skala T1–T6
    map.js               Leaflet-Karte & Clustering
    detail.js            Detailansicht
    editor.js            Bearbeiten-Dialog
    profile.js           Höhenprofil (SVG, ohne Chart-Library)
    services/
      images.js          Bildsuche (Provider-Schnittstelle)
      description.js     KI-Beschreibung (Provider-Schnittstelle)
test/                    Unit-Tests (bun test)
```

### Erweiterbarkeit

- **Bildsuche** und **KI-Beschreibung** sind über Provider gekapselt. Ein
  konkreter API-Provider kann ergänzt oder ausgetauscht werden, ohne die UI
  anzupassen.
- **Persistenz**: `HikeStore` ist die einzige Schnittstelle zur Speicherung. Ein
  späteres `RemoteHikeStore` kann dieselben Methoden gegen einen PHP/JSON-Service
  implementieren.

### Datenstruktur (für ein späteres PHP/JSON-Backend)

```jsonc
// Hike-Metadaten (localStorage, Schlüssel "wanderlisi.hikes.v2")
{
  "id": "uuid",
  "title": "First – Faulhorn – Schynige Platte",
  "status": "done",              // "planned" | "done"
  "description": "…",
  "stats": {
    "distanceKm": 16.2, "ascentM": 780, "descentM": 820,
    "minEle": 1400, "maxEle": 2681, "durationMin": 375
  },
  "difficulty": 3,               // 1–6 (T1–T6)
  "difficultySource": "sac_scale",
  "webImages": [{ "url": "…", "thumbUrl": "…", "title": "…", "source": "Wikimedia Commons", "author": "…", "link": "…" }],
  "imageCount": 2,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

Grössere Payloads liegen in IndexedDB: der GPX-Record `{ id, raw, points }`
(Store `gpx`) und die eigenen Bilder `{ id, hikeId, name, type, blob }`
(Store `images`).

## Deploy

Jeder Push auf `main` deployt via `dokku/github-action` auf die
Dokku-App `wanderlisi-deepseek` → https://wanderlisi-deepseek.chee.li