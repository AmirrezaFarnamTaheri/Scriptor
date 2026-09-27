import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { formatBadgeFor } from '../../src/lib/exportProfileFormat.ts'

/**
 * Contracts for the surfaces the Gemini audit flagged as visual-only problems
 * that turned out to be data-truth problems.
 *
 * Each case pins the reason the behaviour exists, so a future change that
 * reintroduces the symptom fails with a sentence explaining what broke — not
 * just a mismatched snapshot.
 */

const read = (relativePath) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')

const graphPanel = read('src/components/GraphPanel.tsx')
const graphCanvas = read('src/components/GraphCanvas.tsx')
const graphCss = read('src/styles/components/canvas-graph.css')
const publishCenter = read('src/components/PublishCenter.tsx')
const statusFooter = read('src/components/shell/WorkspaceStatusFooter.tsx')
const shortcutSettings = read('src/components/KeyboardShortcutsSettingsSection.tsx')

/** Reads a `const NAME = <number>` declaration out of a source file. */
function numericConstant(source, name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?)`))
  assert.ok(match, `expected ${name} to be declared as a numeric constant`)
  return Number(match[1])
}

test('reciprocal graph edges are offset far enough to read as separate edges', () => {
  // Each renderer sizes its own arrowhead, so each has to be measured against its
  // own arrow: the SVG `graph-arrow` marker, and the canvas `ARROW_SIZE`. The SVG
  // marker is declared in `strokeWidth` units, so it is scaled by the edge's
  // `stroke-width` to get the arrowhead's real extent in user units.
  const edgeStrokeWidth = Number(graphCss.match(/\.graph-edge\s*\{[^}]*stroke-width:\s*([\d.]+)/)?.[1])
  assert.ok(edgeStrokeWidth, 'expected .graph-edge to declare a stroke-width')
  const svgMarkerWidth = Number(graphPanel.match(/id="graph-arrow"[\s\S]{0,80}?markerWidth="([\d.]+)"/)?.[1])
  assert.ok(svgMarkerWidth, 'expected the graph-arrow marker to declare a markerWidth')
  const renderedSvgArrow = svgMarkerWidth * edgeStrokeWidth

  const canvasArrowSize = numericConstant(graphCanvas, 'ARROW_SIZE')
  const svgOffset = numericConstant(graphPanel, 'RECIPROCAL_EDGE_OFFSET')
  const canvasOffset = numericConstant(graphCanvas, 'RECIPROCAL_EDGE_OFFSET')

  // An offset at or below the arrowhead leaves both arrowheads of a reciprocal
  // pair on the same pixels, so a 4-edge graph still looks like a 2-edge one.
  // Each direction moves by the offset, so the pair separates by twice it.
  assert.ok(
    svgOffset > renderedSvgArrow,
    `SVG offset ${svgOffset} does not clear the ${renderedSvgArrow}-wide arrowhead`,
  )
  assert.ok(
    canvasOffset > canvasArrowSize,
    `canvas offset ${canvasOffset} does not clear the ${canvasArrowSize}-wide arrowhead`,
  )

  // Both renderers draw the same graph above and below the 100-node threshold;
  // a divergence here means one of them silently keeps the old 5px offset.
  assert.equal(svgOffset, canvasOffset, 'SVG and canvas reciprocal offsets must agree')

  // The literal 5 must not reappear as a bare offset in either renderer.
  assert.doesNotMatch(graphPanel, /reciprocal \? \(edge\.source < edge\.target \? 5 : -5\)/)
  assert.doesNotMatch(graphCanvas, /reciprocal \? 5 \* directionSign : 0/)

  // The offset has to come from a pair-canonical normal. Applying it along each
  // edge's own perpendicular — which reverses with the edge — cancels the sign
  // flip and leaves the pair exactly collinear, which is the bug this replaced.
  for (const [name, source] of [['GraphPanel', graphPanel], ['GraphCanvas', graphCanvas]]) {
    assert.match(
      source,
      /function reciprocalOffsetFor\(/,
      `${name} must keep the pair-canonical offset helper`,
    )
    assert.doesNotMatch(
      source,
      /reciprocal \? 5 \* directionSign : 0|edge\.source < edge\.target \? 5 : -5/,
      `${name} must not offset a reciprocal pair along the edge's own perpendicular`,
    )
  }
})

