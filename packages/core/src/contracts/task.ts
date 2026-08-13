/**
 * task.ts — Contract types for the tasks / planning cluster.
 *
 * Additive only (I-9). Dates are always stored as ISO-8601 strings on disk
 * (F-6/D10); natural language is input-only and never persisted.
 *
 * A status is declared once and understood by parser, renderer, query, and
 * index. Unknown statuses round-trip unchanged rather than being normalised.
 */

/** Built-in statuses; custom statuses are plain strings */
export type BuiltInTaskStatus =
  | "open"
  | "done"
  | "cancelled"
  | "forwarded"
  | "in-progress";

export type TaskStatus = BuiltInTaskStatus | string;

/** Field styles supported by the task parser */
export type TaskFieldStyle = "emoji" | "dataview";

export interface Task {
  id: string;
  noteId: string;
  /** Line number in the note (0-based) */
  line: number;
  status: TaskStatus;
  text: string;
  /** ISO-8601 date or null */
  due?: string | null;
  /** ISO-8601 date or null */
  scheduled?: string | null;
  /** ISO-8601 date or null */
  start?: string | null;
  tags: string[];
  /** RRULE string for recurring tasks; natural language is never stored */
  rrule?: string | null;
  /** Which field style was used in the source file */
  fieldStyle: TaskFieldStyle;
}

export interface TaskQueryResult {
  tasks: Task[];
  totalCount: number;
}

export interface KanbanColumn {
  name: string;
  taskIds: string[];
}

export interface KanbanBoard {
  noteId: string;
  columns: KanbanColumn[];
}

export interface PlannerDay {
  date: string; // ISO-8601
  tasks: Task[];
}
