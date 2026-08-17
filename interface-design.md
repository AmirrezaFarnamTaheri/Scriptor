# Scriptor Interface Design System Contract

> **Contract Authority:** Canonical Utilitarian Desktop Interface Design System Contract for Scriptor (`D:\GitHub\Scriptor`). Evaluated against DFII $\ge 8$, WCAG 2.2 AA accessibility floor, and anti-slop visual directives (`DESIGN.md:1-88`).

## 1. Application Context & Design Stance

- **Domain:** Local-first desktop writing and research workspace (built with Tauri 2 + React 19 + Vite 8 + Rust 1.96).
- **Aesthetic Stance:** Utilitarian, high-density, technical, minimalist, and information-focused. Designed for long-form writing, document indexing, citation management, canvas spatial research, and Markdown editing.
- **Color Palette & Contrast:** High-contrast light and dark modes driven strictly by CSS custom properties (`--bg`, `--bg-subtle`, `--fg`, `--fg-muted`, `--border`, `--focus-ring`, `--primary`, `--primary-fg`). Zero hardcoded hex values in component code.
- **Typography:**
  - System font stack for UI labels and body text (`Inter`, system-ui, sans-serif).
  - Monospace font stack (`JetBrains Mono`, `Fira Code`, `ui-monospace`) for note IDs, timestamps, file paths, hashes, code blocks, and data tables.
  - Tabular Numbers (`font-variant-numeric: tabular-nums`) strictly required on all numeric columns, table cells, counters, and progress indicators to prevent horizontal layout shift during value updates.

---

## 2. Component System Architecture

- **Primitives Layer:** Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`) providing keyboard navigation, ARIA roles, and focus trapping.
- **Icons Layer:** Lucide React icons only (`lucide-react`). Emojis are strictly banned as UI icons or structural indicators.
- **Card & Container Styling:** Border-only separation (`border border-border`) with subtle background differentiation (`bg-bg-subtle`). Glassmorphism, blurred backdrop filters, and heavy drop shadows are prohibited (`DESIGN.md:23-31`).
- **Interactive Controls & Touch Targets:**
  - Minimum interactive touch target size: $44\times 44\text{px}$ (or padded bounding box).
  - Mandatory hover class: `cursor-pointer` on all clickable buttons, links, table rows, and interactive tags.
  - Visible focus rings: `focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none` on all focusable elements.

---

## 3. Layout Patterns & Density

- **Workspace Grid:**
  - Sidebar: Collapsible 240px default width (min 200px, max 380px) with keyboard shortcut toggle (`Cmd/Ctrl+\`).
  - Header: 48px fixed height top navigation bar containing vault selector, breadcrumbs, search trigger (`Cmd/Ctrl+K`), and status indicators.
  - Main Panel: Flexible content area hosting split views (Editor, Canvas, Graph, Preview, PDF Viewer).
- **Density Profiles:**
  - Compact: 28px row height in file tree and data tables.
  - Standard: 36px control height for input fields, buttons, and dropdown triggers.

---

## 4. Full State Matrices Requirement

Every UI component and view panel MUST explicitly handle 5 core interactive states:
1. **Loading State:** Skeleton shimmer loaders (`animate-pulse bg-bg-subtle`) matching exact structural dimensions of target content.
2. **Empty State:** Clean, helpful empty state message with a primary call-to-action button (e.g. "No notes found in vault. Create Note").
3. **Actionable Error State:** Inline alert banner (`border-red-500/20 bg-red-500/10 text-red-400`) describing the failure and providing a "Retry" or "Dismiss" action.
4. **Mutation Confirmation State:** Optimistic UI update with subtle background flash or toast notification.
5. **Cancellation / Escape State:** `Escape` key handling on all modals, overlays, inline editors, and search bars.

---

## 5. Verification & Compliance Checklist

- [x] DFII score evaluated ($\ge 8$).
- [x] All numeric table columns use `tabular-nums`.
- [x] All IDs, hashes, timestamps, and paths use `monospace`.
- [x] Touch targets $\ge 44\times 44\text{px}$ with `cursor-pointer`.
- [x] WCAG 2.2 AA contrast ratios verified (4.5:1 text, 3:1 controls).
- [x] 0 unapproved CSS inline styles or hardcoded hex colors.
