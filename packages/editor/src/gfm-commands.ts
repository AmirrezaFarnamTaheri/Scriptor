import { syntaxTree } from '@codemirror/language'
import { EditorSelection, type Line } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

function selectedRanges(view: EditorView) {
  return view.state.selection.ranges
}

function linesInSelection(view: EditorView, from: number, to: number): Line[] {
  const start = view.state.doc.lineAt(from)
  const end = view.state.doc.lineAt(to)
  const lines: Line[] = []
  for (let number = start.number; number <= end.number; number += 1) {
    lines.push(view.state.doc.line(number))
  }
  return lines
}

export function removeListMarkers(text: string): string {
  return text.replace(/^([-*+] +\[[ xX]\] )|^([-*+] )|^(\d+\. )/, '')
}

function toggleBlockWithMarks(
  view: EditorView,
  leftMark: string,
  rightMark: string,
  mainNodeName?: string,
  markNodeName?: string,
): void {
  const state = view.state
  const hasNodeNames = mainNodeName !== undefined && markNodeName !== undefined

  const updates = state.changeByRange(({ from, to }) => {
    if (hasNodeNames) {
      const node = syntaxTree(state).resolve(from)
      if (node.name === mainNodeName) {
        const markNodes = node.getChildren(markNodeName)
        if (markNodes.length === 2) {
          const markBegin = markNodes[0]
          const markEnd = markNodes[1]
          const removedLength = markBegin.to - markBegin.from
          return {
            range: EditorSelection.range(from - removedLength, to - removedLength),
            changes: {
              from: node.from,
              to: node.to,
              insert: state.sliceDoc(markBegin.to, markEnd.from),
            },
          }
        }
      }
    }

    const selectedText = state.sliceDoc(from, to)
    const startTestPos = from - leftMark.length
    const endTestPos = to + rightMark.length

    if (startTestPos >= 0 && endTestPos <= state.doc.length) {
      const leftTest = state.sliceDoc(startTestPos, startTestPos + leftMark.length)
      const rightTest = state.sliceDoc(endTestPos - rightMark.length, endTestPos)
      if (leftTest === leftMark && rightTest === rightMark) {
        return {
          range: EditorSelection.range(startTestPos, startTestPos + selectedText.length),
          changes: { from: startTestPos, to: endTestPos, insert: selectedText },
        }
      }
    }

    const newPos = from + leftMark.length
    return {
      range: EditorSelection.range(newPos, newPos + selectedText.length),
      changes: { from, to, insert: `${leftMark}${selectedText}${rightMark}` },
    }
  })

  view.dispatch(updates)
  view.focus()
}

function toggleLineLeadingMark(view: EditorView, mark: string, level: number): void {
  const lines = [...selectedRanges(view)].flatMap((range) =>
    linesInSelection(view, range.from, range.to),
  )
  const uniqueLines = [...new Map(lines.map((line) => [line.number, line])).values()]
  const regex = new RegExp(`^( *)(${mark}+)( +)`)

  const removeMarks = !uniqueLines.some((line) => {
    const match = line.text.match(regex)
    return match?.[2].length !== level
  })

  for (const line of uniqueLines.reverse()) {
    const text = line.text
    const match = text.match(regex)
    const repeatedMarks = mark.repeat(level)

    if (match) {
      const from = line.from + match[1].length
      const markerLen = match[2].length
      if (markerLen === level && removeMarks) {
        view.dispatch({
          changes: { from, to: from + markerLen + match[3].length, insert: '' },
        })
      } else if (markerLen !== level) {
        view.dispatch({
          changes: { from, to: from + markerLen, insert: repeatedMarks },
        })
      }
    } else if (text.length > 0 || uniqueLines.length === 1) {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: `${repeatedMarks} ` },
      })
      if (text.length === 0) {
        view.dispatch({
          selection: EditorSelection.cursor(line.to + repeatedMarks.length + 1),
        })
      }
    }
  }

  view.focus()
}

function toggleListStyle(
  view: EditorView,
  matches: (index: number) => RegExp,
  createMark: (index: number, suggested?: string) => string,
  toggleMark?: (line: string) => string | undefined,
): void {
  for (const range of selectedRanges(view)) {
    const lines = linesInSelection(view, range.from, range.to)
    let removeMarks = true
    let suggestedMark: string | undefined

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const empty = lines.length > 1 && line.text.length === 0
      if (empty) continue
      const match = line.text.match(matches(index))
      if (match) {
        suggestedMark = match[0].substring(0, 1)
      } else {
        removeMarks = false
      }
    }

    const updates: string[] = []
    let lineIndex = 0
    for (const line of lines) {
      const empty = lines.length > 1 && line.text.length === 0
      if (empty) {
        updates.push(line.text)
        continue
      }
      const match = line.text.match(matches(lineIndex))
      if (match) {
        if (removeMarks) {
          const toggled = toggleMark?.(line.text)
          updates.push(toggled ?? line.text.substring(match[0].length))
        } else {
          updates.push(line.text)
        }
      } else if (line.text.length > 0 || lines.length === 1) {
        updates.push(`${createMark(lineIndex, suggestedMark)} ${removeListMarkers(line.text)}`)
      } else {
        updates.push(line.text)
      }
      lineIndex += 1
    }

    const startIndex = lines[0].from
    const endIndex = lines[lines.length - 1].to
    view.dispatch({
      changes: {
        from: startIndex,
        to: endIndex,
        insert: updates.join(view.state.lineBreak),
      },
    })
  }

  view.focus()
}

export function toggleBold(view: EditorView): void {
  toggleBlockWithMarks(view, '**', '**', 'StrongEmphasis', 'EmphasisMark')
}

export function toggleItalic(view: EditorView): void {
  toggleBlockWithMarks(view, '*', '*', 'Emphasis', 'EmphasisMark')
}

export function toggleStrikethrough(view: EditorView): void {
  toggleBlockWithMarks(view, '~~', '~~', 'Strikethrough', 'StrikethroughMark')
}

export function toggleHeading(view: EditorView, level: number): void {
  toggleLineLeadingMark(view, '#', level)
}

export function toggleBlockquote(view: EditorView): void {
  toggleLineLeadingMark(view, '>', 1)
}

export function toggleBulletList(view: EditorView): void {
  toggleListStyle(
    view,
    () => /^([ \t]*[-*+] )(?! *\[[ xX]\]) */,
    (_, suggested) => suggested ?? '-',
  )
}

export function toggleOrderedList(view: EditorView): void {
  toggleListStyle(
    view,
    (index) => new RegExp(`^([ \t]*${index + 1}\\. )`),
    (index) => `${index + 1}.`,
  )
}

export function toggleTaskList(view: EditorView): void {
  toggleListStyle(
    view,
    () => /^([ \t]*[-*+] +\[[ xX]\] +)/,
    () => '- [ ]',
    (line) => {
      if (!/[-*+] +\[ \]/.test(line)) {
        return undefined
      }
      return line.replace(/([-*+] +\[) (\].*)/, '$1x$2')
    },
  )
}
