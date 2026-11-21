/** A public, self-signed localhost test certificate. The private key is deliberately
 * checked into this test-only module; it must never be used by a deployed relay.
 * No child process, OpenSSL installation, or network service is needed.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const key = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgVurC13TPaa/jiSHv
WsQVVFOdeHILxY1ouOHbP7FRzhehRANCAARxxzCLIpXRFIW2z/iFh7ORV2YbMNsU
Bn/E4Nbt3AaHxOzZamVEI1PEuitWsAcUypCbPYIgozOnZBehbV9eqFUr
-----END PRIVATE KEY-----
`

const cert = `-----BEGIN CERTIFICATE-----
MIIBmTCCAT+gAwIBAgIUYdiMsrDAsrPKUl+jiyU/HtRsg58wCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTEyMTEzMTg0OFoXDTM2MTExODEz
MTg0OFowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEcccwiyKV0RSFts/4hYezkVdmGzDbFAZ/xODW7dwGh8Ts2WplRCNTxLor
VrAHFMqQmz2CIKMzp2QXoW1fXqhVK6NvMG0wHQYDVR0OBBYEFC7qs7tcNC/w0j5e
ox4cwWahc7PIMB8GA1UdIwQYMBaAFC7qs7tcNC/w0j5eox4cwWahc7PIMA8GA1Ud
EwEB/wQFMAMBAf8wGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMAoGCCqGSM49
BAMCA0gAMEUCIQCG8SfdgnDXOlx3EbaprZZwkLlMw7ozjZ8Su4PC0a5PXAIgQ53q
nk4EcaxLWey/fWQ110bANG6KfOdEMFBVHfmfrIM=
-----END CERTIFICATE-----
`

export function writeTestTlsFixture(directory) {
  const keyPath = join(directory, 'test-key.pem')
  const certPath = join(directory, 'test-cert.pem')
  writeFileSync(keyPath, key, { mode: 0o600 })
  writeFileSync(certPath, cert, { mode: 0o600 })
  return { keyPath, certPath }
}
