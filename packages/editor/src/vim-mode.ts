import { Compartment, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { vim, Vim } from '@replit/codemirror-vim'

export interface VimModeCallbacks {
  onSave?: () => void | Promise<void>
  onQuit?: () => void | Promise<void>
}

let callbacks: VimModeCallbacks = {}

export function setVimModeCallbacks(next: VimModeCallbacks): void {
  callbacks = next
}

function registerExCommands(): void {
  Vim.defineEx('write', 'w', () => {
    void callbacks.onSave?.()
    return true
  })
  Vim.defineEx('quit', 'q', () => {
    void callbacks.onQuit?.()
    return true
  })
  Vim.defineEx('wq', 'wq', () => {
    void callbacks.onSave?.()
    void callbacks.onQuit?.()
    return true
  })
}

let exRegistered = false

export function vimModeExtension(): Extension {
  if (!exRegistered) {
    registerExCommands()
    exRegistered = true
  }
  return [
    vim(),
    EditorView.domEventHandlers({
      focus: () => {
        document.documentElement.dataset.scriptorVim = 'true'
      },
      blur: () => {
        delete document.documentElement.dataset.scriptorVim
      },
    }),
  ]
}

export const vimModeCompartment = new Compartment()

export function setVimModeEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: vimModeCompartment.reconfigure(enabled ? vimModeExtension() : []),
  })
}
