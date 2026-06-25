# `@scriptor/renderer`

Sanitized Markdown preview pipeline and web worker for off-main-thread rendering.

## Shipped

- Remark/rehype pipeline with GFM, math (KaTeX), syntax highlight, and wikilink embed hydration.
- Preview worker with debounced updates (250ms budget target).
- Hostile Markdown fixtures and validate runner.

## Validation

```powershell
pnpm check:renderer
```

Preview worker entry: `packages/renderer/src/preview.worker.ts`.
