# TypeScript deep modules

Each workspace package exposes a small public interface through its `package.json` `exports` map. Implementation may live anywhere inside that package, but code outside the package must import only an exported package path such as `@scriptor/editor` or `@scriptor/renderer/preview`.

Do not import `packages/<name>/src/...`, use cross-package relative paths, or create an index file that re-exports an entire subtree. Add several narrow export entry points when distinct clients need distinct surfaces.

```text
packages/<name>/
  package.json       # declares public exports
  src/index.ts       # primary entry point
  src/<internal>.ts  # private unless explicitly exported
```

Rules:

1. outsiders use declared exports only;
2. files inside one package may import their own internals;
3. tests exercise the package through its public exports unless they are true unit tests co-located with an internal implementation;
4. workspace package dependency cycles are forbidden.

Run `pnpm lint:boundaries`. The repository-native validator works without installed dependencies. `.dependency-cruiser.cjs` mirrors the policy for teams that run dependency-cruiser graph reports.
