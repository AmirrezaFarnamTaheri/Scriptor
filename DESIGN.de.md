# Designsystem

[English](DESIGN.md) · [فارسی](DESIGN.fa.md) · [简体中文](DESIGN.zh-CN.md) · [Русский](DESIGN.ru.md) · **Deutsch** · [Español](DESIGN.es.md)

Scriptor ist eine **Arbeitsoberfläche**: Benutzer öffnen sie zum Schreiben, Navigieren, Prüfen, Vergleichen und Veröffentlichen. Die visuelle Gestaltung unterstützt diese Aufgaben und konkurriert niemals mit ihnen.

## Ausrichtung

- Präzise, ruhig, licht und technisch, ohne eine IDE zu imitieren.
- Neutrale Anthrazit-/Schieferflächen mit genau einem zurückhaltenden semantischen Akzent.
- Dichte Informationen werden durch Hierarchie, Rhythmus und Trennlinien gegliedert, nicht durch verschachtelte Karten.
- System-Sans-Serif für die UI und System-Monospace für Code und Zahlen; keine entfernten Schriftarten.

## Layout

Der Desktop nutzt vier funktionale Bereiche:

1. obere Befehlsleiste;
2. Vault-/Navigationsleiste;
3. Editor-/Vorschau-Arbeitsbereich;
4. kontextbezogene Inspector- und Statusflächen.

Bei schmalen Breiten werden sekundäre Bereiche in die mobile Workspace-Navigation eingeklappt. Änderungen am Workspace müssen bei `320`, `375`, `768`, `1024` und `1440` Pixeln sowie bei 200 % Zoom geprüft werden. Kein Bedienelement darf ausschließlich von Hover abhängen.

## Anti-Slop-Vorgaben

- Keine standardmäßigen violetten/indigofarbenen KI-Verläufe.
- Keine übergroße Marketing-Typografie auf operativen Workspace-Flächen.
- Kein dekoratives Glassmorphism oder Umgebungsleuchten; tokenisierte Glaseffekte sind funktionalem Chrome vorbehalten.
- Keine Emojis als strukturelle UI-Icons; verwenden Sie den etablierten Lucide-Icon-Satz.
- Keine Hover-Skalierung, die das Layout verschiebt.
- Keine erfundenen Performance-Scores, Abschlusszertifikate oder Verifikationsaussagen ohne erfasste Nachweise.

## Tokens und Anpassung

Die maßgeblichen Tokens liegen in `src/index.css` und `src/styles/`. Neue Komponenten müssen semantische Variablen für Flächen, Text, Rahmen, Fokus, Gefahr, Warnung, Erfolg, Abstände, Radien und Bewegung verwenden. Beliebige Farben und Schatten benötigen eine dokumentierte Ausnahme.

| Token-Rolle | Runtime-Variable | Zweck / Bereich |
|---|---|---|
| Primärakzent | `--primary` | Primäre Aktionsbuttons, aktive Tab-Indikatoren, wichtige Badges |
| Sekundäres Amber | `--amber` | Warnungen, Badges für Zwischenzustände, sekundäre Hervorhebungen |
| Primärer Hintergrund | `--bg` | Hintergrund der Anwendungs-Canvas-Wurzel |
| Sekundärfläche | `--surface` | Panels, Sidebars, modale Dialogkarten |
| Erhöhte Fläche | `--surface-raised` | Hover-Zustände, erhöhte Karten, Dropdown-Elemente |
| Primärtext | `--ink` / `--ink-strong` | Kontrastreicher Fließtext und Überschriften |
| Rahmenhervorhebung | `--border` | Dezente Panel-Rahmen und Glaskanten |
| Fokusring | `--focus-ring` | Kontur des Tastatur-Fokusrings |
| Anzeigeschrift | `--font-sans` | Auswahl der UI-Schriftfamilie (`system`, `inter`, `sf-pro`, `avenir-next`, `outfit`, `jetbrains-mono`, `georgia`) |
| Glasunschärfe | `--glass-blur` | Intensität des Backdrop-Filters (`none`, `subtle`, `glass`, `heavy`) |

### Farbschema-Katalog und eigener Theme Builder

Scriptor liefert **18 integrierte, abgestimmte Farbschemata** in drei Kategorien (`dark`, `light`, `contrast`):
- **Dunkel:** `Dark Midnight`, `Catppuccin Mocha`, `Dracula`, `Nord Frost`, `Tokyo Night`, `Solarized Dark`, `Gruvbox Dark`, `Emerald Forest`, `Cyberpunk Neon`, `Monokai Pro`, `Rosé Pine`, `Synthwave 84`, `One Dark Pro`, `Vitesse Dark`.
- **Hell:** `Light Modern`, `Sepia Paper`.
- **Hoher Kontrast:** `High Contrast`, `OLED True Black`.

