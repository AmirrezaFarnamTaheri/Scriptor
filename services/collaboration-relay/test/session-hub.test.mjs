import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { RelayRoomStore } from '../src/room-store.mjs'
import { RelaySessionHub } from '../src/session-hub.mjs'

const room = { roomId: 'shared_room_1', documentId: 'doc_1', epoch: 1 }
const alice = generateKeyPairSync('ed25519')
const bob = generateKeyPairSync('ed25519')
const carol = generateKeyPairSync('ed25519')
const key = pair => pair.publicKey.export({ type:'spki', format:'pem' })
const update = (peerId, seq, text='a') => ({
  version:1,kind:'LOCAL_UPDATE',...room,vaultId:`vault_${peerId}`,peerId,messageId:`m_${peerId}_${seq}`,clientSeq:seq,
  payload:Buffer.from(text,'utf8').toString('base64'),
})
class FakeSocket extends EventEmitter {
  sent=[]; closed=null
  send(payload) { if(this.closed) throw new Error('Socket closed'); this.sent.push(JSON.parse(payload)) }
  close(code=1000, reason='') { this.closed={code,reason};this.emit('close') }
  receive(value, binary=false) { this.emit('message', binary ? Buffer.from(value) : JSON.stringify(value), binary) }
  last(type) { return this.sent.filter(item=>item.type===type).at(-1) }
}
function harness(run) {
  const dir=mkdtempSync(join(tmpdir(),'scriptor-session-'))
  let store=new RelayRoomStore(dir)
  store.createRoom({ ...room, ownerPeerId:'alice',ownerPublicKey:key(alice),initialUpdate:update('alice',1,'seed')})
  store.grant({...room,actorPeerId:'alice',targetPeerId:'bob',role:'editor',publicKey:key(bob)})
  store.grant({...room,actorPeerId:'alice',targetPeerId:'carol',role:'viewer',publicKey:key(carol)})
  const hub=new RelaySessionHub({store,maxSessions:10})
  try { return run({store,hub,dir,reopen(){store.close();store=new RelayRoomStore(dir);return store}}) }
  finally {hub.close();store.close();rmSync(dir,{recursive:true,force:true})}
}
function login(hub, peerId, pair) {
  const socket=new FakeSocket(); hub.accept(socket)
  socket.receive({type:'hello',scope:{...room,peerId}})
  const challenge=socket.last('challenge')
  assert.ok(challenge, 'server must send nonce challenge')
  socket.receive({type:'proof',challengeId:challenge.challengeId,
    signature:sign(null,Buffer.from(challenge.challenge),pair.privateKey).toString('base64url')})
  assert.equal(socket.last('ready')?.role,peerId==='alice'?'owner':peerId==='bob'?'editor':'viewer')
  assert.equal(socket.closed,null)
  return socket
}

test('three authenticated clients sync, receive incremental updates and durable ACKs with no local vault leak', () => harness(({hub})=>{
  const a=login(hub,'alice',alice), b=login(hub,'bob',bob), c=login(hub,'carol',carol)
  b.receive({type:'sync',afterCursor:0})
  assert.equal(b.last('updates').updates[0].peerId,'alice')
  assert.equal(b.last('updates').updates[0].payload,Buffer.from('seed').toString('base64'))
  assert.equal('vaultId' in b.last('updates').updates[0],false)
  const before=c.sent.length
  b.receive({type:'update',update:update('bob',1,'hello')})
  assert.deepEqual(b.last('ack').messageId,'m_bob_1')
  assert.equal(b.last('ack').durable,true)
  assert.equal(c.sent.length,before+1)
  assert.equal(c.last('update').peerId,'bob')
  assert.equal(c.last('update').payload,Buffer.from('hello').toString('base64'))
  assert.equal('vaultId' in c.last('update'),false)
  a.receive({type:'sync',afterCursor:0})
  assert.deepEqual(a.last('updates').updates.map(u=>u.messageId),['m_alice_1','m_bob_1'])
  b.receive({type:'update',update:update('bob',1,'hello')})
  assert.equal(b.last('ack').duplicate,true)
  assert.equal(a.sent.filter(x=>x.type==='update').length,1,'duplicates should not rebroadcast')
}))

test('read-only peer cannot write and revocation immediately closes an authenticated session',()=>harness(({hub})=>{
  const a=login(hub,'alice',alice), b=login(hub,'bob',bob), c=login(hub,'carol',carol)
  c.receive({type:'update',update:update('carol',1,'invalid')})
  assert.equal(c.closed?.code,1008)
  a.receive({type:'grant',targetPeerId:'bob',role:'revoked'})
  assert.equal(a.last('granted').peerId,'bob')
  assert.equal(b.closed?.code,1008)
  b.receive({type:'sync',afterCursor:0}); assert.equal(b.sent.some(x=>x.type==='updates'),false)
}))

test('forged signatures and mismatched scope are refused',()=>harness(({hub})=>{
  const s=new FakeSocket();hub.accept(s);s.receive({type:'hello',scope:{...room,peerId:'alice'}})
  const ch=s.last('challenge');s.receive({type:'proof',challengeId:ch.challengeId,
    signature:sign(null,Buffer.from(ch.challenge),bob.privateKey).toString('base64url')})
  assert.equal(s.closed?.code,1008)
  const owner=login(hub,'alice',alice)
  owner.receive({type:'update',update:{...update('alice',2,'wrong'),documentId:'another'}})
  assert.equal(owner.closed?.code,1008)
}))

test('key rotation invalidates the existing authenticated connection',()=>harness(({hub,store})=>{
  const a=login(hub,'alice',alice), b=login(hub,'bob',bob)
  const rotated=generateKeyPairSync('ed25519')
  a.receive({type:'grant',targetPeerId:'bob',role:'editor',publicKey:key(rotated)})
  assert.equal(store.getRegisteredKey({...room,peerId:'bob'}),key(rotated))
  b.receive({type:'sync',afterCursor:0})
  assert.equal(b.closed?.code,1008)
}))

test('invalid frames, revoked and unknown users, binary payloads and oversized JSON fail closed',()=>harness(({hub})=>{
  const unknown=new FakeSocket();hub.accept(unknown);unknown.receive({type:'hello',scope:{...room,peerId:'mallory'}})
  assert.equal(unknown.closed?.code,1008)
  const a=login(hub,'alice',alice)
  a.receive('x',true)
  assert.equal(a.closed?.code,1008)
  const b=login(hub,'bob',bob)
  b.emit('message','{garbage',false)
  assert.equal(b.closed?.code,1008)
  const c=login(hub,'carol',carol)
  c.emit('message','x'.repeat(600_000),false)
  assert.equal(c.closed?.code,1009)
}))

test('unproven connections expire and release their bounded session slot', async () => {
  const untrustedStore = { append() {}, read() {}, getRegisteredKey() { return null } }
  const hub = new RelaySessionHub({ store: untrustedStore, maxSessions: 1, handshakeTimeoutMs: 30 })
  const stalled = new FakeSocket()
  try {
    hub.accept(stalled)
    await new Promise(resolve => setTimeout(resolve, 80))
    assert.equal(stalled.closed?.code, 1008)
    const next = new FakeSocket()
    hub.accept(next)
    assert.equal(next.closed, null, 'a timed-out handshake must free the session budget')
  } finally { hub.close() }
})
