# Design system

Scriptor is an **operate** interface: users open it to write, navigate, inspect, compare, and publish. Visual expression supports those tasks; it never competes with them.

## Direction

- Precise, quiet, luminous, technical without feeling like an IDE.
- Neutral charcoal/slate surfaces with one restrained teal accent.
- Dense information is separated by hierarchy, rhythm, and dividers rather than nested cards.
- System sans-serif for UI and system monospace for code/numbers; no remote fonts.
- No purple AI gradients, neon glows, faux paper, oversized marketing typography, or perpetual decorative motion.

## Layout

Desktop uses four functional regions:

1. top command bar;
2. vault/navigation rail;
3. editor/preview workspace;
4. contextual inspector/status surfaces.

At narrow widths, secondary regions collapse into one mobile pane switcher. Every workspace feature must be tested at `320`, `375`, `768`, `1024`, and `1440` pixels and at 200% zoom. No control may depend on hover alone.

## Tokens

Authoritative tokens live under `src/styles/tokens/` and `src/index.css`. New components must use semantic variables for surfaces, text, borders, focus, danger, warning, success, spacing, radii, and motion. Arbitrary colors and shadows require a documented exception.

## Interaction contract

Every async surface implements:

- loading or progress state;
- useful empty state;
- actionable error state;
- success confirmation when mutation is not otherwise visible;
- cancellation for long-running work where supported.

High-risk operations show scope and consequence in a native confirmation prompt. Disabled controls explain why. Destructive controls are not the default action.

## Accessibility floor

Target: WCAG 2.2 AA.

- semantic HTML before ARIA;
- visible `:focus-visible` treatment on every interactive element;
- logical tab order and no keyboard traps;
- dialogs use `aria-modal`, labels/descriptions, initial focus, contained focus, Escape handling, scroll lock, and focus restoration;
- tabs support arrows, Home, End, and roving `tabIndex`;
- status is not conveyed by color alone;
- motion respects `prefers-reduced-motion`;
- touch targets are at least 40×40 CSS pixels where space permits;
- editor and UI text remain readable at 200% zoom;
- tertiary text tokens maintain WCAG AA contrast on their primary surfaces;
- the editor follows the application light/dark theme until the user explicitly overrides it.

## Motion

Motion communicates state changes only. Default transitions are 120–220 ms using transform/opacity. Never animate layout-critical width/height continuously. Reduced-motion mode removes nonessential transitions and smooth scrolling.

## Component architecture

- data/orchestration lives in hooks or domain controllers;
- presentational components receive typed props;
- shared overlays use the unified dialog/panel primitive;
- components above 200 lines are decomposition candidates;
- packages expose behavior only through declared entry points;
- loading, empty, error, and success states are co-located with the owning surface.

## Visual verification

Playwright visual projects cover light/dark themes, desktop/mobile breakpoints, modal surfaces, editor/preview, knowledge workbench, settings, graph, and major workflow states. The frozen release candidate must additionally receive manual 200% zoom, screen-reader, and native-shell review until those checks are reliably automated. Pixel thresholds are intentionally low; snapshots must not mask full-page movement. See [`docs/validation/FRONTEND_QUALITY.md`](docs/validation/FRONTEND_QUALITY.md).
