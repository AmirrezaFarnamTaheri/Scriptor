import type { McpMode } from '@scriptor/core/contracts/mcp'

const MODE_RANK: Record<McpMode, number> = {
  off: 0,
  'read-only': 1,
  draft: 2,
  'write-approved': 3,
}

export function modeAllowsTool(mode: McpMode, required: McpMode): boolean {
  if (mode === 'off') return false
  return MODE_RANK[mode] >= MODE_RANK[required]
}

export function nextMcpMode(mode: McpMode): McpMode {
  switch (mode) {
    case 'off':
      return 'read-only'
    case 'read-only':
      return 'draft'
    case 'draft':
      return 'write-approved'
    case 'write-approved':
      return 'off'
  }
}

export function runPermissionTests(): string[] {
  const failures: string[] = []

  const expect = (label: string, value: boolean) => {
    if (!value) failures.push(label)
  }

  expect('read-only allows search', modeAllowsTool('read-only', 'read-only'))
  expect('off denies search', !modeAllowsTool('off', 'read-only'))
  expect('read-only denies write-approved', !modeAllowsTool('read-only', 'write-approved'))
  expect('draft allows read-only tools', modeAllowsTool('draft', 'read-only'))
  expect('draft allows propose patch tool', modeAllowsTool('draft', 'draft'))
  expect('draft denies write-approved tool rank', !modeAllowsTool('draft', 'write-approved'))
  expect('mode cycle returns to off', nextMcpMode(nextMcpMode(nextMcpMode(nextMcpMode('off')))) === 'off')

  return failures
}
