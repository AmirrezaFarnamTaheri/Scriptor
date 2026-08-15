/**
 * @scriptor/editor — Lint subsystem public API
 *
 * Re-exports the types, runner, registry, and built-in rules so consumers
 * can import from `@scriptor/editor/lint` rather than deep-linking into
 * individual files.
 */

export type { LintRule, LintDiagnostic, LintFix, LintSeverity } from './types.ts'
export { applyFixes }                                            from './types.ts'
export { runLint, protectedRegions }                             from './run.ts'
export type { Range, RunLintOptions }                            from './run.ts'
export {
  registerRule,
  registerRules,
  getAllRules,
  getRule,
  unregisterRule,
  clearRules,
}                                                                from './registry.ts'
export { registerBuiltins }                                      from './rules/index.ts'
export {
  missingHeading,
  noBareUrl,
  noDoubleBlank,
  trailingSpaces,
  noHeadingSkip,
  brokenWikilinkRule,
}                                                                from './rules/index.ts'
