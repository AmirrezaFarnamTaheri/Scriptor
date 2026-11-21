/** A public, self-signed localhost test certificate. The private key is deliberately
 * checked into this test-only module; it must never be used by a deployed relay.
 * No child process, OpenSSL installation, or network service is needed.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgdvSxp0QxnVBm7BkW
UdsWnpbyC/t395aBn3hSOJDJpbehRANCAAR1A+U1pJBDyUSz2jFmglntFmPabe28
1u5Dxjx4daoV7Pk5ExCzrirzyPgcH/SlxDKQsnyDLcKM8nI6DnpcfJ1T
-----END PRIVATE KEY-----
`

const cert = `-----BEGIN CERTIFICATE-----
MIIBmTCCAT+gAwIBAgIUKhvCpyq0WhIkSJQTxK1AOfuGbaswCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTEyMTEzMDY0MFoXDTM2MTExODEz
MDY0MFowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEdQPlNaSQQ8lEs9oxZoJZ7RZj2m3tvNbuQ8Y8eHWqFez5ORMQs64q88j4
HB/0pcQykLJ8gy3CjPJyOg56XHydU6NvMG0wHQYDVR0OBBYEFP3cNImJuLcx1Y89
V8EoKH5Q/hv7MB8GA1UdIwQYMBaAFP3cNImJuLcx1Y89V8EoKH5Q/hv7MA8GA1Ud
EwEB/wQFMAMBAf8wGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMAoGCCqGSM49
BAMCA0gAMEUCIQCZjUX+k9H03bq8yn+3Z2zPsT3Bn2TsUh4LmSRXw6LUwAIgIVT1
jRLl7mHfjnrSkPgU2LZpJ8zYQgO/wIjDk7RfOOE=
-----END CERTIFICATE-----
`

export function writeTestTlsFixture(directory) {
  const keyPath = join(directory, 'test-key.pem')
  const certPath = join(directory, 'test-cert.pem')
  writeFileSync(keyPath, key, { mode: 0o600 })
  writeFileSync(certPath, cert, { mode: 0o600 })
  return { keyPath, certPath }
}
