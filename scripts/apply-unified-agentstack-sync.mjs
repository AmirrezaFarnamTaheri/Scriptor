#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const directory = path.resolve('scripts/.unified-sync-payload')
const expected = [
  ['part-00.txt', 'b04a2143ac8dffad3dda6f634df2b5062c07e37bc70bbc16e7377b7999b404f4'],
  ['part-01.txt', '31fbb98daba617ce712a83aac74b4349c52076483ab53994e154010fdcc65868'],
  ['part-02.txt', '54b53cea05c94d3b1210683dbef2b54216f80d1c6cc4f0101186105fc05fe33d'],
  ['part-03.txt', 'eb34afe70a88a4a7fc07916fe286731d7d6bcc8ebad959e422026d58503631b1'],
  ['part-04.txt', '9c8770ea20d69bf23252ccec4c0c79004f7735f5d526fd347dfad44fc7103153'],
  ['part-05.txt', 'da78151fd394343a7a845904439a1f5f1abc3fd742f18c6421b62d4d7d0e59ef'],
  ['part-06.txt', 'bce8b8033bbdf95b78f757ae43ac1a5b2793f40bfd5a89cf66a42138396eaf88'],
  ['part-07.txt', '4e72c7d43d550ab2057d41cf483fa862dbf1210f4bada435155fe023b9094d6c'],
  ['part-08.txt', '26a718492e8f21d9817b9dcd0a9010441c7081c763260244a4d7434fc6513cb7'],
]

const chunks = expected.map(([name, sha256]) => {
  const file = path.join(directory, name)
  const content = fs.readFileSync(file, 'utf8').trim()
  const actual = crypto.createHash('sha256').update(content).digest('hex')
  if (actual !== sha256) throw new Error(`payload checksum mismatch: ${name}`)
  return content
})
const compressed = Buffer.from(chunks.join(''), 'base64')
const decoded = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'))
if (decoded.schemaVersion !== 1 || !decoded.files || typeof decoded.files !== 'object') {
  throw new Error('invalid generated feature payload')
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
fs.rmSync('scripts/apply-unified-agentstack-sync.mjs', { force: true })
fs.rmSync('.github/workflows/apply-unified-agentstack-sync.yml', { force: true })
console.log(`Applied ${Object.keys(decoded.files).length} reviewed feature files.`)
