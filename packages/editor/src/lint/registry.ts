/**
 * @scriptor/editor — Lint rule registry (W2-5)
 *
 * The registry is the single source of truth for all active lint rules.
 * Rules are registered by ID; duplicate IDs throw at registration time.
 *
 * Built-in rules are registered in `rules/index.ts` and imported
 * automatically when the editor initialises. Plugin rules call
 * `registerRule()` from their setup hook.
 */

import type { LintRule } from './types.ts'

const _rules = new Map<string, LintRule>()

/**
 * Register a lint rule.
 * @throws {Error} If a rule with the same `id` is already registered.
 */
export function registerRule(rule: LintRule): void {
  if (_rules.has(rule.id)) {
    throw new Error(
      `[lint registry] Duplicate rule id "${rule.id}". Each rule id must be unique.`,
    )
  }
  _rules.set(rule.id, rule)
}

/**
 * Register multiple rules at once. Throws on the first duplicate.
 */
export function registerRules(rules: LintRule[]): void {
  for (const rule of rules) registerRule(rule)
}

/**
 * Return a copy of all registered rules.
 * Mutating the returned array has no effect on the registry.
 */
export function getAllRules(): LintRule[] {
  return [..._rules.values()]
}

/**
 * Look up a rule by its stable ID.
 * Returns `undefined` if the rule is not registered.
 */
export function getRule(id: string): LintRule | undefined {
  return _rules.get(id)
}

/**
 * Remove a rule by id. Primarily for testing; production code should not
 * unregister built-in rules.
 */
export function unregisterRule(id: string): boolean {
  return _rules.delete(id)
}

/** Remove all registered rules. For test isolation only. */
export function clearRules(): void {
  _rules.clear()
}
