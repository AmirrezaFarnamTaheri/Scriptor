import { defaultSchema } from 'hast-util-sanitize'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { preprocessWikilinks } from './preprocess.ts'
import { promoteMermaidHtml } from './mermaid-html.ts'
import { rehypeSourceLines } from './rehype-source-lines.ts'
import { preprocessImports } from './remark-import.ts'
import { remarkAlerts } from './remark-alerts.ts'
import { remarkBreaks } from './remark-breaks.ts'
import { remarkDqlBlocks } from './remark-dql.ts'
import { remarkInfographic } from './remark-infographic.ts'
import { remarkMarkup } from './remark-markup.ts'
import { preprocessMathFences } from './remark-math-fence.ts'
import { remarkMpeCodeChunks } from './remark-mpe-code-chunks.ts'
import { remarkPlantUml } from './remark-plantuml.ts'
import { remarkRuby } from './remark-ruby.ts'
import { remarkToc } from './remark-toc.ts'
import { preprocessWikilinkEmbeds, remarkWikilinkEmbed } from './remark-wikilink-embed.ts'

const mathTagNames = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mo',
  'mn',
  'msup',
  'msub',
  'mfrac',
  'msqrt',
  'mroot',
  'mtable',
  'mtr',
  'mtd',
  'annotation',
  'svg',
  'path',
  'line',
  'g',
  'rect',
  'circle',
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    ...mathTagNames,
    'span',
    'div',
    'aside',
    'section',
    'pre',
    'nav',
    'mark',
    'output',
    'header',
    'button',
  ],
  attributes: {
    ...defaultSchema.attributes,
    input: ['type', 'checked', 'disabled'],
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      'className',
      ['className', 'mpe-code-chunk-body'],
      'dataPlantuml',
    ],
    section: [
      ...(defaultSchema.attributes?.section ?? []),
      ['className', 'mpe-code-chunk', 'mpe-code-chunk-hidden', 'wikilink-embed', 'wikilink-embed-loaded', 'infographic-block', 'dql-block'],
      'dataFootnotes',
      'dataDqlQuery',
      'dataWikilinkEmbed',
      'dataWikilinkTarget',
      'dataWikilinkSection',
      'dataMpeChunk',
      'dataMpeLang',
      'dataMpeTitle',
      'dataMpeHide',
      'dataMpeOutput',
      'dataMpeCmd',
      'ariaLabel',
    ],
    aside: [...(defaultSchema.attributes?.aside ?? []), 'className', 'role', 'dataAlertKind', 'dataMpeChunk'],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'className',
      ['className', 'markup-underline'],
      'style',
      'ariaHidden',
    ],
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'dataSourceLine'],
    nav: [...(defaultSchema.attributes?.nav ?? []), 'className', ['className', 'markdown-toc'], 'ariaLabel'],
    mark: [...(defaultSchema.attributes?.mark ?? []), 'className', ['className', 'markup-highlight']],
    output: [
      ...(defaultSchema.attributes?.output ?? []),
      'className',
      ['className', 'mpe-code-chunk-output'],
      'hidden',
    ],
    header: [...(defaultSchema.attributes?.header ?? []), 'className', ['className', 'mpe-code-chunk-header']],
    button: [
      ...(defaultSchema.attributes?.button ?? []),
      'className',
      ['className', 'mpe-code-chunk-run'],
      'type',
      'disabled',
      'dataMpeRun',
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'id',
      'dataFootnoteRef',
      'dataFootnoteBackref',
      'ariaDescribedBy',
    ],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
    ul: [...(defaultSchema.attributes?.ul ?? []), 'className', ['className', 'markdown-toc-list']],
    li: [...(defaultSchema.attributes?.li ?? []), 'id', 'className', ['className', 'markdown-toc-item']],
    sup: [...(defaultSchema.attributes?.sup ?? []), 'id'],
    svg: [...(defaultSchema.attributes?.svg ?? []), 'xmlns', 'viewBox', 'width', 'height'],
    path: [...(defaultSchema.attributes?.path ?? []), 'd', 'fill', 'stroke'],
  },
}

export interface PreviewPipelineOptions {
  enableMath?: boolean
  enableMermaid?: boolean
  enablePlantUml?: boolean
  enableBreaks?: boolean
  /** Resolve imported markdown paths for `@import "path.md"`. */
  fetchNote?: (path: string) => string | null
  /** Current note path for resolving relative imports. */
  basePath?: string
}

function createProcessor(options: PreviewPipelineOptions = {}) {
  const chain = unified().use(remarkParse)
  if (options.enableBreaks) {
    chain.use(remarkBreaks)
  }
  return chain
    .use(remarkGfm)
    .use(remarkWikilinkEmbed as never)
    .use(remarkMarkup as never)
    .use(remarkToc as never)
    .use(remarkAlerts as never)
    .use(remarkDqlBlocks as never)
    .use(remarkMpeCodeChunks as never)
    .use(remarkInfographic as never)
    .use(remarkRuby as never)
    .use(remarkPlantUml as never)
    .use(remarkMath, { singleDollarTextMath: false })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSanitize, sanitizeSchema as typeof defaultSchema)
    .use(rehypeSourceLines)
    .use(rehypeStringify)
}

const defaultProcessor = createProcessor()

function applyPreviewOptions(markdown: string, options: PreviewPipelineOptions): string {
  let next = markdown
  if (options.enablePlantUml === false) {
    next = next.replace(/```plantuml[\s\S]*?```/gi, '')
  }
  if (options.enableMath === false) {
    next = next.replace(/\$\$[\s\S]*?\$\$/g, '')
    next = next.replace(/(?<![\\$])\$(?!\$)[^$\n]+\$(?!\$)/g, '')
    next = next.replace(/```math[\s\S]*?```/gi, '')
  }
  if (options.enableMermaid === false) {
    next = next.replace(/```mermaid[\s\S]*?```/gi, '')
  }
  return next
}

function preprocessMarkdown(markdown: string, options: PreviewPipelineOptions): string {
  let next = applyPreviewOptions(markdown.replace(/\r\n/g, '\n'), options)
  next = preprocessMathFences(next)
  if (options.fetchNote) {
    next = preprocessImports(next, {
      fetchNote: options.fetchNote,
      basePath: options.basePath,
    })
  }
  next = preprocessWikilinkEmbeds(next)
  next = preprocessWikilinks(next)
  return next
}

export function renderMarkdownPipeline(
  markdown: string,
  options: PreviewPipelineOptions = {},
): string {
  const preprocessed = preprocessMarkdown(markdown, options)
  const processor =
    options.enableBreaks === true ? createProcessor(options) : defaultProcessor
  const file = processor.processSync(preprocessed)
  const html = String(file)
  return options.enableMermaid === false ? html : promoteMermaidHtml(html)
}
