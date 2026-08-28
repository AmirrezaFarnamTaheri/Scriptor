/**
 * Canonical outcome algebra for process, IPC, tool, persistence, and adapter
 * boundaries. Optional absence is the only outcome that may map to a default;
 * malformed state and execution failures must remain explicit.
 */
export type BoundaryOutcomeStatus =
  | 'value'
  | 'absent-optional'
  | 'invalid'
  | 'degraded'
  | 'failed'
  | 'recovered'

export type BoundaryOutcome<T, W = string, R = unknown> =
  | { status: 'value'; value: T }
  | { status: 'absent-optional'; value: T }
  | { status: 'invalid'; code: string; message: string }
  | { status: 'degraded'; value: T; warnings: W[] }
  | { status: 'failed'; code: string; message: string; recoverable: boolean }
  | { status: 'recovered'; value: T; receipt: R }

export const boundaryValue = <T>(value: T): BoundaryOutcome<T> => ({ status: 'value', value })
export const boundaryAbsent = <T>(value: T): BoundaryOutcome<T> => ({ status: 'absent-optional', value })
export const boundaryInvalid = (code: string, message: string): BoundaryOutcome<never> => ({ status: 'invalid', code, message })
export const boundaryFailed = (code: string, message: string, recoverable: boolean): BoundaryOutcome<never> => ({ status: 'failed', code, message, recoverable })
