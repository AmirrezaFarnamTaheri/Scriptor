#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const directory = path.resolve('scripts/.resource-sync-grounding')
const partNames = ['part-00.txt', 'part-01.txt']
const expectedFiles = new Map([
  ['apps/desktop/src-tauri/src/commands/resources/catalog.rs', '95f0144c04df0575ca64c3b5d92a97175deb015cdc8bf7c38a9ddf1307c2ecb8'],
  ['apps/desktop/src-tauri/src/commands/resources/discovery.rs', 'd53cdc636fcd084b08849234c70a879b55d12925404d50fccdaf457afd6f32af'],
  ['apps/desktop/src-tauri/src/commands/resources/mod.rs', 'eefc586a560e41d60e12f282aebf84ea2d508b4c2170ea822ebe0191082ab371'],
  ['src/bridge/commands/resources.ts', 'd015204c41d21ba4bc8340300f1228c3c9f2761901df471db197f20efc26be0b'],
  ['src/components/ResourceSyncPanel.tsx', '7158e23440e639efddc98af4079f2b61553a7a6ba9ededbe20fba2a6c4af89b5'],
  ['src/styles/components/resource-sync.css', '8eacd158a3f4f2e55b9925edc561b519e5b888b0c596683ea5764b4287ee09ca'],
  ['scripts/validation/resource-sync-contracts.test.mjs', 'c2a0da3a52e2348b117a3d307293fd575861b0d7fd59a873d08f13af76c6085b'],
  ['docs/guides/SHARING_AND_SYNC.md', '683b069f094d7ef544ace054cd6cda4ec885277336df256f3883f63b2100a33b'],
])

const encoded = partNames
  .map((name) => fs.readFileSync(path.join(directory, name), 'utf8').trim())
  .join('')
const decoded = JSON.parse(zlib.gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
if (decoded.schemaVersion !== 1 || !decoded.files || typeof decoded.files !== 'object') {
  throw new Error('invalid resource grounding payload')
}
const actualPaths = Object.keys(decoded.files).sort()
const expectedPaths = [...expectedFiles.keys()].sort()
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  throw new Error('resource grounding payload has an unexpected file set')
}
for (const [relative, expectedSha256] of expectedFiles) {
  const content = decoded.files[relative]
  if (typeof content !== 'string') throw new Error(`missing generated file: ${relative}`)
  const actualSha256 = crypto.createHash('sha256').update(content).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`decoded file checksum mismatch: ${relative}`)
  }
  if (path.isAbsolute(relative) || relative.split(/[\\/]+/).includes('..')) {
    throw new Error(`unsafe generated path: ${relative}`)
  }
  const destination = path.resolve(relative)
  if (!destination.startsWith(process.cwd() + path.sep)) {
    throw new Error(`generated path escaped repository: ${relative}`)
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, content, 'utf8')
}
fs.rmSync(directory, { recursive: true, force: true })
fs.rmSync('scripts/apply-resource-sync-grounding.mjs', { force: true })
fs.rmSync('.github/workflows/apply-grounded-resource-corrections.yml', { force: true })
console.log(`Applied ${expectedFiles.size} decoded files with exact SHA-256 verification.`)
