import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const codeMirror = readFileSync(new URL('../../packages/editor/src/codemirror.tsx', import.meta.url), 'utf8')
const monaco = readFileSync(new URL('../../src/components/editor/MonacoMarkdownEditor.tsx', import.meta.url), 'utf8')

test('CodeMirror read-only transitions reconfigure its live view instead of destroying undo and selection', () => {
  assert.match(codeMirror, /^ {2}setReadOnly\(value: boolean\): void \{/m,
    'adapter must expose an in-place readOnly update')
  const mount = codeMirror.slice(
    codeMirror.indexOf('const adapter = new CodeMirrorAdapter('),
    codeMirror.indexOf('adapterRef.current?.setReadOnly(Boolean(readOnly))', codeMirror.indexOf('const adapter = new CodeMirrorAdapter(')),
  )
  assert.match(mount, /\}, \[\]\)/, 'the editor mount effect must not depend on readOnly')
  assert.doesNotMatch(mount, /\}, \[readOnly\]\)/, 'a readOnly change must not recreate the editor')
  assert.match(codeMirror, /collaborationReadOnlyCompartment\.reconfigure/,
    'readOnly state must be updated through the live CodeMirror compartment')
})

test('remote CodeMirror transactions and Monaco updates do not reset document history', () => {
  assert.match(codeMirror, /Transaction\.addToHistory\.of\(false\)/)
  assert.match(monaco, /model\.applyEdits\(\[/)
  assert.match(monaco, /if \(applyingRemoteRef\.current\) return/)
})

const editorWorkspace = readFileSync(new URL('../../src/components/shell/EditorWorkspace.tsx', import.meta.url), 'utf8')

test('live ownership locks an editor until collaboration attaches successfully', () => {
  assert.match(editorWorkspace, /const sourceReadOnly = Boolean\(liveNoteSaveLocked\)/)
  assert.match(codeMirror, /this\.collaborationConnection \? false : this\.externalReadOnly/)
  assert.match(codeMirror, /this\.collaborationConnection = connection\s+this\.reconfigureReadOnly\(\)/)
  assert.match(monaco, /editor\.updateOptions\(\{ readOnly: false \}\)/)
})
