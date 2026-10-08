import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

// Mermaid and Markdown math must use a patched KaTeX copy. Exercise Mermaid's
// real math consumers after the dependency override, rather than mocking KaTeX.
for (const diagram of [
  { name: 'flowchart', source: 'flowchart LR\n A["$$x^2$$"] --> B[Result]' },
  { name: 'sequence', source: 'sequenceDiagram\n Alice->>Bob: $$x^2$$' },
]) {
  test(`Mermaid ${diagram.name} preserves mathematical labels with patched KaTeX`, async ({ page }, testInfo) => {
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
    const preview = page.locator('.markdown-preview, .preview-surface, .editable-preview-editor').first()
    const rendered = preview.locator('.mermaid[data-processed="true"]')
    await expect(rendered).toHaveCount(1)
    await expect(rendered.locator('svg')).toBeVisible()
    await expect(rendered.locator('math').first()).toContainText('x')
    await expect(rendered.locator('.katex-error')).toHaveCount(0)
    await testInfo.attach(`mermaid-${diagram.name}-math`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })
}
