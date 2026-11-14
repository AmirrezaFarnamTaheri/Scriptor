import assert from 'node:assert/strict'
import test from 'node:test'
import { overleafBindingKey, readOverleafBinding, saveOverleafBinding, forgetOverleafBinding } from './overleafBinding.ts'

test('an explicitly linked Overleaf file is available after reopening the panel', () => {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
  const key = overleafBindingKey('vault-1', 'chapters/a.tex')
  assert.equal(readOverleafBinding(storage, key), null)
  saveOverleafBinding(storage, key, 'abcdef123456', 'chapters/one.tex')
  assert.deepEqual(readOverleafBinding(storage, key), { projectId: 'abcdef123456', remotePath: 'chapters/one.tex' })
  assert.equal(readOverleafBinding(storage, overleafBindingKey('vault-2', 'chapters/a.tex')), null)
  forgetOverleafBinding(storage, key)
  assert.equal(readOverleafBinding(storage, key), null)
})
test('bad links, unexpected fields and oversized saved preferences cannot initiate provider calls', () => {
  const key = overleafBindingKey('vault', 'main.tex')
  for (const value of ['invalid', '{}', JSON.stringify({ schema: 'scriptor.overleaf.binding.v1', projectId: 'bad', remotePath: 'main.tex' }),
    JSON.stringify({ schema: 'scriptor.overleaf.binding.v1', projectId: 'abcdef123456', remotePath: '../main.tex' }),
    JSON.stringify({ schema: 'scriptor.overleaf.binding.v1', projectId: 'abcdef123456', remotePath: 'main.tex', token: 'secret' })]) {
    assert.equal(readOverleafBinding({ getItem: () => value }, key), null)
  }
  assert.throws(() => overleafBindingKey('vault', '../main.tex'))
  assert.throws(() => saveOverleafBinding({ setItem: () => undefined }, key, 'bad', 'main.tex'))
})
