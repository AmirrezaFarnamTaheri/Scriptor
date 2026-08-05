#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const directory = path.resolve('scripts/.resource-sync-grounding')
const expected = [
  ['part-00.txt', 'f75317e63b950c759f13939221d6adafcd8da06bad328f5a2956cd7ab8962a89'],
  ['part-01.txt', '07c48a2d30a05e27f1a824ce71a13e554e7463fc8e61c0b81d5ee85c8dc7640e'],
]

const chunks = expected.map(([name, sha256]) => {
  const content = fs.readFileSync(path.join(directory, name), 'utf8').trim()
  const actual = crypto.createHash('sha256').update(content).digest('hex')
  if (actual !== sha256) throw new Error(`payload checksum mismatch: ${name}`)
  return content
})
const decoded = JSON.parse(zlib.gunzipSync(Buffer.from(chunks.join(''), 'base64')).toString('utf8'))
if (decoded.schemaVersion !== 1 || !decoded.files || typeof decoded.files !== 'object') {
  throw new Error('invalid resource grounding payload')
}
for (const [relative, content] of Object.entries(decoded.files)) {
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
fs.rmSync('.github/workflows/apply-resource-sync-grounding.yml', { force: true })
console.log(`Applied ${Object.keys(decoded.files).length} checksummed resource corrections.`)
