import { describe, it, expect } from 'vitest'
import { resolveTarget, resolveFilename } from '../capture/target'
import { presentCaptureChoice } from '../capture/choice'
import type { CaptureChoice, CaptureChoiceOption } from '../capture/choice'

// ── resolveTarget ────────────────────────────────────────────────────────────

describe('resolveTarget', () => {
  it('returns inbox folder when called with undefined', () => {
    const t = resolveTarget(undefined)
    expect(t.kind).toBe('folder')
    if (t.kind === 'folder') {
      expect(t.folderPath).toContain('inbox')
    }
  })

  it('fills missing folderPath with inbox', () => {
    const t = resolveTarget({ kind: 'folder' })
    expect(t.kind).toBe('folder')
    if (t.kind === 'folder') expect(t.folderPath).toBeTruthy()
  })

  it('preserves explicit folderPath', () => {
    const t = resolveTarget({ kind: 'folder', folderPath: 'my-folder' })
    if (t.kind === 'folder') expect(t.folderPath).toBe('my-folder')
  })

  it('handles template target', () => {
    const t = resolveTarget({ kind: 'template', templatePath: 'templates/clip.md' })
    expect(t.kind).toBe('template')
    if (t.kind === 'template') expect(t.templatePath).toBe('templates/clip.md')
  })

  it('handles active-note target', () => {
    const t = resolveTarget({ kind: 'active-note', insertPosition: 'cursor' })
    expect(t.kind).toBe('active-note')
    if (t.kind === 'active-note') expect(t.insertPosition).toBe('cursor')
  })

  it('falls back to inbox for malformed template target (no templatePath)', () => {
    const t = resolveTarget({ kind: 'template' } as never)
    expect(t.kind).toBe('folder')
  })
})

// ── resolveFilename ──────────────────────────────────────────────────────────

describe('resolveFilename', () => {
  const fixedDate = new Date('2026-08-10T14:30:00')

  it('interpolates {{date}}', () => {
    const name = resolveFilename('{{date}}-note.md', 'My Title', fixedDate)
    expect(name).toContain('2026-08-10')
  })

  it('interpolates {{title}} as a slug', () => {
    const name = resolveFilename('{{date}}-{{title}}.md', 'Hello, World! (draft)', fixedDate)
    expect(name).toContain('hello-world-draft')
  })

  it('caps slug at 80 characters', () => {
    const longTitle = 'a'.repeat(200)
    const name = resolveFilename('{{title}}.md', longTitle, fixedDate)
    const slug = name.replace('.md', '')
    expect(slug.length).toBeLessThanOrEqual(80)
  })

  it('does not double hyphenate slug', () => {
    const name = resolveFilename('{{title}}.md', 'a  b   c', fixedDate)
    expect(name).not.toContain('--')
  })
})

// ── presentCaptureChoice ─────────────────────────────────────────────────────

describe('presentCaptureChoice', () => {
  const noPicker = async (_opts: CaptureChoiceOption[]) => null

  it('silent mode returns defaultTarget without picker', async () => {
    const choice: CaptureChoice = {
      mode: 'silent',
      defaultTarget: { kind: 'folder', folderPath: 'notes', filenameTemplate: '{{date}}.md' },
    }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    expect(target?.kind).toBe('folder')
  })

  it('silent mode returns inbox when no defaultTarget', async () => {
    const choice: CaptureChoice = { mode: 'silent' }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    expect(target).not.toBeNull()
  })

  it('prompt mode with one option skips picker', async () => {
    let pickerCalled = false
    const choice: CaptureChoice = {
      mode: 'prompt',
      options: [{ id: '1', label: 'Inbox', target: { kind: 'folder', folderPath: '00-inbox' } }],
    }
    const pickerSpy = async (_opts: CaptureChoiceOption[]) => {
      pickerCalled = true
      return null
    }
    const target = await presentCaptureChoice(choice, {}, pickerSpy)
    expect(pickerCalled).toBe(false)
    expect(target?.kind).toBe('folder')
  })

  it('prompt mode with no options falls back to inbox', async () => {
    const choice: CaptureChoice = { mode: 'prompt', options: [] }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    expect(target).not.toBeNull()
  })

  it('prompt mode calls picker when multiple options exist', async () => {
    let pickerCalled = false
    const opts: CaptureChoiceOption[] = [
      { id: 'a', label: 'A', target: { kind: 'folder', folderPath: 'a' } },
      { id: 'b', label: 'B', target: { kind: 'folder', folderPath: 'b' } },
    ]
    const choice: CaptureChoice = { mode: 'prompt', options: opts }
    await presentCaptureChoice(choice, {}, async (receivedOpts) => {
      pickerCalled = true
      expect(receivedOpts).toHaveLength(2)
      return receivedOpts[0]!
    })
    expect(pickerCalled).toBe(true)
  })

  it('dynamic mode calls resolve()', async () => {
    const choice: CaptureChoice = {
      mode: 'dynamic',
      resolve: async (_ctx) => ({ kind: 'folder', folderPath: 'dynamic' }),
    }
    const target = await presentCaptureChoice(choice, { url: 'https://example.com' }, noPicker)
    expect(target?.kind).toBe('folder')
    if (target?.kind === 'folder') expect(target.folderPath).toBe('dynamic')
  })

  it('dynamic mode returns null when resolve is missing', async () => {
    const choice: CaptureChoice = { mode: 'dynamic' }
    const target = await presentCaptureChoice(choice, {}, noPicker)
    expect(target).toBeNull()
  })
})
