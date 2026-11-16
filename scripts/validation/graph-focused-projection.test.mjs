import test from 'node:test'
import assert from 'node:assert/strict'
import { projectFocusedGraph } from '../../src/lib/graphFocusLayout.ts'

function graph(nodeCount) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: 'node-' + index, path: 'note-' + index + '.md',
    label: 'Note ' + index, x: 200 + index, y: 150 + index,
  }))
  const edges = [
    {source:'node-0',target:'node-1'},
    {source:'node-2',target:'node-0'},
    {source:'node-0',target:'node-3'},
    {source:'node-3',target:'node-0'},
    ...Array.from({ length: Math.max(0,nodeCount-5) }, (_,index) =>
      ({source:'node-' + (index+4),target:'node-' + (index+5)})),
  ]
  return {nodes,edges}
}

test('120-note canvas centers focus and separates immediate neighbors', () => {
  const {nodes,edges} = graph(120)
  const visible = projectFocusedGraph(nodes,edges,'node-0',1400,480)
  assert.deepEqual(new Set(visible.map(node => node.id)),new Set(['node-0','node-1','node-2','node-3']))
  const focus = visible.find(node => node.id === 'node-0')
  assert.equal(focus.x,700)
  assert.equal(focus.y,240)
  const adjacent = visible.filter(node => node.id !== focus.id)
  for(const node of adjacent) {
    assert.ok(Math.hypot(node.x-focus.x,node.y-focus.y)>=115, node.id + ' still cramped')
    assert.ok(node.x>30 && node.x<1370 && node.y>30 && node.y<450, node.id + ' out of bounds')
  }
  assert.ok(Math.max(...adjacent.map(node=>node.x)) - Math.min(...adjacent.map(node=>node.x)) > 400)
  assert.deepEqual(visible,projectFocusedGraph(nodes,edges,'node-0',1400,480))
})
test('320px focused projection keeps neighbor nodes reachable and in bounds',()=>{
  const {nodes,edges}=graph(120)
  const result=projectFocusedGraph(nodes,edges,'node-0',320,260)
  assert.equal(result.length,4)
  for(const node of result)assert.ok(node.x>=28 && node.x<=292 && node.y>=28 && node.y<=232)
})
test('unknown focused note falls back to the original graph',()=>{
  const {nodes,edges}=graph(120)
  assert.deepEqual(projectFocusedGraph(nodes,edges,'missing',1400,480),nodes)
})
test('500-note graph retains every direct relation to a hub',()=>{
  const nodes=Array.from({length:500},(_,i)=>({id:String(i),x:0,y:0}))
  const edges=nodes.slice(1,91).map(node=>({source:'0',target:node.id}))
  const visible=projectFocusedGraph(nodes,edges,'0',800,440)
  assert.equal(visible.length,91)
  assert.equal(visible[0].id,'0')
  for(const node of visible)assert.ok(node.x>=28 && node.x<=772 && node.y>=28 && node.y<=412)
})
