import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { selectGitPanelState } from '../../src/lib/gitPanelState.ts'

const READY_STATUS = {
  is_repo: true,
  branch: 'main',
  changed_files: [],
  clean: true,
  ahead: 0,
  behind: 0,
  has_upstream: true,
  has_conflicts: false,
  conflicted_files: [],
}

test('Git panel state selection covers every owned async state', () => {
  assert.equal(selectGitPanelState(null, true), 'loading')
  assert.equal(selectGitPanelState(null, false), 'not-repository')
  assert.equal(
    selectGitPanelState({ ...READY_STATUS, is_repo: false, loadError: 'bridge unavailable' }, false),
    'error',
  )
  assert.equal(selectGitPanelState({ ...READY_STATUS, is_repo: false }, false), 'not-repository')
  assert.equal(selectGitPanelState(READY_STATUS, false), 'ready')

  const hookSource = readFileSync(new URL('../../src/hooks/useWorkspaceGit.ts', import.meta.url), 'utf8')
  assert.match(hookSource, /const \[isGitBusy, setIsGitBusy\] = useState\(false\)/)
  assert.match(hookSource, /const refreshGit = useCallback\(async \(\) => \{\s*setIsGitBusy\(true\)/)
})

test('Git file rows keep actions outside the checkbox label and handlers stable', () => {
  const source = readFileSync(new URL('../../src/components/GitPanel.tsx', import.meta.url), 'utf8')
  const labelBlock = source.match(/<label htmlFor=\{checkboxId\}>([\s\S]*?)<\/label>/)?.[1]

  assert.ok(labelBlock, 'Git file-row label must remain explicitly associated with the checkbox')
  assert.doesNotMatch(labelBlock, /<button\b/, 'Git file-row label must not contain nested buttons')
  assert.match(source, /className="git-file-row-actions"/)
  assert.match(source, /const defaultSelection = useMemo/)
  assert.match(source, /const handleToggleSelect = useCallback\([\s\S]*?\}, \[defaultSelection\]\)/)
})

test('Git shortcut names and visual tooltips remain accessible', () => {
  const topBar = readFileSync(new URL('../../src/components/shell/AppTopBar.tsx', import.meta.url), 'utf8')
  const chrome = readFileSync(new URL('../../src/components/chrome/WorkspaceChrome.tsx', import.meta.url), 'utf8')

  assert.match(topBar, /aria-label=\{`\$\{gitTitle\} \(\$\{gitShortcut\}\)`\}/)
  assert.match(topBar, /className="custom-tooltip" aria-hidden="true"/)
  assert.match(chrome, /className="custom-tooltip" aria-hidden="true"/)
})
