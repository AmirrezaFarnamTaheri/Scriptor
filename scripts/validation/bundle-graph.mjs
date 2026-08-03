#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '../..')
const dist = path.resolve(process.argv[2] ?? path.join(root, 'dist'))
const budgetBytes = Number(process.env.SCRIPTOR_INITIAL_JS_GZIP_BUDGET ?? 900 * 1024)
const htmlPath = path.join(dist, 'index.html')
const manifestPath = path.join(dist, '.vite/manifest.json')
const failures = []
if (!fs.existsSync(htmlPath)) failures.push(`missing production HTML: ${htmlPath}`)
if (!fs.existsSync(manifestPath)) failures.push(`missing Vite manifest: ${manifestPath}`)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
const html = fs.readFileSync(htmlPath, 'utf8')
const eagerRefs = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+)"/g)].map((match) => match[1])
const forbidden = eagerRefs.filter((asset) => /(?:monaco|codemirror|editor\.worker|[a-z]+\.worker)/i.test(asset))
if (forbidden.length) failures.push(`editor engine is eagerly loaded: ${forbidden.join(', ')}`)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const manifestEntries = Object.entries(manifest).filter(([, item]) => item)
const entryRecord = manifestEntries.find(([, item]) => item.isEntry)
const entry = entryRecord?.[1]
if (!entry) failures.push('Vite manifest has no entry chunk')
const byKey = new Map(manifestEntries)
const byFile = new Map(manifestEntries.map(([, item]) => [item.file, item]))
const visited = new Map()
function visit(reference) {
  if (!reference) return
  const keyed = byKey.get(reference)
  const item = keyed ?? byFile.get(reference)
  const file = item?.file ?? reference
  if (visited.has(file)) return
  visited.set(file, { reference, item })
  for (const imported of item?.imports ?? []) visit(imported)
}
if (entryRecord) visit(entryRecord[0])
const initialJs = [...visited.keys()].filter((file) => file.endsWith('.js'))
for (const file of initialJs) {
  const { reference, item } = visited.get(file)
  const identity = [reference, file, item?.name, item?.src].filter(Boolean).join(' ')
  if (/(?:monaco|codemirror|editor\.worker|[a-z]+\.worker)/i.test(identity)) {
    failures.push(`entry import graph contains editor engine: ${identity}`)
  }
}
let gzipBytes = 0
for (const file of initialJs) {
  const absolute = path.join(dist, file)
  if (!fs.existsSync(absolute)) failures.push(`manifest asset is missing: ${file}`)
  else gzipBytes += zlib.gzipSync(fs.readFileSync(absolute), { level: 9 }).length
}
if (gzipBytes > budgetBytes) failures.push(`initial JavaScript gzip budget exceeded: ${gzipBytes} > ${budgetBytes}`)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Bundle graph OK: ${initialJs.length} initial JS asset(s), ${gzipBytes} gzip bytes, budget ${budgetBytes}.`)
