/**
 * Optional dependency-cruiser mirror of the zero-dependency boundary gate in
 * scripts/validation/deep-module-boundaries.mjs. The repository gate does not
 * require a network install; teams that already use dependency-cruiser can run
 * `depcruise --config .dependency-cruiser.cjs src packages` for richer graphs.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-package-deep-imports',
      severity: 'error',
      comment: 'Import workspace packages through their package.json exports only.',
      from: { path: '^(?:src|packages)/' },
      to: { path: '^packages/(?:[^/]+|plugins/[^/]+)/src/(?!index\\.(?:ts|tsx)$)' },
    },
    {
      name: 'no-package-cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
    reporterOptions: { dot: { collapsePattern: 'node_modules/[^/]+' } },
  },
};
