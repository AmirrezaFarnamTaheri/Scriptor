import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateRelayUpgrade, validateTlsConfiguration } from '../src/server.mjs'

const request = (headers={}) => ({ method:'GET', url:'/v1/live', headers:{ upgrade:'websocket', connection:'Upgrade', 'sec-websocket-protocol':'scriptor-live-v1', ...headers } })

test('rejects unexpected path, query-string tokens, WebSocket protocols and origins', () => {
  assert.doesNotThrow(()=>validateRelayUpgrade(request(), []))
  assert.throws(()=>validateRelayUpgrade({...request(),url:'/v1/live?token=secret'},[]),/path|URL/i)
  assert.throws(()=>validateRelayUpgrade({...request(),url:'/admin'},[]),/path|URL/i)
  assert.throws(()=>validateRelayUpgrade(request({'sec-websocket-protocol':'scriptor-live-v1,bypass'}),[]),/protocol/i)
  assert.throws(()=>validateRelayUpgrade(request({'origin':'https://evil.example'}),[]),/origin/i)
  assert.doesNotThrow(()=>validateRelayUpgrade(request({'origin':'app://scriptor'}),['app://scriptor']))
})

test('non-WebSocket upgrades and missing supported protocol fail closed', () => {
  assert.throws(()=>validateRelayUpgrade(request({'upgrade':'h2c'}),[]),/upgrade/i)
  assert.throws(()=>validateRelayUpgrade({...request(),method:'POST'},[]),/GET|method/i)
  assert.throws(()=>validateRelayUpgrade(request({'sec-websocket-protocol':''}),[]),/protocol/i)
})

test('TLS requires a real private key and certificate with no implicit insecure fallback', () => {
  assert.throws(()=>validateTlsConfiguration({}),/certificate|key|TLS/i)
  assert.throws(()=>validateTlsConfiguration({ keyPath:'/definitely/missing', certPath:'/definitely/missing' }),/path|TLS|file/i)
})
