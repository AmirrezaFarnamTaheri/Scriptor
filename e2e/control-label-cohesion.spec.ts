import { expect, test, type Page, type Locator, type TestInfo } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

/** P1 VIS-031: a label's own geometry can pass while its parent scrollport
 * clips the beginning or end after scrollIntoViewIfNeeded at high app zoom. */
async function expectFullConsentInsidePanelBody(label:Locator, note:string) {
  const geometry=await label.evaluate(element => {
    const body=element.closest('.unified-panel-body')
    if (!body) return null
    const labelBox=element.getBoundingClientRect()
    const bodyBox=body.getBoundingClientRect()
    const bottomNav=document.querySelector<HTMLElement>('.mobile-workspace-nav')
    const navBox=bottomNav?.getBoundingClientRect()
    const limit=navBox && navBox.height>0 ? Math.min(navBox.top,bodyBox.bottom) : bodyBox.bottom
    return {
      top:labelBox.top, bottom:labelBox.bottom,
      left:labelBox.left, right:labelBox.right,
      bodyTop:bodyBox.top, bodyBottom:limit,
      bodyLeft:bodyBox.left, bodyRight:bodyBox.right,
      bodyHeight:bodyBox.height, labelHeight:labelBox.height,
    }
  })
  expect(geometry,note+' must have an owning scrollport').not.toBeNull()
  expect(geometry!.bodyHeight,note+' scrollport must fit its consent').toBeGreaterThanOrEqual(geometry!.labelHeight+8)
  expect(geometry!.top,note+' label start must be readable').toBeGreaterThanOrEqual(geometry!.bodyTop-1)
  expect(geometry!.bottom,note+' label end must be readable above mobile nav').toBeLessThanOrEqual(geometry!.bodyBottom+1)
  expect(geometry!.left,note+' label left must remain in body').toBeGreaterThanOrEqual(geometry!.bodyLeft-1)
  expect(geometry!.right,note+' label right must remain in body').toBeLessThanOrEqual(geometry!.bodyRight+1)
}

// Direct CSS stress zoom publishes the effective viewport dimensions used by
// the app's CSS fallback. Actual shortcut-driven zoom is covered separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:ui-zoom', '1'))
})

