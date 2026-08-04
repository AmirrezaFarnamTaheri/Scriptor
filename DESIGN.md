# Design system

Scriptor is an **operate** interface: users open it to write, navigate, inspect, compare, and publish. Visual expression supports those tasks; it never competes with them.

## Direction

- Precise, quiet, luminous, technical without feeling like an IDE.
- Neutral charcoal/slate surfaces with one restrained teal accent (`#0f766e` light, `#2DD4BF` dark).
- **DFII (Design Feasibility & Impact Index):** `+13 / 15` (High Aesthetic Impact, Low Performance Risk, Strict Theme Consistency).
- Dense information is separated by hierarchy, rhythm, and dividers rather than nested cards.
- System sans-serif for UI and system monospace for code/numbers; no remote fonts.

## Deslop & Anti-Slop Directives

- ❌ No default purple/indigo AI gradients (`bg-indigo-500` or `from-purple-500`).
- ❌ No blob rounded card edges (`radius > 16px` on small cards).
- ❌ No decorative glassmorphism or floating neon ambient orbs.
- ❌ No emojis used as structural UI icons (SVG Lucide icons only).
- ❌ No layout-shifting hover scale transforms.

## Tokens

Authoritative tokens live under `src/styles/tokens/` and `src/index.css`. New components must use semantic variables for surfaces, text, borders, focus, danger, warning, success, spacing, radii, and motion. Arbitrary colors and shadows require a documented exception.

| Token Scope | Light Mode | Dark Mode | High Contrast |
| :--- | :--- | :--- | :--- |
| **Primary Accent** | `#0f766e` | `#2DD4BF` | `#00ffff` |
| **Primary Surface** | `#f5f7fb` | `#030712` | `#000000` |
| **Secondary Surface** | `rgba(255, 255, 255, 0.65)` | `rgba(11, 15, 25, 0.6)` | `#000000` |
| **Primary Text** | `#1e293b` | `#f3f4f6` | `#ffffff` |
| **Focus Ring** | `rgba(15, 118, 110, 0.25)` | `rgba(45, 212, 191, 0.25)` | `#ffff00` |

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
