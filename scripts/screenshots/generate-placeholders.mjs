import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = path.join(rootDir, 'docs/assets/screenshots')

const SCREENSHOTS = [
  { name: 'workspace-light', color: [248, 250, 252], label: 'Workspace (Light)' },
  { name: 'workspace-dark', color: [30, 41, 59], label: 'Workspace (Dark)' },
  { name: 'editor-preview', color: [240, 249, 255], label: 'Editor + Preview' },
  { name: 'command-palette', color: [250, 245, 255], label: 'Command Palette' },
  { name: 'graph', color: [240, 253, 244], label: 'Knowledge Graph' },
  { name: 'canvas', color: [255, 251, 235], label: 'Canvas' },
  { name: 'git-panel', color: [239, 246, 255], label: 'Git Panel' },
  { name: 'mcp-panel', color: [253, 244, 255], label: 'MCP Panel' },
  { name: 'settings', color: [248, 250, 252], label: 'Settings' },
  { name: 'publish-center', color: [254, 252, 232], label: 'Publish Center' },
  { name: 'vault-health', color: [236, 253, 245], label: 'Vault Health' },
  { name: 'knowledge-workbench', color: [252, 231, 243], label: 'Knowledge Workbench' },
  { name: 'conflict-resolver', color: [254, 242, 242], label: 'Conflict Resolver' },
  { name: 'note-history', color: [245, 243, 255], label: 'Note History' },
  { name: 'keyboard-shortcuts', color: [254, 249, 195], label: 'Keyboard Shortcuts' },
  { name: 'workspace-mobile', color: [224, 242, 254], label: 'Mobile Viewport' },
  { name: 'onboarding-tour', color: [219, 234, 254], label: 'Onboarding Tour' },
  { name: 'plugins', color: [243, 232, 255], label: 'Plugins' },
]

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function createPlaceholderPng(width, height, rgb) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rawData = Buffer.alloc(height * (1 + width * 3))
  let pos = 0
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0
    for (let x = 0; x < width; x++) {
      rawData[pos++] = rgb[0]
      rawData[pos++] = rgb[1]
      rawData[pos++] = rgb[2]
    }
  }

  const compressed = deflateSync(rawData, { level: 9 })

  let adlerA = 1, adlerB = 0
  for (let i = 0; i < rawData.length; i++) {
    adlerA = (adlerA + rawData[i]) % 65521
    adlerB = (adlerB + adlerA) % 65521
  }
  const adlerBuf = Buffer.alloc(4)
  adlerBuf.writeUInt32BE(((adlerB << 16) | adlerA) >>> 0, 0)

  const idatData = Buffer.concat([Buffer.from([0x78, 0x01]), compressed, adlerBuf])

  return Buffer.concat([
    signature,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idatData),
    writeChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outputDir, { recursive: true })

let count = 0
for (const shot of SCREENSHOTS) {
  const png = createPlaceholderPng(2, 2, shot.color)
  const filePath = path.join(outputDir, `${shot.name}.png`)
  writeFileSync(filePath, png)
  console.log(`  created: ${shot.name}.png (${shot.label})`)
  count++
}

console.log(`\nGenerated ${count} placeholder screenshots in docs/assets/screenshots/`)
