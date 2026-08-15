/**
 * @scriptor/template-engine
 *
 * Public API surface.  Consumers should prefer the named deep imports
 * (`@scriptor/template-engine/parse`, etc.) to reduce bundle size.
 */

// Parse
export { parse, ParseError } from './parse.ts'
export type { TemplateNode, Literal, Interpolation, PipeCall, IfOpen, ForOpen, BlockEnd } from './parse.ts'

// Filters
export { BUILTIN_FILTERS, BUILTIN_FILTER_NAMES } from './filters.ts'
export type { FilterFn } from './filters.ts'

// Evaluator
export { evaluate } from './eval.ts'
export type { TemplateResult, EvalOptions, NamespaceMap } from './eval.ts'

// Variables
export {
  makeVariableContext,
  resolveVariable,
  resolveAllVariables,
  BUILTIN_VARIABLE_RESOLVERS,
  BUILTIN_VARIABLE_NAMES,
} from './variables.ts'
export type { VariableContext, ResolverFn } from './variables.ts'
