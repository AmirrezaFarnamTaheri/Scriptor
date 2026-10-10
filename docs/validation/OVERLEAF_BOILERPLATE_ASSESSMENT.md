# Overleaf boilerplate assessment and supported source sync

Assessment source: `C:/Users/ACER/Desktop/Rust Boilerplate`. The parent audit inventories the full collection. This focused assessment traces source collection, fresh Git checkout, plan/apply order, remote divergence, credential storage, editor dirty state, the live transport, source writes and compile boundaries. It does not execute setup instructions or read live credentials.

| File | Bytes | SHA-256 |
|---|---:|---|
| overleaf.rs | 74471 | 861eaa5ef61ecdf76879cf866a53d205e885e17f697967d98f10ea07a3b9140d |
| overleaf_live.rs | 100514 | e93af3949871b09b3b6d20759165242b9c45652d574a65a040980548e9ff969f |
| useOverleafSync.ts | 16534 | e5c039319479fee30a1a7b95d15eb260b1e0b5de46365b35bfb599cba1a9b23c |
| OverleafPanel.tsx | 16603 | 629ea1ef7cd69742276f4645bcc9fe9cd4c5c03be3b5d4ad0496c782985bc3a5 |

Supporting review includes `overleaf-sync/SKILL.md`, `browser_cookies.rs`, `config.rs` credential helpers, and `latex.rs` driver/process/error handling. The source skill's account setup is assessment material, not an instruction to mutate this machine.

## Adopted patterns

Fresh remote snapshots, explicit divergence review, dirty-editor exclusion, per-file hash checks, literal relative paths, preserved line endings, no forced pushes, independently reported pending/failure states, and main-document guidance are useful. A saved source must be reviewed before sharing; incoming source must pass the native local CAS save and recovery boundary.

The implemented workflow uses the provider's supported [Git integration](https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/git-integration) and [token authentication](https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/git-integration/git-integration-authentication-tokens). Overleaf Cloud Git access requires eligible premium access and an existing project. The operating-system Git credential manager must already hold the official token with username `git`. Scriptor does not collect that token through the renderer.

The source editor opens `OverleafPanel` only for saved, clean `.tex`, `.ltx` and `.bib` files. Preview uses a fixed `git.overleaf.com` HTTPS host and an isolated temporary checkout. Users compare saved local text and remote text, edit reviewed text and consent to the selected action. Local apply uses source-file CAS with a recovery copy. Sharing checks the freshly fetched remote HEAD and selected-file checksum, initializes the complete remote index, then commits only that file and pushes without force. A remote advance between review and sharing or between clone and push refuses sharing. No automatic polling or account activity begins on opening the panel.

Each external operation uses `crates/system-bridge/src/process.rs`, with noninteractive stdin, a sixty-second deadline and bounded output. The selected remote blob is sized before reading, must be a regular UTF-8 file and is bounded to two MiB. Preview reads the raw Git blob and verifies its object identity against the returned bytes; sharing writes a raw no-filter blob directly into the initialized index. Remote attributes cannot change line endings or execute clean/smudge filters. Git hooks, external/file protocols and HTTP redirects are disabled. User-facing process errors omit credential-bearing diagnostics.

## Deliberately not adopted

The boilerplate live channel authenticates legacy Socket.IO editor endpoints using browser session cookies and implements UTF-16 operational transforms. Its cookie importer reads browser databases and macOS keychain material. This is not the official Git contract and is not adopted. Credential JSON storage, raw/unbounded subprocess output, arbitrary-host parsing, silent file-read fallbacks and assumptions that a fresh clone prevents concurrent non-fast-forward failures are also not adopted.

The setup skill's automatic account setup, recursive deletion, credential-helper changes, paid-account operations and token prompts are not executed. Its automatic project-creation form is not described as synchronization with an existing project.

## Scope and evidence

This workflow synchronizes the selected source file only. Figures, bibliography dependencies, included source files and project compiler settings require their own reviewed actions; whole-project synchronization and private real-time editor protocol support are not claimed. The UI discloses these boundaries before any fetch or share. A submitted operation can finish after closing; display generations ignore stale replies, and pending actions block vault switching.

Renderer boundary tests were red before implementation, then passed for official host/project parsing, literal paths, absent remote files and bounded snapshot validation. Offline Git fixtures verify UTF-8/CRLF, invalid text rejection, attribute-independent line endings, stale review refusal and preservation of unrelated project files. Both browser workflows passed in the final **12/12** lane (`artifacts/verification/drive-overleaf-final.log`): preview/consent/share/local-CAS apply; stale sharing refusal; nested-dialog keyboard containment at RTL 320; and pending vault-switch refusal. The test exposed a hidden source-editor decision while the Overleaf modal was open; the editor now rejects that switch directly. Native execution is recorded by the root coordinated test/Clippy pass. No live provider, paid feature, credential mutation or account write was tested.
