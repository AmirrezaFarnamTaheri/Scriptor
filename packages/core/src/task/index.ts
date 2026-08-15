/**
 * packages/core/src/task/index.ts — public barrel for the task cluster.
 *
 * Single export surface (I-5) for:
 *   - parseTasksFromMarkdown   — pure markdown → Task[]
 *   - serializeTask            — Task → markdown line (round-trip)
 *   - expandRecurrence         — rrule → PlannerDay[]
 *   - statusRegistry           — all known statuses and their metadata
 */

export { parseTasksFromMarkdown, serializeTask } from './taskParser'
export { expandRecurrence } from './recurrence'
export {
  statusRegistry,
  getStatusMeta,
  STATUS_ORDER,
  checkboxCharToStatus,
  statusToCheckboxChar,
  type StatusMeta,
} from './statusRegistry'
export type {
  Task,
  TaskStatus,
  TaskFieldStyle,
  BuiltInTaskStatus,
  TaskQueryResult,
  KanbanBoard,
  KanbanColumn,
  PlannerDay,
} from '../contracts/task'
