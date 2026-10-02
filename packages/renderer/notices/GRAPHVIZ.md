# Graphviz rendering notices

The renderer includes the unmodified WebAssembly build supplied by `@viz-js/viz`.
Its package identity and version are pinned in the package manifest and lockfile.
The installed build identifies Graphviz as 16.1.0. The wrapper uses the MIT license;
Graphviz uses the Eclipse Public License 2.0.

Upstream source and license references:

- https://github.com/mdaines/viz-js
- https://github.com/mdaines/viz-js/blob/v3/LICENSE
- https://gitlab.com/graphviz/graphviz/-/tree/16.1.0
- https://graphviz.org/license/
- https://github.com/libexpat/libexpat/tree/R_2_8_5

The supplied backend provenance records Expat 2.8.5 as a build dependency,
under its MIT license. The Graphviz EPL and Expat MIT texts are bundled alongside
these wrapper notices and are displayed in Diagram studio.

The source graph is rendered locally in an isolated worker. Source is not sent
to a remote renderer. Worker requests are cancelled on preview replacement and
terminated after ten seconds. Returned diagrams appear as SVG images, rather
than executable SVG document markup. Image references, external files and
project resources are not supplied to the WebAssembly filesystem.

## Viz.js wrapper

MIT License

Copyright (c) Michael Daines

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
