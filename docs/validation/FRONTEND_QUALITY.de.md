# Frontend-Qualitätsstandard

[English](FRONTEND_QUALITY.md) · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · **Deutsch** · [Español](FRONTEND_QUALITY.es.md) · [فارسی](FRONTEND_QUALITY.fa.md)

Scriptor ist eine **Operate**-Oberfläche. Qualität bedeutet ruhige Hierarchie, schnelle Aufgabenerledigung, vollständige Interaction States, Keyboard Access, responsive Density und keine verborgene Authority — nicht dekoratives Spektakel.

## Automatisches Source Gate

```bash
npm run check:frontend-quality --silent
```

Das Gate prüft Production TypeScript/CSS auf:

- explizites `any` an UI/Runtime Contracts;
- Emoji Glyphs statt Icon System;
- Remote Fonts/CSS Imports;
- statische Inline Styles in kritischen Workspace Surfaces;
- Modal Focus Containment und Naming;
- typed Editor/Preview Action Contracts;
- responsive Editor-, Graph-, Modal- und Error-State-CSS;
- self-contained Error UI und Design-System-Inclusion.

Package Imports werden separat durch `lint:boundaries` erzwungen.

## Visuelle Richtung

- neutrale Charcoal/Slate-Basis mit einem zurückhaltenden Teal-Akzent;
- Hierarchie durch Typografie, Divider, Rhythmus und Negative Space statt verschachtelter Cards;
- keine Purple-AI-Gradients, Neon Glows, unnötiges Glass, generische Dashboard Tiles, Emoji Controls oder ornamentale Dauerbewegung;
- System-UI-Fonts und System-Monospace, keine Network-Font-Abhängigkeit;
- Motion nur für State Continuity und bei Wunsch immer disabled/reduced.

## Component Acceptance

Jede Async Surface zeigt Loading, sinnvollen Empty State, actionable Error und sichtbaren Success State. Long-running Work bietet Cancellation, wenn die zugrundeliegende Operation es unterstützt. High-risk Operations legen Scope und Konsequenz vor Native Confirmation offen.

Dialogs benötigen programmatic title/description, `aria-modal`, initial focus, focus containment, Escape, backdrop behavior, scroll containment und focus restoration. Tabs nutzen roving focus plus Arrow/Home/End. Icon-only Controls besitzen Accessible Names.

Top-Bar-/Toolbar-Overflow-Checks decken schmale Viewports und 200% Text Zoom ab. Portaled Menus und Customization Popovers bleiben im Visual Viewport, schließen mit Escape, stellen Trigger Focus wieder her und aktualisieren ihre Position nach Resize oder Ancestor Scrolling. Plugin/Store Presets müssen als ein sichtbarer State Transition angewendet werden, nicht eigene Third-Party Plugin IDs erhalten und ehrliche Empty-/Persistence-Error-States zeigen.

## Erforderliche visuelle Evidenz

Die Playwright Screenshot Suite deckt Workspace, Editor/Preview, Command Palette, Graph, Canvas, Git, MCP, Settings, Publish, Health, Knowledge, Conflict Resolution, History, Shortcuts, Mobile Layout, Onboarding und Plugins ab. Ein Release Reviewer muss Snapshots aus Frozen Source neu erzeugen und Diffs prüfen; historische PNGs beweisen den aktuellen Source State nicht.
