# Design

Visual and interaction rules for the Scriptor shell. Token values live in [`docs/design/DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md) and `src/index.css`.

## System

Scriptor is a restrained desktop product interface: neutral surfaces, graphite structure, deep ink text, cyan-teal action color, and amber only for operational warnings or active jobs. The UI is dense enough for research work but calm enough for long writing sessions.

## Scene

A quiet research desk at noon: soft light through glass, graphite instruments, a small teal status lamp, and one amber progress indicator when work is actively running.

## Color

- **Primary:** cyan-teal (`--primary`, `--primary-strong`) for actions, links, and graph affordances.
- **Operational:** amber (`--amber`, `--amber-soft`) for jobs and warnings only.
- **Destructive:** `--danger` for errors and irreversible actions.
- **Accent reserve:** deep crimson may be used sparingly for rare editorial emphasis — not as a primary brand color.

Authoritative tokens: [`docs/design/DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md).

## Typography

- **Chrome:** Sora (display wordmark), Inter (UI body) — see `--font-display`, `--font-body`.
- **Editor:** JetBrains Mono / Cascadia Code stack (`--font-mono`).
- Compact labels use weight and color, not uppercase tracking.

Brand assets: [`docs/brand/BRAND.md`](docs/brand/BRAND.md).

## Layout

See [`docs/design/LAYOUT_BLUEPRINTS.md`](docs/design/LAYOUT_BLUEPRINTS.md) for desktop, tablet, mobile, and TUI structure.

## Components

- **Glass panels:** frosted surfaces with backdrop blur (`.surface-glass`).
- **Buttons:** compact, spring press feedback (`.pressable`), radius `--radius-sm`–`--radius-md`.
- **Cards:** inspector widgets only; avoid nested cards.
- **Icons:** Lucide outline icons, consistent stroke weight.

## Motion

- Spring curves: `--spring-fast`, `--spring-soft`, `--spring-gentle`.
- Progress fill animation for active jobs.
- `prefers-reduced-motion` disables nonessential transitions.

## Canvas

Canvas mode is a focused working board, not a decorative whiteboard. It shares the neutral shell, compact toolbar, and explicit snapshot/export jobs. Canvas never displaces Markdown as the default first screen.

## Related documents

| Document | Purpose |
|----------|---------|
| [`PRODUCT.md`](PRODUCT.md) | Product principles and exclusions |
| [`docs/design/DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md) | Token reference |
| [`docs/validation/ACCESSIBILITY_AUDIT.md`](docs/validation/ACCESSIBILITY_AUDIT.md) | Accessibility checklist |
