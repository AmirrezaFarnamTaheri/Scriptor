[English](VISUAL-REVIEW.md) · [فارسی](VISUAL-REVIEW.fa.md) · [简体中文](VISUAL-REVIEW.zh-CN.md) · [Русский](VISUAL-REVIEW.ru.md) · **Deutsch** · [Español](VISUAL-REVIEW.es.md)

# Hinweise zur visuellen Prüfung

Die visuelle Galerie der geprüften Windows-Baselines ist die zentrale Ablage für alle Screenshots, auf die dieses Dokument verweist. Der Screenshot-Abschnitt der README, `docs/assets/screenshots/README.md` und die eingecheckten PNG-Dateien unter `docs/assets/screenshots/` sind maßgeblich; diese Seite dokumentiert die **Erzählung und Prüfpraxis der Reviewer**, nicht eine zweite Sammlung derselben Bilder.

## Was die visuelle Testsuite absichert

- Das Laden verzögerter Panels, Überläufe in der Topbar, kompakte Layouts, Modal-Fokus sowie saubere Konsolen- und Netzwerkzustände werden von der Playwright-Quellsuite geprüft und müssen auf dem eingefrorenen Release-Kandidaten erneut ausgeführt werden.
- Dark Mode und die Breakpoints 1024 / 768 / 375 px gehören zur Matrix; das Workspace-Paar in der README und die responsiven Aufnahmen dokumentieren die geprüften Baselines.
- Reader-, Task- und Kanban-Abläufe werden von der funktionalen Playwright-Regressionssuite ausgeführt und als Laufzeitevidenz erfasst, wenn die experimentellen Oberflächen aktiviert sind.
- Für Recovery-Fallbacks, Tastatur-Popovers, Plugin-Verwaltung und Indexierungsbereitschaft gibt es spezifische Aufnahmen, die aus der Galerie verlinkt sind.

## Prüfpraxis

- Jede Änderung einer Baseline erfordert die Sichtprüfung des visuellen Diffs und einen ausdrücklichen Prüfvermerk im Änderungspaket.
- Veraltete Snapshots werden erst ersetzt, nachdem ein Reviewer den Diff geprüft hat; visuelle Fehler dürfen niemals durch Erhöhen der globalen Toleranz verborgen werden.
- Die Playwright-Quellsuite und die eingecheckten PNGs müssen übereinstimmen. Die eingecheckten PNGs sind Dokumentationsartefakte und für sich allein kein Release-Nachweis. Maßgeblich bleiben der exakte Commit, Browser, Viewport und das Ergebnis von `pnpm test:visual`.

## Querverweise

- Screenshot-Abschnitt der README — benutzerorientierte Tour durch Workspace sowie die Bereiche Schreiben, Wissen, Visualisierung, Automatisierung und Betrieb/Veröffentlichung.
- `docs/assets/screenshots/README.md` — jede eingecheckte PNG-Datei, ihre Größe und die Dokumente, die sie referenzieren.
- `docs/RELEASE-CHECKLIST.md` — visuelle Prüfpunkte für einen Release.
- `docs/VERIFICATION.md` — Evidenzkette der visuellen Verifikation.