Benutzer können außerdem den **Custom Theme Builder** öffnen, um benutzerdefinierte Themes zu erstellen, zu bearbeiten, live vorzuschauen und zu löschen. Diese werden dynamisch unter `scriptor:custom-themes` gespeichert.

## Interaktionsvertrag

Jede asynchrone Oberfläche darf nur Zustände darstellen, die ihr Eigentümer tatsächlich bestimmen kann. Wo unterstützt, sind bereitzustellen:

- Lade- oder Fortschrittszustand;
- sinnvoller Leerzustand;
- handlungsorientierter Fehlerzustand;
- sichtbare Bestätigung einer Mutation;
- Abbruchmöglichkeit für lang laufende Vorgänge.

Hochriskante Operationen zeigen Umfang und Folgen in einem nativen Bestätigungsdialog. Deaktivierte Bedienelemente erklären den Grund. Destruktive Aktionen sind nicht die Standardaktion.

## Mindestanforderungen an Barrierefreiheit

Ziel: WCAG 2.2 AA.

- semantisches HTML vor ARIA;
- sichtbare `:focus-visible`-Behandlung für jedes interaktive Element;
- logische Tab-Reihenfolge und keine Tastaturfallen;
- modale Dialoge verwenden Labels/Beschreibungen, initialen Fokus, eingeschlossenen Fokus, Escape-Behandlung, Scroll-Sperre und Fokuswiederherstellung;
- Tabs unterstützen Pfeiltasten, Home, End und roving `tabIndex`;
- Status wird nicht ausschließlich über Farbe vermittelt;
- Bewegung respektiert `prefers-reduced-motion`;
- touch-orientierte Bedienelemente sind mindestens 44×44 CSS-Pixel groß;
- Editor- und UI-Text bleiben bei 200 % Zoom lesbar;
- tertiäre Text-Tokens erfüllen WCAG-AA-Kontrast auf ihren primären Flächen;
- der Editor folgt dem Hell-/Dunkel-Theme der Anwendung, bis der Benutzer es ausdrücklich überschreibt.

## Bewegung

Bewegung kommuniziert ausschließlich Zustandsänderungen. Standardübergänge dauern 120–220 ms und verwenden Opazität oder Transformationen, die die Semantik des umgebenden Blocks nicht verändern. Layoutkritische Breite oder Höhe wird niemals kontinuierlich animiert. Im Reduced-Motion-Modus entfallen nicht notwendige Übergänge und Smooth Scrolling.

## Komponentenarchitektur

- Daten und Orchestrierung liegen in Hooks oder Domain Controllern;
- Präsentationskomponenten erhalten typisierte Props;
- gemeinsame Overlays verwenden das einheitliche Dialog-/Panel-Primitiv;
- Komponenten mit mehr als 200 Zeilen sind Kandidaten für Zerlegung;
- Packages stellen Verhalten nur über deklarierte Entry Points bereit;
- Lade-, Leer-, Fehler- und Erfolgszustände verbleiben bei dem Eigentümer, der sie wahrheitsgemäß bestimmen kann.

## Ergebnisse des Slop-Audits

Stand 2026-08-09:
- **Rohe Emojis:** 0 Vorkommen in produktiven TSX-Dateien (100 % Lucide-SVG-Icons).
- **Unkontrolliertes `transition: all`:** 0 Vorkommen in 433 CSS- und TSX-Dateien.
- **Explizite `any`-Casts in der UI:** 0 Vorkommen in produktiven TSX-Komponenten.
- **Vertragsverifikation:** 43 Unit-Test- und Validierungssuiten bestehen zu 100 % in `pnpm check:source`.

## Visuelle Verifikation

Playwright-Projekte decken Hell-/Dunkel-Themes, Desktop-/Mobile-Breakpoints, modale Flächen, Editor/Vorschau, Knowledge Workbench, Einstellungen, Graph und wichtige Workflow-Zustände ab. Der eingefrorene Release Candidate verlangt zusätzlich manuelle Prüfungen bei 200 % Zoom, mit Screenreader und in der nativen Shell, bis diese zuverlässig automatisiert sind. Snapshot-Schwellenwerte dürfen keine ganzseitigen Verschiebungen verdecken. Siehe [`docs/validation/FRONTEND_QUALITY.de.md`](docs/validation/FRONTEND_QUALITY.de.md).
