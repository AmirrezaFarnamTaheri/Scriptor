import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaKind, validatedMediaType } from './assetMedia.ts'

test('media preview types exclude active documents and unknown extensions', () => {
  assert.equal(mediaKind('papers/a.PDF'), 'reader')
  assert.equal(mediaKind('assets/a.png'), 'image')
  assert.equal(mediaKind('assets/a.mp3'), 'audio')
  for (const path of ['a.svg', 'a.html', 'a.gif.html', '../a.png', 'https://example.test/a.png']) {
    assert.equal(mediaKind(path), null)
  }
})

test('preview bytes must match their declared safe format', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(validatedMediaType('a.png', png), 'image/png')
  assert.throws(() => validatedMediaType('a.jpg', png), /match/)
  assert.throws(() => validatedMediaType('a.png', new TextEncoder().encode('<html>bad</html>')), /match/)
  assert.equal(validatedMediaType('a.wav', new TextEncoder().encode('RIFF0000WAVE')), 'audio/wav')
  assert.equal(validatedMediaType('a.mp3', new Uint8Array([73, 68, 51, 4])), 'audio/mpeg')
  assert.throws(() => validatedMediaType('a.svg', png), /supported/)
  assert.throws(() => validatedMediaType('a.png', new Uint8Array(32 * 1024 * 1024 + 1)), /32 MiB/)
})
