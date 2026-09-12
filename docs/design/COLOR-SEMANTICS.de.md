[English](COLOR-SEMANTICS.md) · [فارسی](COLOR-SEMANTICS.fa.md) · [简体中文](COLOR-SEMANTICS.zh-CN.md) · [Русский](COLOR-SEMANTICS.ru.md) · **Deutsch** · [Español](COLOR-SEMANTICS.es.md)

# Farbsemantik und Eigentum

**Status:** Aktiver Designvertrag

Scriptor trennt Farbwerte nach Verantwortungsbereich, damit Produktzustände nicht durch unverwaltete Literale kodiert werden.

## 1. Theme- und semantische UI-Farben

Interaktionszustände, Status, Auswahl, Fokus, Warnungen, Fehler, Erfolg, Rahmen und Anwendungsoberflächen müssen benannte CSS Custom Properties verwenden. Die aktuelle Kompatibilitätsschicht stellt Variablen wie `--primary`, `--danger`, `--success`, `--selected`, `--surface` und `--border` bereit; das gestufte Token-System unter `src/styles/tokens/` besitzt die zugehörigen primitiven und semantischen Paletten.

Komponenten-CSS und React-Rendering-Code dürfen keinen neuen Hex-Wert erfinden, um einen Anwendungsstatus oder Interaktionszustand darzustellen. Stattdessen ist ein Token hinzuzufügen oder abzubilden.

## 2. Inhalts- und Visualisierungspaletten

Persistierte oder vom Benutzer verfasste visuelle Daten unterscheiden sich von der Application-Chrome. Canvas-Flächen und -Konturen, Sticky-Note-Farben, Annotation-Farben, Graph-Serien/Ordnerpaletten, Syntax-/Editor-Theme-Definitionen, exportierte SVG-Defaults und vom Benutzer auswählbare Theme-Paletten dürfen literale Farben enthalten, wenn das Literal Teil des Inhaltsformats oder der benannten Palette selbst ist. Diese Werte dürfen nicht als implizite Anwendungsstatusfarbe wiederverwendet werden.

## 3. Fallbacks

Eine Komponente darf Token-Eigentum nicht mit einem rohen semantischen Fallback wie `var(--danger, #b42318)` umgehen. Erforderliche Anwendungstokens sind durch den Theme-Vertrag definiert. Inhaltsrenderer dürfen stabile literale Fallbacks verwenden, wenn Benutzerdaten ohne Stil geladen werden, weil diese Werte Dokumentinhalt statt UI-Zustand beschreiben.

## 4. Canvas-APIs

SVG-Präsentationsattribute können CSS-Variablen direkt referenzieren. Canvas-2D-APIs benötigen aufgelöste Farben; daher werden anwendungssemantische Canvas-Farben aus den berechneten Custom Properties des aktiven Elements gelesen. Eine Visualisierungspalette darf nur als Rendering-Fallback dienen, nicht als Quelle von Statussemantik.
