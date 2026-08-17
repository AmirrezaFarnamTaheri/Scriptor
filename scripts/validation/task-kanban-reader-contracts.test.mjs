import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { coordinateNoteMutation } from '../../src/lib/workspace/coordinateNoteMutation.ts'

const taskPanel = readFileSync(new URL('../../src/components/TaskPanel.tsx', import.meta.url), 'utf8')
const kanbanPanel = readFileSync(new URL('../../src/components/KanbanPanel.tsx', import.meta.url), 'utf8')
const taskStatusGlyph = readFileSync(new URL('../../src/components/taskStatusGlyph.tsx', import.meta.url), 'utf8')
const annotationPopover = readFileSync(new URL('../../src/components/reader/AnnotationPopover.tsx', import.meta.url), 'utf8')
const readerStyles = readFileSync(new URL('../../src/styles/components/reader-panel.css', import.meta.url), 'utf8')
const dockStyles = readFileSync(new URL('../../src/styles/app/dock-settings.css', import.meta.url), 'utf8')
const corePackage = JSON.parse(
  readFileSync(new URL('../../packages/core/package.json', import.meta.url), 'utf8'),
)

test('task and kanban panels use declared task exports and unified modal shell', () => {
  assert.match(taskPanel, /from '@scriptor\/core\/task'/)
  assert.doesNotMatch(taskPanel, /packages\/core\/src\/task/)
  assert.doesNotMatch(kanbanPanel, /packages\/core\/src\/task/)
  assert.match(taskStatusGlyph, /from '@scriptor\/core\/task'/)
  assert.match(taskPanel, /<UnifiedPanelShell/)
  assert.match(kanbanPanel, /<UnifiedPanelShell/)
  assert.match(taskPanel, /runSourceNoteMutation/)
  assert.match(kanbanPanel, /runSourceNoteMutation/)
  assert.equal(corePackage.exports['./task'], './src/task/index.ts')
})

test('kanban loads ignore stale responses and stale note mutation refreshes', () => {
  assert.match(kanbanPanel, /const requestIdRef = useRef\(0\)/)
  assert.match(kanbanPanel, /const activeNotePathRef = useRef\(notePath\)/)
  assert.match(
    kanbanPanel,
    /if \(requestId !== requestIdRef\.current \|\| activeNotePathRef\.current !== path\) return/,
  )
  assert.match(
    kanbanPanel,
    /if \(activeNotePathRef\.current === sourcePath\) \{\s*load\(sourcePath\)\s*\}/,
  )
  assert.match(
    kanbanPanel,
    /if \(activeNotePathRef\.current !== sourcePath\) return\s*dispatch\(\{\s*type: 'error'/,
  )
})

test('dirty source notes save successfully before task or kanban native mutations run', async () => {
  const events = []
  const result = await coordinateNoteMutation({
    sourcePath: 'projects/roadmap.md',
    activePath: 'projects/roadmap.md',
    isDirty: true,
    saveActiveNote: async () => {
      events.push('save')
      return true
    },
    runMutation: async () => {
      events.push('native-write')
    },
  })

  assert.equal(result, true)
  assert.deepEqual(events, ['save', 'native-write'])
})

test('a failed dirty-note save prevents the native mutation', async () => {
  const events = []
  const result = await coordinateNoteMutation({
    sourcePath: 'projects/roadmap.md',
    activePath: 'projects/roadmap.md',
    isDirty: true,
    saveActiveNote: async () => {
      events.push('save')
      return false
    },
    runMutation: async () => {
      events.push('native-write')
    },
  })

  assert.equal(result, false)
  assert.deepEqual(events, ['save'])
})

test('annotation popover keeps modal focus semantics inside the reader panel', () => {
  assert.match(annotationPopover, /useFocusTrap\(dialogRef,\s*\{\s*active:\s*true\s*\}\)/)
  assert.match(annotationPopover, /useEscapeToClose\(true,\s*onDismiss\)/)
  assert.match(annotationPopover, /aria-modal="true"/)
  assert.match(annotationPopover, /aria-labelledby=\{titleId\}/)
  assert.match(annotationPopover, /aria-describedby=\{descriptionId\}/)
})

test('reader and kanban styles cover reduced motion, 44px targets, and compact paging', () => {
  assert.match(readerStyles, /@media\s*\(prefers-reduced-motion: reduce\)/)
  assert.match(readerStyles, /width:\s*44px;/)
  assert.match(readerStyles, /height:\s*44px;/)
  assert.match(dockStyles, /\.kanban-board--paged/)
  assert.match(dockStyles, /\.kanban-board__pager/)
  assert.match(dockStyles, /\.kanban-card__move/)
})
