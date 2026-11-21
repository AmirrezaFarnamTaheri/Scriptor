import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { writeTestTlsFixture } from './tls-fixture.mjs'

test('test-only localhost certificate matches private key and never grants world access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-localhost-tls-'))
  try {
    const { keyPath, certPath } = writeTestTlsFixture(dir)
    const privateKey = createPrivateKey(readFileSync(keyPath))
    const certificate = new X509Certificate(readFileSync(certPath))
    const actual = createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
    const expected = certificate.publicKey.export({ type: 'spki', format: 'der' })
    assert.deepEqual(actual, expected, 'TLS fixture must be a real matching key and certificate')
    assert.match(certificate.subject, /CN=localhost/)
    assert.match(certificate.subjectAltName, /DNS:localhost, IP Address:127\.0\.0\.1/)
    if (process.platform !== 'win32') assert.equal(statSync(keyPath).mode & 0o077, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
