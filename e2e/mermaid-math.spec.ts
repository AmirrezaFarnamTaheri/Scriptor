import { expect, test } from '@playwright/test'
import { launchApp, settleLayout, waitForWorkspace } from './helpers'

// Mermaid and Markdown math must use a patched KaTeX copy. Exercise Mermaid's
// real math consumers after the dependency override, rather than mocking KaTeX.
for (const diagram of [
  { name: 'flowchart', source: 'flowchart LR\n A["$$x^2$$"] --> B[Result]', labels: ['Result'] },
  { name: 'sequence', source: 'sequenceDiagram\n Alice->>Bob: $$x^2$$', labels: ['Alice', 'Bob'] },
]) {
  test(`Mermaid ${diagram.name} preserves mathematical labels with patched KaTeX`, async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem('scriptor:editor-mode', 'monaco'))
    await launchApp(page)
    await waitForWorkspace(page)
    const markdown = `# Math compatibility\n\n\`\`\`mermaid\n${diagram.source}\n\`\`\`\n`
    await page.evaluate(value => {
      const editor = (window as Window & {
        __scriptorE2eEditor: { getModel(): { setValue(value: string): void } }
      }).__scriptorE2eEditor
      editor.getModel().setValue(value)
    }, markdown)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
    await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()
    const inspector = page.locator('.inspector-panel').getByRole('article', { name: 'Markdown preview' })
    await expect(inspector.getByRole('heading', { name: 'Math compatibility', exact: true })).toBeVisible()
    await expect(inspector).toHaveAttribute('aria-busy', 'false')
    await expect(inspector).toHaveAttribute('data-preview-degraded', 'false')
    for (const preview of [page.locator('.editor-rendered-view .editable-preview-editor'), inspector]) {
      const rendered = preview.locator('.mermaid[data-processed="true"]')
      await expect(rendered).toHaveCount(1)
      const svg = rendered.locator(':scope > svg')
      await expect(svg).toBeVisible()
      // Visibility alone allowed the global icon rule to collapse diagrams to 17px.
      await expect.poll(() => svg.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(100)
      // A two-node flowchart is naturally shorter than a sequence diagram.
      // Compare against its intrinsic aspect ratio instead of a diagram-specific
      // minimum height, while keeping the width guard against icon CSS collapse.
      await expect.poll(() => svg.evaluate(element => {
        const box = element.getBoundingClientRect()
        const viewBox = (element as SVGSVGElement).viewBox.baseVal
        return viewBox.width > 0 && viewBox.height > 0
          ? Math.abs(box.width / box.height - viewBox.width / viewBox.height)
          : Number.POSITIVE_INFINITY
      })).toBeLessThan(0.1)
      for (const label of diagram.labels) await expect(rendered.getByText(label, { exact: true }).first()).toBeVisible()
      await expect(rendered.locator('math').first()).toContainText('x')
      // Mermaid uses native MathML when supported, and KaTeX's HTML renderer
      // only for its legacy fallback. Assert the actual painted formula.
      const htmlFormula = rendered.locator('.katex-html').first()
      const formula = await htmlFormula.count() > 0 ? htmlFormula : rendered.locator('math').first()
      await expect(formula).toBeVisible()
      await expect.poll(() => formula.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(10)
      await expect(rendered.locator('math msup').first()).toContainText('x2')
      await expect(rendered.locator('.katex-error')).toHaveCount(0)
    }
    await settleLayout(page)
    await testInfo.attach(`mermaid-${diagram.name}-math`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })
}
