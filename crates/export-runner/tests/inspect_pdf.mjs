// Independent artifact inspection through the application's PDF reader engine.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const path = process.argv[2];
assert.ok(path, 'Pass the opt-in structured PDF fixture path');
const bytes = new Uint8Array(await readFile(path));
const byteCount = bytes.length;
const task = getDocument({ data: bytes, useSystemFonts: false });
const document = await task.promise;
try {
  assert.equal(document.numPages, 1);
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.filter(item => 'str' in item).map(item => item.str).join(' ').replace(/\s+/gu, ' ');
  const expectedText = ['Research report', 'strong', 'Evidence one', 'Evidence two', 'quotation', 'Source', 'Accepted', 'fn main()'];
  for (const expected of expectedText) {
    assert.ok(text.includes(expected), `Missing actual text: ${expected}; extracted: ${text}`);
  }
  const outline = await document.getOutline();
  assert.ok(outline?.some(entry => entry.title === 'Research report'));
  const metadata = await document.getMetadata();
  assert.equal(metadata.info.Title, 'Offline report');
  if (process.argv[3]) {
    const require = createRequire(import.meta.resolve('pdfjs-dist/package.json'));
    const { createCanvas } = require('@napi-rs/canvas');
    const viewport = page.getViewport({ scale: 1.25 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), canvas, viewport }).promise;
    await writeFile(process.argv[3], canvas.toBuffer('image/png'));
  }
  console.log(JSON.stringify({ pages: document.numPages, bytes: byteCount, textAssertions: expectedText.length, outlineEntries: outline.length, title: metadata.info.Title }));
} finally {
  await task.destroy();
}
