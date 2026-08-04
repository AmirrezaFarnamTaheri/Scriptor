# Scriptor design-system reference

`src/index.css` is the executable source of truth for theme values. `DESIGN.md` defines the product-level design and accessibility principles. This file is a compact implementation reference; it must not override either source.

## Character

Scriptor is a quiet, precise knowledge-work interface. It should feel technical without imitating an IDE or a marketing landing page. Hierarchy, spacing, borders, and typography carry the design; decorative effects remain restrained.

## Theme tokens

Use the existing semantic variables. Do not copy these values into component styles.

| Role | Light | Dark | High contrast | Runtime variable |
|---|---:|---:|---:|---|
| Background | `#f5f7fb` | `#030712` | `#000000` | `--bg` |
| Elevated background | `#ffffff` | `#0b0f19` | `#0a0a0a` | `--bg-elevated` |
| Primary text | `#1e293b` | `#f3f4f6` | `#ffffff` | `--ink` |
| Muted text | `#475569` | `#9ca3af` | `#e8e8e8` | `--muted` |
| Primary accent | `#0f766e` | `#2dd4bf` | `#00ffff` | `--primary` |
| Strong accent | `#0f766e` | `#14b8a6` | `#00e5e5` | `--primary-strong` |
| Focus ring | theme-specific | theme-specific | yellow | `--focus-ring` |

## Typography

Use the stacks already declared in `src/index.css`:

- UI/display: `var(--font-display)` and `var(--font-body)`.
- Code, paths, and numeric technical data: `var(--font-mono)`.
- System or locally bundled fonts only. Do not add Google Fonts or any remote `@import`.

## Component examples

```css
.primary-button {
  background: var(--primary-strong);
  color: var(--bg);
  border: 1px solid var(--primary-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  transition: background var(--ease-fast), border-color var(--ease-fast);
}

.secondary-button {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
}

.surface-card {
  background: var(--surface-raised);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.text-input:focus-visible {
  outline: var(--focus-outline);
  box-shadow: var(--focus-ring);
}
```

Never use a low-contrast hard-coded foreground such as `#1e293b` on the dark background. Semantic variables adapt to each theme.

## Interaction rules

- Prefer semantic HTML and native controls.
- Keep focus visible and keyboard order logical.
- Use Lucide icons consistently; icons supplement, not replace, accessible names.
- Do not place buttons or other labelable controls inside a checkbox or input label.
- Avoid layout-shifting hover transforms.
- Respect `prefers-reduced-motion`.
- Use `UnifiedPanelShell` for shared modal/docked panel behavior.
- Keep visual tooltips `aria-hidden` when the trigger already has a complete accessible name.
- Test narrow mobile layouts, 200% zoom, light/dark/high-contrast themes, and keyboard navigation.

## Verification

Run the relevant repository checks and record only observed results:

- `pnpm lint`
- `pnpm build`
- `pnpm check:frontend-quality`
- `pnpm check:a11y`
- `pnpm check:a11y-axe`
- `pnpm test:e2e`
- `pnpm test:visual`
