const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /Bearer\s+\S+/gi, replacement: 'Bearer [REDACTED]' },
  // `"?` after the key covers JSON-quoted keys like `"password": "hunter2"`.
  { pattern: /(api[_-]?key|token|secret|password)("?)\s*[:=]\s*("[^"]*"|\S+)/gi, replacement: '$1$2=[REDACTED]' },
  { pattern: /sk-[A-Za-z0-9]{8,}/g, replacement: 'sk-[REDACTED]' },
]

export function redactSensitiveText(input: string): string {
  let output = input
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    output = output.replace(pattern, replacement)
  }
  return output
}

export function redactAuditDetail(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value)
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]'
    seen.add(value)
    return value.map((item) => redactAuditDetail(item, seen))
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]'
    seen.add(value)
    const record = value as Record<string, unknown>
    // Null-prototype accumulator so hostile own keys like `__proto__` become
    // plain data properties instead of hitting the prototype setter.
    const next: Record<string, unknown> = Object.create(null)
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
        next[key] = redactAuditDetail(item, seen)
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

  const quoted = redactSensitiveText('{"password": "hunter2", "note": "ok"}')
  if (quoted.includes('hunter2')) failures.push('JSON-quoted password should be redacted')
  if (!quoted.includes('"note": "ok"')) failures.push('JSON non-secret fields should remain')

  const hostile = redactAuditDetail(JSON.parse('{"__proto__": {"polluted": true}}')) as Record<
    string,
    unknown
  >
  const protoDescriptor = Object.getOwnPropertyDescriptor(hostile, '__proto__')
  if (!protoDescriptor) failures.push('own __proto__ key should be kept as a data property')
  if (({} as { polluted?: boolean }).polluted !== undefined) {
    failures.push('redaction must not poison Object.prototype')
  }

  const cyclic: { name: string; self?: unknown } = { name: 'loop' }
  cyclic.self = cyclic
  try {
    const redactedCycle = redactAuditDetail(cyclic) as Record<string, unknown>
    if (redactedCycle.self !== '[CIRCULAR]') failures.push('cyclic reference should be marked [CIRCULAR]')
  } catch {
    failures.push('cyclic input should not throw')
  }

  return failures
}
