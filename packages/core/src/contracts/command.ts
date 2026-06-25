export type CommandPermission = 'read' | 'write-approved' | 'system' | 'dangerous'

export type CommandOwner =
  | 'ui'
  | 'rust-vault'
  | 'rust-indexer'
  | 'rust-export'
  | 'rust-git'
  | 'rust-canvas'
  | 'mcp'
  | 'plugin'

export interface CommandEnvelope<TInput = unknown> {
  id: string
  requestId: string
  issuedAt: string
  owner: CommandOwner
  permission: CommandPermission
  input: TInput
  dryRun?: boolean
}

export interface CommandError {
  code: string
  message: string
  recoverable: boolean
  details?: Record<string, unknown>
  rollbackHint?: string
}

export type CommandResult<TOutput = unknown> =
  | { ok: true; requestId: string; output: TOutput; events?: DomainEvent[] }
  | { ok: false; requestId: string; error: CommandError; events?: DomainEvent[] }

export interface DomainEvent<TPayload = unknown> {
  id: string
  type: string
  emittedAt: string
  payload: TPayload
}

