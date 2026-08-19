import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveTarget, resolveFilename } from '../capture/target.ts'
import { presentCaptureChoice } from '../capture/choice.ts'
import type { CaptureChoice, CaptureChoiceOption } from '../capture/choice.ts'

// ── resolveTarget ────────────────────────────────────────────────────────────

describe('resolveTarget', () => {
  it('returns inbox folder when called with undefined', () => {
    const target = resolveTarget(undefined)
    assert.equal(target.kind, 'folder')
    if (target.kind === 'folder') {
      assert.match(target.folderPath, /inbox/i)
    }
  })

  it('fills missing folderPath with inbox', () => {
    const target = resolveTarget({ kind: 'folder' })
    assert.equal(target.kind, 'folder')
    if (target.kind === 'folder') assert.ok(target.folderPath)
  })

  it('preserves explicit folderPath', () => {
    const target = resolveTarget({ kind: 'folder', folderPath: 'my-folder' })
    assert.equal(target.kind, 'folder')
    if (target.kind === 'folder') assert.equal(target.folderPath, 'my-folder')
  })

  it('handles template target', () => {
    const target = resolveTarget({ kind: 'template', templatePath: 'templates/clip.md' })
    assert.equal(target.kind, 'template')
    if (target.kind === 'template') assert.equal(target.templatePath, 'templates/clip.md')
  })

  it('handles active-note target', () => {
    const target = resolveTarget({ kind: 'active-note', insertPosition: 'cursor' })
    assert.equal(target.kind, 'active-note')
    if (target.kind === 'active-note') assert.equal(target.insertPosition, 'cursor')
  })

  it('falls back to inbox for malformed template target (no templatePath)', () => {
    const target = resolveTarget({ kind: 'template' } as never)
    assert.equal(target.kind, 'folder')
  })
})

// ── resolveFilename ──────────────────────────────────────────────────────────

describe('resolveFilename', () => {
  const fixedDate = new Date('2026-08-10T14:30:00')

  it('interpolates {{date}}', () => {
    const name = resolveFilename('{{date}}-note.md', 'My Title', fixedDate)
    assert.match(name, /2026-08-10/)
  })

  it('interpolates {{title}} as a slug', () => {
    const name = resolveFilename('{{date}}-{{title}}.md', 'Hello, World! (draft)', fixedDate)
    assert.match(name, /hello-world-draft/)
  })

  it('caps slug at 80 characters', () => {
    const longTitle = 'a'.repeat(200)
    const name = resolveFilename('{{title}}.md', longTitle, fixedDate)
    const slug = name.replace('.md', '')
    assert.ok(slug.length <= 80)
  })

  it('does not double hyphenate slug', () => {
    const name = resolveFilename('{{title}}.md', 'a  b   c', fixedDate)
    assert.equal(name.includes('--'), false)
  })
})

// ── presentCaptureChoice ─────────────────────────────────────────────────────

describe('presentCaptureChoice', () => {
  const noPicker = async (_options: CaptureChoiceOption[]) => null

  it('silent mode returns defaultTarget without picker', async () => {
    const choice: CaptureChoice = {
      mode: 'silent',
      defaultTarget: { kind: 'folder', folderPath: 'notes', filenameTemplate: '{{date}}.md' },
    }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    assert.equal(target?.kind, 'folder')
  })

  it('silent mode returns inbox when no defaultTarget', async () => {
    const choice: CaptureChoice = { mode: 'silent' }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    assert.notEqual(target, null)
  })

  it('prompt mode with one option skips picker', async () => {
    let pickerCalled = false
    const choice: CaptureChoice = {
      mode: 'prompt',
      options: [{ id: '1', label: 'Inbox', target: { kind: 'folder', folderPath: '00-inbox' } }],
    }
    const pickerSpy = async (_options: CaptureChoiceOption[]) => {
      pickerCalled = true
      return null
    }
    const target = await presentCaptureChoice(choice, {}, pickerSpy)
    assert.equal(pickerCalled, false)
    assert.equal(target?.kind, 'folder')
  })

  it('prompt mode with no options falls back to inbox', async () => {
    const choice: CaptureChoice = { mode: 'prompt', options: [] }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    assert.notEqual(target, null)
  })

  it('prompt mode calls picker when multiple options exist', async () => {
    let pickerCalled = false
    const options: CaptureChoiceOption[] = [
      { id: 'a', label: 'A', target: { kind: 'folder', folderPath: 'a' } },
      { id: 'b', label: 'B', target: { kind: 'folder', folderPath: 'b' } },
    ]
    const choice: CaptureChoice = { mode: 'prompt', options }
    await presentCaptureChoice(choice, {}, async (receivedOptions) => {
      pickerCalled = true
      assert.equal(receivedOptions.length, 2)
      return receivedOptions[0]!
    })
    assert.equal(pickerCalled, true)
  })

  it('dynamic mode calls resolve()', async () => {
    const choice: CaptureChoice = {
      mode: 'dynamic',
      resolve: async (_context) => ({ kind: 'folder', folderPath: 'dynamic' }),
    }
    const target = await presentCaptureChoice(choice, { url: 'https://example.com' }, noPicker)
    assert.equal(target?.kind, 'folder')
    if (target?.kind === 'folder') assert.equal(target.folderPath, 'dynamic')
  })

  it('dynamic mode returns null when resolve is missing', async () => {
    const choice: CaptureChoice = { mode: 'dynamic' }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    assert.equal(target, null)
  })
})