test('graph node labels are masked so edge lines do not cross the glyphs', () => {
  // `paint-order: stroke` paints the stroke behind the fill, so the surface
  // colour knocks a clear plate out of the line without measuring the text.
  assert.match(graphCss, /\.graph-node-label\s*\{[^}]*paint-order:\s*stroke/)
  // The SVG stage is transparent and sits on `.graph-overlay`, which is painted
  // in the opaque `--dialog-bg`. Stroking in `--surface` instead would put a
  // translucent tint behind every label, since `--surface` is a 0.6–0.75 alpha
  // tint in every theme.
  assert.match(graphCss, /\.graph-node-label\s*\{[^}]*stroke:\s*var\(--dialog-bg/)
  assert.match(graphPanel, /<text[^>]*className="graph-node-label"/)

  // The canvas renderer above 100 nodes needs the same treatment, and unlike SVG
  // it has to measure the text to size the plate. The plate pass is separate from
  // the node pass on purpose: drawn inline, its top edge reaches y+18 and paints
  // over the bottom of the r=22 keyboard focus ring.
  assert.match(graphCanvas, /ctx\.measureText\(label\)/)
  assert.match(graphCanvas, /fillStyle = surfaceColor[\s\S]{0,900}?roundRect/)
  const platePass = graphCanvas.indexOf('fillStyle = surfaceColor')
  const nodePass = graphCanvas.indexOf('ctx.arc(node.x, node.y, radius')
  assert.ok(platePass < nodePass, 'label plates must be painted before the node circles and focus rings')
  const focusRing = graphCanvas.indexOf('ctx.arc(node.x, node.y, isFocus ? 26 : 22')
  assert.ok(focusRing > platePass, 'label plates must be painted before the keyboard focus ring')
})

test('export profiles do not print their format twice', () => {
  // The badge is dropped exactly when it would only repeat the name, and kept
  // when it carries information the name does not.
  assert.equal(formatBadgeFor({ id: 'html-standalone', label: 'HTML', format: 'html' }), null)
  assert.equal(formatBadgeFor({ id: 'pdf-print', label: 'PDF', format: 'pdf' }), null)
  assert.equal(formatBadgeFor({ id: 'latex-draft', label: 'LaTeX', format: 'latex' }), null)
  // Casing differences are not information: `LaTeX` and `LATEX` are the same name.
  assert.equal(formatBadgeFor({ id: 'e', label: 'ePub', format: 'epub' }), null)

  // Reveal.js slides is an HTML profile: without the badge it would be
  // indistinguishable from the HTML profile above it.
  assert.equal(formatBadgeFor({ id: 'reveal-slides', label: 'Reveal.js slides', format: 'html' }), 'HTML')
  assert.equal(formatBadgeFor({ id: 'wechat', label: 'WeChat', format: 'wechat-html' }), 'WECHAT-HTML')

  // Whatever it decides, the markup has to go through the helper rather than read
  // the format directly.
  assert.match(publishCenter, /\{formatBadge \? <span className="publish-format-chip">/)
  assert.doesNotMatch(
    publishCenter,
    /<span className="publish-format-chip">\{profile\.format\.toUpperCase\(\)\}<\/span>/,
  )
})

test('the publish center names the active note in one place', () => {
  // The shell header subtitle already said `Active note: X`; the footer repeated
  // it as `Active: X` in the same dialog.
  assert.match(publishCenter, /Active note: \$\{activePath\}/)
  assert.doesNotMatch(publishCenter, /`Active: \$\{activePath\}`/)

  // The header subtitle becomes the live `Exporting …` line while a run is in
  // progress, so a footer restating the active note during an export would just
  // reproduce the subtitle. Assert no footer content duplicates a subtitle branch,
  // rather than pinning the shape of the prop.
  const subtitleBranches = [...publishCenter.matchAll(/`([^`]*\$\{activePath\}[^`]*)`/g)].map((m) => m[1])
  assert.ok(subtitleBranches.length >= 2, 'expected the subtitle to have an idle and an exporting branch')
  const footerBlock = publishCenter.slice(publishCenter.indexOf('footer='), publishCenter.indexOf('</UnifiedPanelShell>'))
  for (const branch of subtitleBranches) {
    assert.ok(
      !footerBlock.includes(branch),
      `the footer repeats a subtitle branch: ${branch}`,
    )
  }
})

test('the diagnostics opt-in matches the subsystem pills beside it', () => {
  // It was a bare checkbox sitting in a row of `subsystem-toggle-badge` buttons,
  // so the one control in that row that is a real toggle looked like static text.
  assert.match(
    statusFooter,
    /className=\{`subsystem-toggle-badge \$\{diagnosticsOptIn \? 'active' : 'hibernated'\}`\}/,
  )
  assert.match(statusFooter, /aria-pressed=\{diagnosticsOptIn\}/)
  assert.doesNotMatch(
    statusFooter,
    /diagnostics-opt-in/,
    'the footer must not keep the settings-form checkbox markup',
  )

  // The settings forms still use `.diagnostics-opt-in`, so that class has to
  // survive in CSS even though the footer stopped using it.
  const settingsUses = read('src/components/SettingsPanel.tsx')
  assert.match(settingsUses, /diagnostics-opt-in/)
  assert.match(read('src/styles/app/dock-settings.css'), /\.diagnostics-opt-in\s*\{/)
})

test('every badge in the footer row reports pressed in the same sense', () => {
  // Six identical badges sit in one row. If `aria-pressed` does not mean the same
  // thing across them, a screen reader announces "pressed" for a control that
  // looks switched off next to one that looks on.
  const subsystemToggles = read('src/components/shell/SubsystemToggles.tsx')

  // `active` is the state the badge paints when the subsystem is running, so
  // pressed has to mean `!hibernated`.
  assert.match(
    subsystemToggles,
    /className=\{`subsystem-toggle-badge \$\{hibernated \? 'hibernated' : 'active'\}`\}/,
    'the subsystem badges must keep painting active when the subsystem is running',
  )
  assert.match(
    subsystemToggles,
    /aria-pressed=\{!hibernated\}/,
    'aria-pressed must mean the same as the active class, not the opposite',
  )
  assert.doesNotMatch(
    subsystemToggles,
    /aria-pressed=\{hibernated\}/,
    'aria-pressed must not report the inverse of what the badge looks like',
  )
})

test('the shortcut helper only speaks when normalising changes the shortcut', () => {
  // Defaults are stored in the same human-readable form the input renders, so an
  // unconditional helper printed `Displays as Alt+I` directly under an input that
  // already read `Alt+I`. It earns its place only when the two differ.
  assert.match(
    shortcutSettings,
    /const effectiveDisplay = value \? formatShortcut\(value\) \?\? value : ''/,
  )
  assert.match(
    shortcutSettings,
    /effectiveDisplay !== value \? \([\s\S]{0,400}?<small className="shortcut-effective-label">Displays as \{effectiveDisplay\}<\/small>/,
    'the helper must be gated on the display form differing from the stored one',
  )
  assert.doesNotMatch(
    shortcutSettings,
    /`Displays as \$\{formatShortcut\(value\) \?\? value\}`/,
    'the helper must not be rendered unconditionally from the stored value',
  )

  // An unassigned row still has to say so, and a row with no default at all
  // renders the `Unassigned` placeholder in the input.
  assert.match(shortcutSettings, /<small className="shortcut-effective-label">Disabled<\/small>/)
  assert.match(shortcutSettings, /placeholder=\{entry\.defaultShortcut \?\? 'Unassigned'\}/)

  // The action column has to stay truthful: an override gets a working Reset, and
  // only a row that really is on its default gets the `Default` badge.
  assert.match(shortcutSettings, /hasOverride \? \(/)
  assert.match(shortcutSettings, /shortcuts\.resetShortcut\(entry\.id\)/)
  assert.match(shortcutSettings, /<span className="shortcut-default-badge">Default<\/span>/)
})
