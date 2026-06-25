import defaultPublishCss from '../themes/default-publish.css?raw'
import gracePublishCss from '../themes/grace-publish.css?raw'

export { publishPackManifest } from './manifest.ts'
export { prepareWeChatHtml } from './wechat-export.ts'
export { renderMarkdownForPublish } from './render-markdown.ts'

export const publishThemes = {
  default: defaultPublishCss,
  grace: gracePublishCss,
} as const

export type PublishThemeId = keyof typeof publishThemes

export function getPublishThemeCss(themeId: PublishThemeId = 'default'): string {
  return publishThemes[themeId]
}
