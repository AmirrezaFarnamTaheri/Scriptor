import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { chmodSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { executeRelayCommand } from '../src/cli.mjs'
import { RelayRoomStore } from '../src/room-store.mjs'

const room={roomId:'room_test',documentId:'doc_test',epoch:1}
const key=generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'})
const bootstrap={...room,ownerPeerId:'alice',ownerPublicKey:key,initialUpdate:{...room,peerId:'alice',vaultId:'local_vault',version:1,kind:'LOCAL_UPDATE',messageId:'initial',clientSeq:1,payload:'aGk='}}

test('bootstrap command seeds an operator-approved key and update with durable retry',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'scriptor-cli-'))
  try {
    const bootstrapFile=join(dir,'bootstrap.json')
    writeFileSync(bootstrapFile,JSON.stringify(bootstrap),{mode:0o600})
    const env={SCRIPTOR_RELAY_DATA_DIR:join(dir,'store'),SCRIPTOR_RELAY_BOOTSTRAP_FILE:bootstrapFile}
    const receipt=await executeRelayCommand('bootstrap',env)
    assert.deepEqual(receipt,{cursor:1,durable:true,duplicate:false})
    assert.equal((await executeRelayCommand('bootstrap',env)).duplicate,true)
    const store=new RelayRoomStore(env.SCRIPTOR_RELAY_DATA_DIR)
    assert.equal(store.getRegisteredKey({...room,peerId:'alice'}),key)
    assert.equal(store.read({...room,authenticatedPeerId:'alice'}).updates.length,1)
    store.close()
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('insecure bootstrap and server startup missing TLS fail closed',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'scriptor-cli-'))
  try {
    const file=join(dir,'bootstrap.json')
    writeFileSync(file,JSON.stringify(bootstrap),{mode:0o600});chmodSync(file,0o644)
    const env={SCRIPTOR_RELAY_DATA_DIR:join(dir,'store'),SCRIPTOR_RELAY_BOOTSTRAP_FILE:file}
    if(process.platform !== 'win32') await assert.rejects(executeRelayCommand('bootstrap',env),/private|permission/i)
    await assert.rejects(executeRelayCommand('serve',env),/TLS|certificate|key/i)
  }finally{rmSync(dir,{recursive:true,force:true})}
})

test('operator CLI scripts enable TypeScript stripping for the shared protocol parser', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['serve', 'bootstrap']) {
    assert.match(manifest.scripts[name], /--experimental-strip-types/)
    assert.match(manifest.scripts[name], /--experimental-sqlite/)
  }
})

test('the CLI runs when its install path needs percent-encoding', async () => {
  const { cpSync, mkdtempSync: makeTemp } = await import('node:fs')
  const { spawnSync } = await import('node:child_process')
  const { fileURLToPath } = await import('node:url')
  const packageDir = fileURLToPath(new URL('..', import.meta.url))
  // A sibling of the package, so the relative import of the shared protocol
  // module (../../src/lib) still resolves.
  const installed = makeTemp(join(packageDir, '..', 'relay copy '))
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-cli-'))
  try {
    cpSync(join(packageDir, 'src'), join(installed, 'src'), { recursive: true })
    const bootstrapFile = join(dir, 'bootstrap.json')
    writeFileSync(bootstrapFile, JSON.stringify(bootstrap), { mode: 0o600 })
    const result = spawnSync(process.execPath, ['--experimental-sqlite', '--no-warnings', join(installed, 'src', 'cli.mjs'), 'bootstrap'], {
      env: { ...process.env, SCRIPTOR_RELAY_DATA_DIR: join(dir, 'store'), SCRIPTOR_RELAY_BOOTSTRAP_FILE: bootstrapFile },
      encoding: 'utf8',
      timeout: 30_000,
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Created or verified room at durable cursor 1/)
  } finally {
    rmSync(installed, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
  }
})
