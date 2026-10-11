import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

for (const theme of ['light','dark']) for (const surface of [
  {command:'Database studio',region:'Database Studio',role:'combobox' as const,name:'Saved view'},
  {command:'Capture reviewer',region:'Capture reviewer',role:'textbox' as const,name:'Article URL'},
  {command:'Drive collaboration',region:'Drive collaboration',role:'combobox' as const,name:'Revision transport'},
  {command:'Publishing studio',region:'Publishing studio',role:'textbox' as const,name:'Local site folder'},
  {command:'Runtime console',region:'Runtime console',role:'combobox' as const,name:'Execution mode'},
]) test(`${surface.command} ${theme} shows a visible accent outline on its named keyboard control`,async ({page},testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:research','1'))
  await launchApp(page,{theme})
  await openCommandPalette(page)
  await runCommand(page,surface.command)
  const panel=surface.command === 'Runtime console' ? page.locator('.runtime-console') : page.getByRole('region',{name:surface.region,exact:true})
  await expect(panel).toBeVisible()
  const control=panel.getByRole(surface.role,{name:surface.name,exact:true})
  await expect(control).toBeEnabled()
  await page.keyboard.press('Tab')
  await control.focus()
  await expect(control).toBeFocused()
  const focus=await control.evaluate(element => {
    const style=getComputedStyle(element)
    const probe=document.createElement('span')
    probe.style.color='var(--accent)'
    element.parentElement!.append(probe)
    const accent=getComputedStyle(probe).color
    probe.remove()
    return {visible:element.matches(':focus-visible'),width:parseFloat(style.outlineWidth),style:style.outlineStyle,color:style.outlineColor,accent}
  })
  expect(focus.visible).toBe(true)
  expect(focus.width).toBeGreaterThanOrEqual(2)
  expect(focus.style).toBe('solid')
  expect(focus.color).toBe(focus.accent)
  expect(focus.color).not.toBe('rgba(0, 0, 0, 0)')
  await testInfo.attach('named-control-focus',{body:JSON.stringify(focus),contentType:'application/json'})
  await panel.screenshot({path:testInfo.outputPath(`${surface.command.replaceAll(' ','-')}-${theme}-focus.png`)})
})
