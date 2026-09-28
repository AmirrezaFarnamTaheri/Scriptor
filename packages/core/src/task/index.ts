/**
 * packages/core/src/task/index.ts — public barrel for the task cluster.
 *
 * Single export surface (I-5) for:
 *   - parseTasksFromMarkdown   — pure markdown → Task[]
 *   - serializeTask            — Task → markdown line (round-trip)
 *   - expandRecurrence         — rrule → PlannerDay[]
 *   - statusRegistry           — all known statuses and their metadata
 */

export { parseTasksFromMarkdown, serializeTask } from './taskParser.ts'
export { expandRecurrence } from './recurrence.ts'
export {
  statusRegistry,
  getStatusMeta,
  STATUS_ORDER,
  checkboxCharToStatus,
  statusToCheckboxChar,
  isTaskCheckboxChar,
  TASK_CHECKBOX_CHARS,
  TASK_CHECKBOX_CLASS_SOURCE,
  EXTENDED_TASK_CHECKBOX_CHARS,
  EXTENDED_TASK_CHECKBOX_CLASS_SOURCE,
  type StatusMeta,
} from './statusRegistry.ts'
export type {
  Task,
  TaskStatus,
  TaskFieldStyle,
  BuiltInTaskStatus,
  TaskQueryResult,
  KanbanBoard,
  KanbanColumn,
  PlannerDay,
} from '../contracts/task.ts'
