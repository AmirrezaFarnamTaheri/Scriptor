import assert from 'node:assert/strict'
import { test } from 'node:test'

import { prepareWeChatHtml } from './wechat-export.ts'

const tags = (html: string) => html.match(/<[a-z][^>]*>/gi) ?? []

test('a > inside an attribute value cannot end the tag and inject markup', () => {
  const sanitized = '<p title="a><img src=x onerror=alert(1)>">text</p><img alt="b><svg onload=alert(1)>" src="pic.png">'
  const output = prepareWeChatHtml(sanitized, '')
  // The payloads stay inside their attribute values, now escaped.
  assert.ok(output.includes('title="a&gt;&lt;img src=x onerror=alert(1)&gt;"'), output)
  assert.ok(output.includes('alt="b&gt;&lt;svg onload=alert(1)&gt;"'), output)
  // Outside attribute values there is no event handler and no injected element.
  const markup = output.replace(/"[^"]*"/g, '""')
  for (const tag of tags(markup)) assert.doesNotMatch(tag, /\son\w+=/i, tag)
  assert.equal(tags(markup).filter(tag => /^<svg/i.test(tag)).length, 0)
  assert.equal(tags(markup).filter(tag => /^<img/i.test(tag)).length, 1)
})

test('styles are still inlined on ordinary tags and images', () => {
  const output = prepareWeChatHtml('<p>hello</p><img src="a.png" width="40">', '')
  assert.match(output, /<p style="[^"]+">hello<\/p>/)
  assert.match(output, /<img src="a.png" style="[^"]*width: 40px;[^"]*"/)
  assert.doesNotMatch(output, / width="40"/)
})

test('nested lists, label paragraphs, anchors and tspans keep their WeChat fixes', () => {
  const output = prepareWeChatHtml(
    '<ul><li>a<ul><li>b</li></ul></li></ul>'
      + '<span class="nodeLabel"><p>Node</p></span>'
      + '<a href="#top">x</a><a href="https://e.x">y</a><svg><tspan x="1">t</tspan></svg>',
    '',
  )
  assert.match(output, /<li[^>]*>a<\/li><ul/)
  assert.match(output, /<span class="nodeLabel">Node<\/span>/)
  assert.match(output, /<a style="[^"]*">x<\/a>/)
  assert.match(output, /<a href="https:\/\/e.x" style="[^"]*">y<\/a>/)
  assert.match(output, /<tspan x="1" style="fill: #333333 !important;[^"]*">t<\/tspan>/)
})
