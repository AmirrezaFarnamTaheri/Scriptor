import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyWorkspaceLayout, openWorkspaceLeaf, closeWorkspaceLeaf, moveWorkspaceLeaf, reorderWorkspaceLeaf, parseWorkspaceLayout, serializeWorkspaceLayout, getWorkspaceActiveLeaf, selectWorkspaceLeaf, prepareWorkspaceLeafTransition, workspaceLeafTransitionRefusal } from './workspaceLeaves.ts'

test('deduplicates references and moves without losing selection', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(), { kind: 'note', path: 'a.md' })
  state = openWorkspaceLeaf(state, { kind: 'source', path: 'code.py' })
  state = openWorkspaceLeaf(state, { kind: 'note', path: 'a.md' })
  assert.equal(state.leaves.length, 2)
  const id = state.activeId!
  state = moveWorkspaceLeaf(state, id, 'secondary')
  assert.equal(state.leaves.find(leaf => leaf.id === id)?.group, 'secondary')
  assert.equal(state.activeId, id)
  state = closeWorkspaceLeaf(state, id)
  assert.equal(state.activeId, state.leaves[0].id)
})

test('rejects malformed, excessive, unsafe and credential-bearing stored layouts', () => {
  for (const raw of ['null', '{', JSON.stringify({version: 1, leaves: [{ kind: 'note', path: '../secret' }]}), JSON.stringify({version: 1, leaves: [], activeId: null, credentials: 'secret'})]) {
    assert.deepEqual(parseWorkspaceLayout(raw), emptyWorkspaceLayout())
  }
  let state = emptyWorkspaceLayout()
  for (let index = 0; index < 30; index++) state = openWorkspaceLeaf(state, {kind:'note',path:`${index}.md`})
  assert.equal(state.leaves.length, 24)
  assert.deepEqual(parseWorkspaceLayout('x'.repeat(70000)), emptyWorkspaceLayout())
})

test('restores only available references, deterministic active fallback and no payload data', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(), {kind:'note',path:'a.md'})
  state = openWorkspaceLeaf(state, {kind:'plugin',id:'scriptor.test:overview'})
  const restored = parseWorkspaceLayout(serializeWorkspaceLayout(state), reference => reference.kind !== 'plugin')
  assert.equal(restored.leaves.length, 1)
  assert.equal(restored.activeId, restored.leaves[0].id)
  assert.deepEqual(JSON.parse(serializeWorkspaceLayout(state)), state)
})

test('reorders only within the target group and rejects unsafe references', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(), {kind:'note',path:'a.md'})
  state = openWorkspaceLeaf(state, {kind:'note',path:'b.md'})
  const id = state.activeId!
  assert.equal(reorderWorkspaceLeaf(state,id,-1).leaves[0].id,id)
  assert.equal(openWorkspaceLeaf(state,{kind:'source',path:'C:\\secret.py'}),state)
  assert.equal(openWorkspaceLeaf(state,{kind:'note',path:'../a.md'}),state)
})

test('each group retains its selected tab while focus switches between groups', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(), {kind:'note',path:'a.md'})
  state = openWorkspaceLeaf(state,{kind:'note',path:'b.md'})
  state = openWorkspaceLeaf(state,{kind:'feature',id:'graph'},'secondary')
  state = openWorkspaceLeaf(state,{kind:'feature',id:'canvas'},'secondary')
  state = selectWorkspaceLeaf(state,'note:a.md')
  assert.equal(getWorkspaceActiveLeaf(state,'secondary')?.id,'feature:canvas')
  state = selectWorkspaceLeaf(state,'feature:graph')
  assert.equal(getWorkspaceActiveLeaf(state,'primary')?.id,'note:a.md')
  assert.deepEqual(parseWorkspaceLayout(serializeWorkspaceLayout(state)),state)
})

test('inactive close guard identifies the targeted draft and revoked references do not block navigation', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(), {kind:'source',path:'draft.py'})
  state = openWorkspaceLeaf(state,{kind:'plugin',id:'scriptor.test:overview'},'secondary')
  state = openWorkspaceLeaf(state,{kind:'feature',id:'editor'})
  const request = prepareWorkspaceLeafTransition('close',state,closeWorkspaceLeaf(state,'source:draft.py'),reference => reference.kind !== 'plugin','source:draft.py')
  assert.equal(request.from?.id,'source:draft.py')
  assert.equal(request.to?.id,'feature:editor')
  assert.deepEqual(request.next.leaves.map(leaf => leaf.id),['feature:editor'])
  assert.equal(state.leaves.length,3)
})

test('qualified plugin references require exactly two bounded contract identifiers', () => {
  const state = emptyWorkspaceLayout()
  assert.equal(openWorkspaceLeaf(state,{kind:'plugin',id:'scriptor.runtime-console:runtime-console'}).leaves.length,1)
  for (const id of ['scriptor.test','scriptor.test:a:b','scriptor.test:../a','Scriptor.test:a','a:','a:b..c',`${'a'.repeat(65)}:b`]) assert.equal(openWorkspaceLeaf(state,{kind:'plugin',id}),state)
})

test('writing host cannot move to the unsupported side group and full layouts still select existing leaves', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(),{kind:'feature',id:'editor'})
  assert.equal(moveWorkspaceLeaf(state,'feature:editor','secondary'),state)
  assert.equal(openWorkspaceLeaf(emptyWorkspaceLayout(),{kind:'feature',id:'editor'},'secondary').leaves.length,0)
  const corrupt = {...state,leaves:state.leaves.map(leaf => ({...leaf,group:'secondary'}))}
  assert.deepEqual(parseWorkspaceLayout(JSON.stringify(corrupt)),emptyWorkspaceLayout())
  for (let index = 0; index < 23; index++) state = openWorkspaceLeaf(state,{kind:'note',path:`${index}.md`})
  assert.equal(openWorkspaceLeaf(state,{kind:'source',path:'extra.py'}),state)
  assert.equal(openWorkspaceLeaf(state,{kind:'note',path:'0.md'}).activeId,'note:0.md')
})

test('close fallback keeps focused identity consistent with its group selection', () => {
  let state = openWorkspaceLeaf(emptyWorkspaceLayout(),{kind:'note',path:'a.md'})
  state = openWorkspaceLeaf(state,{kind:'feature',id:'graph'},'secondary')
  state = openWorkspaceLeaf(state,{kind:'feature',id:'canvas'},'secondary')
  state = selectWorkspaceLeaf(state,'note:a.md')
  state = closeWorkspaceLeaf(state,'note:a.md')
  assert.equal(getWorkspaceActiveLeaf(state)?.id,getWorkspaceActiveLeaf(state,'secondary')?.id)
})

test('capacity and removed navigation targets report refusal before owner approval', () => {
  let state = emptyWorkspaceLayout()
  for (let index = 0; index < 24; index++) state = openWorkspaceLeaf(state,{kind:'note',path:`${index}.md`})
  let reduced = openWorkspaceLeaf(state,{kind:'feature',id:'graph'})
  assert.equal(workspaceLeafTransitionRefusal(prepareWorkspaceLeafTransition('open',state,reduced,() => true),reduced),'limit')
  state = emptyWorkspaceLayout()
  reduced = openWorkspaceLeaf(state,{kind:'plugin',id:'scriptor.test:overview'})
  assert.equal(workspaceLeafTransitionRefusal(prepareWorkspaceLeafTransition('open',state,reduced,() => false),reduced),'unavailable')
  assert.equal(workspaceLeafTransitionRefusal(prepareWorkspaceLeafTransition('open',state,reduced,() => true),reduced),null)
})