for (const theme of ['light','dark']) for (const surface of [
  {command:'Asset deck',region:'Asset deck',checkbox:'Unused assets only',text:'Unused assets only'},
  {command:'Diagram studio',region:'Diagram studio',checkbox:'Refresh local preview as I type',text:'Refresh local preview as I type'},
]) test(`${surface.command} ${theme} keeps checkbox and label together across narrow, RTL and zoomed layouts`,async ({page},testInfo) => {
  await page.addInitScript(() => { sessionStorage.setItem('e2e:research','1'); sessionStorage.setItem('e2e:asset-media','1') })
  await launchApp(page,{theme})
  await openCommandPalette(page)
  await runCommand(page,surface.command)
  const panel = surface.command === 'Asset deck' ? page.locator('.asset-deck-workspace[role="region"]') : page.getByRole('region',{name:surface.region,exact:true})
  await expect(panel).toBeVisible()
  if (surface.command === 'Diagram studio') {
    await panel.getByRole('button',{name:'Render diagram',exact:true}).click()
    await expect(panel.locator('.diagram-viewport svg')).toBeVisible()
    const source = panel.getByLabel('Diagram source',{exact:true})
    expect(await source.evaluate(element => getComputedStyle(element).direction)).toBe('ltr')
    const sourceBackground = await source.evaluate(element => getComputedStyle(element).backgroundColor)
    const related = panel.getByRole('textbox',{name:'Related notes (one vault-relative .md path per line)',exact:true})
    expect(await related.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(sourceBackground)
    expect(await related.evaluate(element => Number.parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(6)
    const zoom = panel.getByRole('button',{name:'Zoom in',exact:true})
    expect((await zoom.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await zoom.evaluate(element => Number.parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(6)
  }
  const checkbox = panel.getByRole('checkbox',{name:surface.checkbox,exact:true})
  const label = checkbox.locator('..')
  for (const direction of ['ltr','rtl']) for (const width of [320,375,768,1440]) for (const zoom of [1,2]) {
    await page.setViewportSize({width,height:1100})
    await page.locator('html').evaluate((element,settings) => { element.dir=settings.direction; element.style.zoom=String(settings.zoom); element.style.setProperty('--app-viewport-width',`calc(100vw / ${settings.zoom})`); document.body.style.setProperty('--app-viewport-width',`calc(100vw / ${settings.zoom})`); element.style.setProperty('--app-viewport-height',`calc(100dvh / ${settings.zoom})`); document.body.style.setProperty('--app-viewport-height',`calc(100dvh / ${settings.zoom})`) },{direction,zoom})
    const geometry = await label.evaluate(element => {
      const input=element.querySelector('input')!.getBoundingClientRect()
      const text=element.querySelector('span')!.getBoundingClientRect()
      const bounds=element.getBoundingClientRect()
      return {center:Math.abs(input.y+input.height/2-text.y-text.height/2),gap:Math.max(input.x-text.right,text.x-input.right),inputWidth:input.width,labelHeight:bounds.height,left:bounds.left,right:bounds.right}
    })
    expect(geometry.center,`${direction} ${width} zoom ${zoom}`).toBeLessThanOrEqual(2*zoom)
    expect(geometry.gap).toBeGreaterThanOrEqual(0)
    expect(geometry.gap).toBeLessThanOrEqual(12*zoom)
    expect(geometry.inputWidth).toBeLessThanOrEqual(24*zoom)
    expect(geometry.labelHeight).toBeGreaterThanOrEqual(44*zoom-1)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(width+1)
    await testInfo.attach(`${direction}-${width}-${zoom}`,{body:JSON.stringify(geometry),contentType:'application/json'})
    if (width === 320 || width === 1440) {
      await label.scrollIntoViewIfNeeded()
      if (width === 320 && zoom === 2) await expectFullConsentInsidePanelBody(label,`${surface.command} ${theme} ${direction} 320px at 200% app zoom`)
      await label.screenshot({path:testInfo.outputPath(`${theme}-${direction}-${width}-${zoom}-toggle.png`)})
      await panel.screenshot({path:testInfo.outputPath(`${theme}-${direction}-${width}-${zoom}.png`)})
      if (width === 320 && zoom === 2) await page.screenshot({path:testInfo.outputPath(`${theme}-${direction}-320-zoom2-full.png`),fullPage:true})
    }
  }
  await page.locator('html').evaluate(element => { element.dir='ltr'; element.style.zoom='1'; element.style.removeProperty('--app-viewport-width'); element.style.removeProperty('--app-viewport-height'); document.body.style.removeProperty('--app-viewport-width'); document.body.style.removeProperty('--app-viewport-height') })
  await page.setViewportSize({width:375,height:900})
  await expect(checkbox).not.toBeChecked()
  await label.getByText(surface.text,{exact:true}).click()
  await expect(checkbox).toBeChecked()
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).not.toBeChecked()
  await panel.screenshot({path:testInfo.outputPath('cohesive-toggle-375.png')})
})

for (const theme of ['light','dark']) test(`persistent Python ${theme} setup keeps consent cohesive and environment shorter than the code editor`,async ({page},testInfo) => {
  await launchApp(page,{theme})
  await openCommandPalette(page)
  await runCommand(page,'Runtime console')
  const panel=page.locator('.runtime-console')
  await panel.getByRole('combobox',{name:'Execution mode',exact:true}).selectOption('persistent')
  const checkbox=panel.getByRole('checkbox',{name:'I reviewed the Python session and its environment.',exact:true})
  for (const direction of ['ltr','rtl']) for (const width of [320,1440]) for (const zoom of [1,2]) {
    await page.setViewportSize({width,height:1100})
    await page.locator('html').evaluate((element,value) => {element.dir=value.direction;element.style.zoom=String(value.zoom); element.style.setProperty('--app-viewport-width',`calc(100vw / ${value.zoom})`); document.body.style.setProperty('--app-viewport-width',`calc(100vw / ${value.zoom})`); element.style.setProperty('--app-viewport-height',`calc(100dvh / ${value.zoom})`); document.body.style.setProperty('--app-viewport-height',`calc(100dvh / ${value.zoom})`)},{direction,zoom})
    const geometry=await checkbox.locator('..').evaluate(element => {
      const input=element.querySelector('input')!.getBoundingClientRect()
      const text=element.querySelector('span')!.getBoundingClientRect()
      return {center:Math.abs(input.y+input.height/2-text.y-text.height/2),gap:Math.max(input.x-text.right,text.x-input.right),height:element.getBoundingClientRect().height}
    })
    expect(geometry.center).toBeLessThanOrEqual(2*zoom)
    expect(geometry.gap).toBeGreaterThanOrEqual(0)
    expect(geometry.gap).toBeLessThanOrEqual(12*zoom)
    expect(geometry.height).toBeGreaterThanOrEqual(44*zoom-1)
    const environment=await panel.getByLabel('Session environment',{exact:true}).boundingBox()
    const code=await panel.getByRole('textbox',{name:'Code',exact:true}).boundingBox()
    expect(environment!.height).toBeLessThan(120*zoom)
    expect(code!.height).toBeGreaterThanOrEqual(180*zoom)
    const startButton = await panel.getByRole('button', { name: 'Review permission and start kernel', exact: true }).boundingBox()
    const paneBounds = await panel.boundingBox()
    expect(startButton!.height).toBeGreaterThanOrEqual(44 * zoom - 1)
    expect(startButton!.width).toBeLessThanOrEqual(paneBounds!.width + 1)
    await checkbox.locator('..').scrollIntoViewIfNeeded()
    if (width === 320 && zoom === 2) await expectFullConsentInsidePanelBody(checkbox.locator('..'),`Runtime ${theme} ${direction} 320px at 200% app zoom`)
    await checkbox.locator('..').screenshot({path:testInfo.outputPath(`runtime-toggle-${theme}-${direction}-${width}-${zoom}.png`)})
    await panel.screenshot({path:testInfo.outputPath(`runtime-setup-${theme}-${direction}-${width}-${zoom}.png`)})
    if (width === 320 && zoom === 2) await page.screenshot({path:testInfo.outputPath(`runtime-${theme}-${direction}-320-zoom2-full.png`),fullPage:true})
  }
  await checkbox.locator('..').getByText('I reviewed the Python session and its environment.',{exact:true}).click()
  await expect(checkbox).toBeChecked()
})

async function auditConsent(page:Page,panel:Locator,label:Locator,name:string,testInfo:TestInfo) {
  for (const direction of ['ltr','rtl']) for (const width of [320,1440]) for (const zoom of [1,2]) {
    await page.setViewportSize({width,height:1100})
    await page.locator('html').evaluate((element,value) => {element.dir=value.direction;element.style.zoom=String(value.zoom); element.style.setProperty('--app-viewport-width',`calc(100vw / ${value.zoom})`); document.body.style.setProperty('--app-viewport-width',`calc(100vw / ${value.zoom})`); element.style.setProperty('--app-viewport-height',`calc(100dvh / ${value.zoom})`); document.body.style.setProperty('--app-viewport-height',`calc(100dvh / ${value.zoom})`)},{direction,zoom})
    const geometry=await label.evaluate(element => {
      const input=element.querySelector('input')!.getBoundingClientRect()
      const text=element.querySelector('span')!.getBoundingClientRect()
      const bounds=element.getBoundingClientRect()
      return {center:Math.abs(input.y+input.height/2-text.y-text.height/2),gap:Math.max(input.x-text.right,text.x-input.right),height:bounds.height,left:bounds.left,right:bounds.right}
    })
    expect(geometry.center).toBeLessThanOrEqual(2*zoom)
    expect(geometry.gap).toBeGreaterThanOrEqual(0)
    expect(geometry.gap).toBeLessThanOrEqual(12*zoom)
    expect(geometry.height).toBeGreaterThanOrEqual(44*zoom-1)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(width+1)
    await label.scrollIntoViewIfNeeded()
    await label.screenshot({path:testInfo.outputPath(`${name}-${direction}-${width}-${zoom}-toggle.png`)})
    await panel.screenshot({path:testInfo.outputPath(`${name}-${direction}-${width}-${zoom}.png`)})
    if (width === 320 && zoom === 2 && name.startsWith('overleaf-')) {
      // A two-line consent must never crowd, truncate or overlay the two
      // safety-critical review actions at 200% magnification.
      const buttons = panel.locator('.overleaf-review-actions > button')
      await expect(buttons).toHaveCount(2)
      await expect(buttons.first()).toHaveAccessibleName('Apply reviewed source locally')
      await expect(buttons.last()).toHaveAccessibleName('Share reviewed source with Overleaf')
      // A scrollable CSS grid used to compress its consent row, even though
      // the button rectangles themselves never intersected.
      const consentBounds = await label.boundingBox()
      const consentText = await label.locator('span').boundingBox()
      const actionsBounds = await panel.locator('.overleaf-review-actions').boundingBox()
      expect(consentText!.y + consentText!.height).toBeLessThanOrEqual(consentBounds!.y + consentBounds!.height + 1)
      expect(consentBounds!.y + consentBounds!.height).toBeLessThanOrEqual(actionsBounds!.y + 1)
      const rects = await buttons.evaluateAll(elements => elements.map(el => {
        const rect = el.getBoundingClientRect()
        const visibleLabel = Array.from(el.querySelectorAll('span')).find(span => getComputedStyle(span).display !== 'none')
        const labelBounds = visibleLabel?.getBoundingClientRect()
        return {
          top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
          clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
          labelTop: labelBounds?.top ?? Number.NEGATIVE_INFINITY,
          labelBottom: labelBounds?.bottom ?? Number.POSITIVE_INFINITY,
          labelLeft: labelBounds?.left ?? Number.NEGATIVE_INFINITY,
          labelRight: labelBounds?.right ?? Number.POSITIVE_INFINITY,
        }
      }))
      expect(rects[0].bottom).toBeLessThanOrEqual(rects[1].top + 1)
      for (const rect of rects) {
        expect(rect.scrollHeight).toBeLessThanOrEqual(rect.clientHeight + 1)
        expect(rect.labelTop).toBeGreaterThanOrEqual(rect.top - 1)
        expect(rect.labelBottom).toBeLessThanOrEqual(rect.bottom + 1)
        expect(rect.labelLeft).toBeGreaterThanOrEqual(rect.left - 1)
        expect(rect.labelRight).toBeLessThanOrEqual(rect.right + 1)
      }
    }
    if (width === 320 && zoom === 2 && name.startsWith('source-')) {
      // At narrow widths the source editor starts with file actions rather
      // than a large explanatory paragraph before the editing surface.
      await expect(panel.locator(':scope > header p')).toBeHidden()
    }
    if (width === 320 && zoom === 2) await page.screenshot({path:testInfo.outputPath(`${name}-${direction}-320-zoom2-full.png`),fullPage:true})
  }
}

for (const theme of ['light','dark']) test(`saved LaTeX and Overleaf ${theme} consent controls stay attached to their labels`,async ({page},testInfo) => {
  await launchApp(page,{theme})
  await page.evaluate(() => {
    const api=(window as Window & {__TAURI_INTERNALS__?:{invoke?:(command:string,args?:Record<string,unknown>,options?:unknown)=>Promise<unknown>}}).__TAURI_INTERNALS__
    if (!api?.invoke) throw new Error('Native fixture unavailable')
    const original=api.invoke.bind(api)
    api.invoke=async (command,args={},options) => {
      if (command === 'source_file_read') return {vault_id:args.expectedVaultId,path:args.path,content:'\\section{Reviewed}\n',content_hash:'a'.repeat(64),language:'latex'}
      if (command === 'overleaf_read') return {head:'b'.repeat(40),content:'\\section{Remote}\n',content_hash:'c'.repeat(64)}
      return original(command,args,options)
    }
  })
  await openCommandPalette(page); await runCommand(page,'Source file editor')
  const editor=page.getByRole('region',{name:'Source file editor',exact:true})
  await editor.getByRole('button',{name:'Plain text',exact:true}).click()
  await editor.getByLabel('File path',{exact:true}).fill('main.tex')
  await editor.getByRole('button',{name:'Open file',exact:true}).click()
  const content = editor.getByRole('textbox',{name:'Source file content',exact:true})
  expect(await content.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(await editor.getByLabel('File path',{exact:true}).evaluate(element => getComputedStyle(element).backgroundColor))
  expect(await content.evaluate(element => Number.parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(6)
  const compile=editor.getByRole('checkbox',{name:'I reviewed the saved source and want to compile it.',exact:true})
  await auditConsent(page,editor,compile.locator('..'),`source-${theme}`,testInfo)
  await page.locator('html').evaluate(element => {element.style.zoom='1'; element.style.removeProperty('--app-viewport-width'); element.style.removeProperty('--app-viewport-height'); document.body.style.removeProperty('--app-viewport-width'); document.body.style.removeProperty('--app-viewport-height');element.dir='ltr'})
  await page.setViewportSize({width:1440,height:1100})
  await compile.locator('..').getByText('I reviewed the saved source and want to compile it.',{exact:true}).click()
  await expect(compile).toBeChecked()
  await editor.getByRole('button',{name:'Open Overleaf sync',exact:true}).click()
  const overleaf=page.getByRole('dialog',{name:'Overleaf source sync',exact:true})
  await overleaf.getByRole('textbox',{name:'Overleaf project ID or official URL',exact:true}).fill('abcdef123456')
  await overleaf.getByRole('button',{name:'Fetch remote source preview',exact:true}).click()
  const consent=overleaf.getByRole('checkbox',{name:'I compared both copies and reviewed this source for the selected action',exact:true})
  await auditConsent(page,overleaf,consent.locator('..'),`overleaf-${theme}`,testInfo)
  await consent.locator('..').getByText('I compared both copies and reviewed this source for the selected action',{exact:true}).click()
  await expect(consent).toBeChecked()
})
