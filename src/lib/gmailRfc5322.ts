/**
 * Helpers for formatting and encoding RFC 5322 email messages for the Gmail API.
 */

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildRfc5322Message(to: string, subject: string, body: string): string {
  const normalizedBody = body.replace(/\r?\n/g, '\r\n')
  const email = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${normalizedBody}\r\n`
  const encoder = new TextEncoder()
  return encodeBase64Url(encoder.encode(email))
}

/**
 * Safely encodes a scalar value as a YAML double-quoted flow scalar string.
 * Prevents YAML front-matter injection attacks from fields containing newlines,
 * unescaped quotes, or unexpected characters.
 */
export function toYamlScalar(value: unknown): string {
  return JSON.stringify(String(value ?? ''))
}
