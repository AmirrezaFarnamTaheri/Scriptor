import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import ts from 'typescript'

// Run the actual ownership/visibility functions in a browser without depending
// on a particular application layout. Guide lookup imports are unused here.
const source = ts.transpileModule(readFileSync(new URL('../src/lib/help/context.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const bootstrap = `(() => {
  const exports = {};
  const require = () => ({});
  ${source}
  window.readHelpScope = () => ({
    scope: exports.activeHelpScope()?.id ?? null,
    canInvite: exports.canOfferHelpInvitation(document.getElementById('widget'), document.getElementById('heading')),
  });
})();`

const fixture = `<section id="widget" data-help-topic="citations">
  <header id="heading">Citations
    <span class="help-affordance help-ui" data-help-topic="citations">
      <button id="help">Help</button>
      <span class="help-invitation"><button id="invite">Guide</button></span>
    </span>
  </header>
  <input id="editor" aria-label="Citation search">
</section>`

test('help trigger and invitation keyboard focus retain the feature owner', async ({ page }) => {
  await page.setContent(fixture)
  await page.addScriptTag({ content: bootstrap })
  for (const id of ['editor', 'help', 'invite']) {
    await page.locator(`#${id}`).focus()
    expect(await page.evaluate('window.readHelpScope()')).toEqual({ scope: 'widget', canInvite: true })
  }
})

test('a blocking modal still suppresses background invitations', async ({ page }) => {
  await page.setContent(`${fixture}<div id="modal" role="dialog" aria-modal="true"><button id="close">Close</button></div>`)
  await page.addScriptTag({ content: bootstrap })
  await page.locator('#close').focus()
  expect(await page.evaluate('window.readHelpScope()')).toEqual({ scope: 'modal', canInvite: false })
})

test('hidden source widgets cannot acquire help ownership', async ({ page }) => {
  await page.setContent(fixture)
  await page.addScriptTag({ content: bootstrap })
  await page.locator('#help').focus()
  await page.locator('#widget').evaluate((element) => element.setAttribute('hidden', ''))
  expect(await page.evaluate('window.readHelpScope()')).toEqual({ scope: null, canInvite: false })
})
