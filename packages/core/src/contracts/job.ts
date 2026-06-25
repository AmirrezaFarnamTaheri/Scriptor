export type JobKind = 'scan' | 'index' | 'export' | 'git' | 'mcp' | 'ai'
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface JobDescriptor {
  id: string
  kind: JobKind
  label: string
  state: JobState
  progress?: number
  startedAt?: string
  finishedAt?: string
  logPath?: string
}

export interface CancelJobInput {
  jobId: string
}

export interface CancelJobOutput {
  job: JobDescriptor
}

