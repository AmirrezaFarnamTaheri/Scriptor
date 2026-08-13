/**
 * @scriptor/editor — Built-in lint rules (W2-6)
 *
 * Imports and exports all six built-in rules. Call `registerBuiltins()` once
 * during editor initialisation. `broken-wikilink` requires a vault resolver
 * and is registered separately via `brokenWikilinkRule(options)`.
 */

export { missingHeading }   from './missing-heading.ts'
export { noBareUrl }        from './no-bare-url.ts'
export { noDoubleBlank }    from './no-double-blank.ts'
export { trailingSpaces }   from './trailing-spaces.ts'
export { noHeadingSkip }    from './no-heading-skip.ts'
export { brokenWikilinkRule } from './broken-wikilink.ts'

import { missingHeading }   from './missing-heading.ts'
import { noBareUrl }        from './no-bare-url.ts'
import { noDoubleBlank }    from './no-double-blank.ts'
import { trailingSpaces }   from './trailing-spaces.ts'
import { noHeadingSkip }    from './no-heading-skip.ts'
import { registerRules }    from '../registry.ts'

/**
 * Register the five auto-applicable built-in rules.
 * `brokenWikilinkRule` is omitted here — register it separately with a vault resolver:
 * ```ts
 * import { brokenWikilinkRule } from '@scriptor/editor/lint/rules'
 * registerRule(brokenWikilinkRule({ resolver: vaultLookup }))
 * ```
 */
export function registerBuiltins(): void {
  registerRules([
    missingHeading,
    noBareUrl,
    noDoubleBlank,
    trailingSpaces,
    noHeadingSkip,
  ])
}
