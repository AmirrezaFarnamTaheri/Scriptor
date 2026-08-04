# Design system

Scriptor is an **operate** interface: users open it to write, navigate, inspect, compare, and publish. Visual expression supports those tasks; it never competes with them.

## Direction

- Precise, quiet, luminous, and technical without imitating an IDE.
- Neutral charcoal/slate surfaces with one restrained teal accent (`#0f766e` light, `#2dd4bf` dark).
- Dense information is separated by hierarchy, rhythm, and dividers rather than nested cards.
- System sans-serif for UI and system monospace for code and numbers; no remote fonts.

## Layout

Desktop uses four functional regions:

1. top command bar;
2. vault/navigation rail;
3. editor/preview workspace;
4. contextual inspector and status surfaces.

At narrow widths, secondary regions collapse into the mobile workspace navigation. Workspace changes must be checked at `320`, `375`, `768`, `1024`, and `1440` pixels and at 200% zoom. No control may depend on hover alone.

## Anti-slop directives

- No default purple/indigo AI gradients.
- No oversized marketing typography in operational workspace surfaces.
- No decorative glassmorphism or ambient glow; tokenized glass effects are reserved for functional chrome.
- No emojis as structural UI icons; use the established Lucide icon set.
- No layout-shifting hover scale transforms.
- No invented performance scores, completion certificates, or verification claims without captured evidence.

## Tokens

Authoritative tokens live in `src/index.css` and `src/styles/`. New components must use semantic variables for surfaces, text, borders, focus, danger, warning, success, spacing, radii, and motion. Arbitrary colors and shadows require a documented exception.

| Token scope | Light mode | Dark mode | High contrast |
|---|---:|---:|---:|
| Primary accent | `#0f766e` | `#2dd4bf` | `#00ffff` |
| Primary background | `#f5f7fb` | `#030712` | `#000000` |
| Secondary surface | `rgba(255, 255, 255, 0.65)` | `rgba(11, 15, 26, 0.6)` | `#000000` |
| Primary text | `#1e293b` | `#f3f4f6` | `#ffffff` |
| Focus ring | theme-specific teal | theme-specific teal | yellow |

## Interaction contract

Every asynchronous surface must represent only states its owner can determine. Where supported, provide:

- loading or progress;
- useful empty state;
- actionable error state;
- visible mutation confirmation;
- cancellation for long-running work.

High-risk operations show scope and consequence in a native confirmation prompt. Disabled controls explain why. Destructive controls are not the default action.

## Accessibility floor

Target: WCAG 2.2 AA.

- semantic HTML before ARIA;
- visible `:focus-visible` treatment on every interactive element;
- logical tab order and no keyboard traps;
- modal dialogs use labels/descriptions, initial focus, contained focus, Escape handling, scroll lock, and focus restoration;
- tabs support arrows, Home, End, and roving `tabIndex`;
- status is not conveyed by color alone;
- motion respects `prefers-reduced-motion`;
- touch-oriented controls are at least 44×44 CSS pixels;
- editor and UI text remain readable at 200% zoom;
- tertiary text tokens maintain WCAG AA contrast on their primary surfaces;
- the editor follows the application light/dark theme until the user explicitly overrides it.

## Motion

Motion communicates state changes only. Default transitions are 120–220 ms using opacity or transforms that do not alter containing-block semantics. Never animate layout-critical width or height continuously. Reduced-motion mode removes nonessential transitions and smooth scrolling.

## Component architecture

- data and orchestration live in hooks or domain controllers;
- presentational components receive typed props;
- shared overlays use the unified dialog/panel primitive;
- components above 200 lines are decomposition candidates;
- packages expose behavior only through declared entry points;
- loading, empty, error, and success states remain with the owner that can truthfully determine them.

## Visual verification

Playwright projects cover light/dark themes, desktop/mobile breakpoints, modal surfaces, editor/preview, knowledge workbench, settings, graph, and major workflow states. The frozen release candidate additionally requires manual 200% zoom, screen-reader, and native-shell review until those checks are reliably automated. Snapshot thresholds must not mask full-page movement. See [`docs/validation/FRONTEND_QUALITY.md`](docs/validation/FRONTEND_QUALITY.md).
