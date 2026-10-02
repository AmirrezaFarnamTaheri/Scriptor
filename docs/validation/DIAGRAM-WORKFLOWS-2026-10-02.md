# Diagram workflow verification

Mermaid and Graphviz DOT previews support bounded zoom and real keyboard/pointer
pan. An explicit live-preview option debounces source changes; PlantUML remains
an explicitly authorized native operation. Diagram notes retain their source.

Graphviz is bundled through the pinned Viz.js package and runs locally in a
separate worker. Each request is limited to 64 KiB UTF-8 input, four MiB SVG
output and ten seconds. A preview accepts at most sixteen Graphviz fences.
Preview replacement aborts its workers. The image element provides a passive
SVG image context. Invalid source remains visible with an error message.

Two browser workflows passed, including a real WebAssembly-rendered DOT graph,
decoded image content, invalid DOT failure, live Mermaid rendering, zoom bounds
and measured keyboard scroll. The Graphviz worker response was served with a
policy allowing WebAssembly and denying all network connections. The desktop
policy permits same-origin workers and WebAssembly compilation, while retaining
the prohibition on general JavaScript evaluation and inline scripts.

Input/output policy unit tests, renderer type checking, scoped lint and the
production build passed. Native packaged WebView verification remains separate.
The implementation follows the [Viz.js API](https://viz-js.com/api/) and
[WebAssembly CSP guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution).
Upstream source and licensing references are retained in the renderer notices.
