# Frontend quality standard

Scriptor is an **operate** interface. Quality means calm hierarchy, fast task completion, complete interaction states, keyboard access, responsive density, and no hidden authority—not decorative spectacle.

## Automated source gate

```bash
npm run check:frontend-quality --silent
```

The gate checks production TypeScript/CSS for:

- explicit `any` at UI/runtime contracts;
- emoji glyphs used in place of the icon system;
- remote fonts/CSS imports;
- static inline styles in critical workspace surfaces;
- modal focus containment and naming;
- typed editor/preview action contracts;
- responsive editor, graph, modal, and error-state CSS;
- self-contained error UI and design-system inclusion.

Package imports are separately enforced by `lint:boundaries`.

## Visual direction

- neutral charcoal/slate foundation with one restrained teal accent;
- hierarchy through typography, dividers, rhythm, and negative space rather than nested cards;
- no purple AI gradients, neon glows, gratuitous glass, generic dashboard tiles, emoji controls, or ornamental perpetual motion;
- system UI fonts and a system monospace; no network font dependency;
- motion only for state continuity and always disabled/reduced when requested.

## Component acceptance

Each async surface must show loading, useful empty, actionable error, and visible success states. Long-running work exposes cancellation where the underlying operation supports it. High-risk operations disclose scope and consequence before the native confirmation.

Dialogs require programmatic title/description, `aria-modal`, initial focus, focus containment, Escape, backdrop behavior, scroll containment, and focus restoration. Tabs use roving focus plus Arrow/Home/End. Icon-only controls have accessible names.

Top-bar and toolbar overflow checks cover narrow viewports and 200% text zoom. Portaled menus and customization popovers must remain inside the visual viewport, close with Escape, restore trigger focus, and update position after resize or ancestor scrolling. Plugin/store presets must apply as one visible state transition, preserve unowned third-party plugin IDs, and expose honest empty and persistence-error states.

## Required visual evidence

The Playwright screenshot suite covers the workspace, editor/preview, command palette, graph, canvas, Git, MCP, settings, publish, health, knowledge, conflict resolution, history, shortcuts, mobile layout, onboarding, and plugins. A release reviewer must regenerate snapshots from the frozen source and inspect diffs; historical PNGs are not proof of the current source state.
