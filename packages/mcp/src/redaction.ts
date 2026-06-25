const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Bearer\s+\S+/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi, replacement: '$1=[REDACTED]' },
  { pattern: /sk-[A-Za-z0-9]{8,}/g, replacement: 'sk-[REDACTED]' },
]

export function redactSensitiveText(input: string): string {
  let output = input
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    output = output.replace(pattern, replacement)
  }
  return output
}

export function redactAuditDetail(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value)
  }
  if (Array.isArray(value)) {
    return value.map(redactAuditDetail)
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(record)) {
      const keyLower = key.toLowerCase()
      if (
        keyLower.includes('token') ||
        keyLower.includes('secret') ||
        keyLower.includes('password') ||
        keyLower.endsWith('_key') ||
        keyLower === 'api_key'
      ) {
        next[key] = '[REDACTED]'
      } else {
        next[key] = redactAuditDetail(item)
      }
    }
    return next
  }
  return value
}

export function runRedactionTests(): string[] {
  const failures: string[] = []
  const bearer = redactSensitiveText('Authorization: Bearer abc123secret')
  if (bearer.includes('abc123secret')) failures.push('bearer token should be redacted')
  if (!bearer.includes('[REDACTED]')) failures.push('bearer placeholder missing')

  const apiKey = redactSensitiveText('api_key=super-secret-value')
  if (apiKey.includes('super-secret-value')) failures.push('api key should be redacted')

  const json = redactAuditDetail({ api_key: 'hidden', note: 'hello' }) as Record<string, unknown>
  if (json.api_key !== '[REDACTED]') failures.push('json api_key field should be redacted')
  if (json.note !== 'hello') failures.push('json non-secret fields should remain')

  return failures
}
