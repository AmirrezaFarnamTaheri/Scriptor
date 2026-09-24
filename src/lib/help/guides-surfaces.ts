import type { HelpGuide } from './types.ts'

/**
 * Granular guides for small but consequential widgets, banners, confirmation
 * surfaces, and docks. These entries keep contextual F1 useful even when the
 * surrounding panel has a broader workflow guide.
 */
export const surfaceGuides: readonly HelpGuide[] = [
  {
    id: 'layout-presets', title: 'Workspace layout presets', category: 'Workspace', policy: 'manual',
    entry: 'Settings → Workspace → Layout templates.', prerequisite: 'Open Settings. Presets affect presentation, not note contents.',
    safety: 'Applying a preset changes visible workspace layout settings. It does not edit Markdown, publish, delete, or enable external services.',
    source: 'src/components/LayoutPresetGallery.tsx', roots: ['.settings-layout-presets'],
    steps: [
      ['Read the preset summary', 'Compare the described split preview, sticky-note visibility, graph depth, and dock arrangement before applying a preset.'],
      ['Choose for the current job', 'Use a writing-focused layout for composition and a knowledge-focused layout when graph, inspector, or relationship tools matter.'],
      ['Apply once', 'Select the preset deliberately instead of repeatedly toggling individual layout controls while evaluating the result.'],
      ['Refine afterward', 'Treat a preset as a starting point. Adjust individual workspace controls after the layout is applied if your current task needs a different balance.'],
    ],
    questions: [
      ['Does a layout preset change my note?', 'No. It changes workspace presentation settings, not Markdown content.'],
      ['Can I customize after applying one?', 'Yes. Presets initialize a useful arrangement; the individual workspace controls remain available.'],
    ],
    related: ['docks', 'workspace', 'inspector'],
  },
  {
    id: 'preview-quality', title: 'Preview quality bar', category: 'Writing', policy: 'manual',
    entry: 'Preview inspector quality/status bar while a rendered note is open.', prerequisite: 'Open a note with Preview or Inspector visible.',
    safety: 'The bar reports render/export readiness. Reading it does not modify the note or start an export.',
    source: 'src/components/inspector/PreviewQABar.tsx', roots: ['.preview-qa-bar'],
    steps: [
      ['Read render state', 'Confirm whether Markdown rendering completed normally before treating the visible preview as representative of the source.'],
      ['Check diagnostics', 'Use warning and error counts to distinguish a clean preview from one with broken diagrams, metadata, references, or unsupported constructs.'],
      ['Compare source and preview', 'When output looks wrong, inspect the exact source block first instead of assuming the preview renderer silently repaired it.'],
      ['Verify before export', 'Resolve material preview problems before publishing or exporting because downstream renderers may expose the same or stricter failures.'],
    ],
    questions: [
      ['Does Ready to export guarantee the final file is correct?', 'No. It means the preview checks are clear; inspect the exported artifact as a separate verification step.'],
      ['Why can preview and export differ?', 'They may use different renderers, fonts, external tools, or pagination rules.'],
    ],
    related: ['preview', 'export', 'problems'],
  },
  {
    id: 'external-changes', title: 'External file changes', category: 'Recovery', policy: 'manual',
    entry: 'The banner shown when an open note changes on disk outside Scriptor.', prerequisite: 'An open note must have a detected external modification.',
    safety: 'Reloading can replace the editor buffer. Keeping edits can overwrite an external change later, so compare intentionally before saving.',
    source: 'src/components/ExternalChangeBanner.tsx', roots: ['.external-change-banner'],
    steps: [
      ['Stop editing briefly', 'Avoid adding more changes until you decide which copy should remain authoritative.'],
      ['Identify the external source', 'Determine whether another editor, sync tool, Git operation, or filesystem process changed the note.'],
      ['Choose reload or keep editing', 'Reload when the disk version is authoritative; keep editing only when you intend to reconcile or overwrite it deliberately.'],
      ['Verify after resolution', 'Reopen or compare the note after the choice and confirm that the expected content remains before continuing broader edits.'],
    ],
    questions: [
      ['Will Scriptor merge both copies automatically?', 'Not from this banner. Use an explicit conflict or comparison workflow when both versions contain valuable edits.'],
      ['Why did this appear without me saving?', 'The watcher detected a filesystem change made outside the current editor session.'],
    ],
    related: ['recovery', 'conflicts', 'history'],
  },
  {
    id: 'external-links', title: 'External link confirmation', category: 'Recovery', policy: 'manual',
    entry: 'Confirmation shown before opening an external URL or deep link.', prerequisite: 'A link is requesting another application, browser, or external protocol.',
    safety: 'Opening an external target leaves Scriptor and may expose data to another application or website. Review the exact destination first.',
    source: 'src/components/ExternalDeepLinkDialog.tsx', roots: ['.external-deep-link-dialog'],
    steps: [
      ['Read the destination', 'Check the complete host, scheme, and path rather than relying only on link text from the note or plugin.'],
      ['Check why it opened', 'Confirm that the request matches the action you just invoked and did not originate from unexpected rendered content.'],
      ['Approve or cancel', 'Continue only when the destination and external application are expected; otherwise cancel without side effects.'],
      ['Report suspicious links', 'If a trusted note or plugin generated an unexpected target, preserve the source context and inspect it before retrying.'],
    ],
    questions: [
      ['Does cancelling modify my note?', 'No. It only declines the external navigation request.'],
      ['Why is confirmation required for a normal browser link?', 'The boundary makes leaving the local workspace explicit and prevents rendered content from silently opening external destinations.'],
    ],
    related: ['permissions', 'reader', 'plugins'],
  },
  {
    id: 'link-rewrite', title: 'Link rewrite preview', category: 'Knowledge', policy: 'manual',
    entry: 'Link rewrite dialog opened by rename/refactor workflows.', prerequisite: 'A rename or refactor has discovered Markdown links that may need rewriting.',
    safety: 'Applying a rewrite edits note content across the reported scope. Always inspect the dry-run preview before applying.',
    source: 'src/components/LinkRewriteDialog.tsx', roots: ['.rename-dialog'],
    steps: [
      ['Review affected notes', 'Inspect the count and paths so the rewrite scope matches the rename or refactor you intended.'],
      ['Run the dry preview', 'Use the preview to verify old and new link targets before any Markdown files are changed.'],
      ['Check ambiguous links', 'Pay special attention to aliases, headings, block references, relative paths, and duplicate note names.'],
      ['Apply and verify', 'Apply only after the preview is correct, then open representative backlinks and targets to confirm navigation still resolves.'],
    ],
    questions: [
      ['Can I skip the dry run?', 'The UI may permit direct application in some paths, but reviewing the preview is the safer workflow for multi-note changes.'],
      ['Does rewriting rename files too?', 'The dialog rewrites references for its owning operation; the file rename is a separate part of that workflow.'],
    ],
    related: ['rename', 'backlinks', 'recovery'],
  },
  {
    id: 'performance', title: 'Performance HUD', category: 'Workspace', policy: 'manual',
    entry: 'Enable the performance HUD from diagnostics/advanced workspace controls.', prerequisite: 'The HUD is useful when diagnosing interaction or rendering cost, not as permanent writing chrome.',
    safety: 'The HUD reads local performance measurements. It does not optimize or hibernate subsystems by itself.',
    source: 'src/components/PerfHudOverlay.tsx', roots: ['.perf-hud-overlay'],
    steps: [
      ['Establish a baseline', 'Observe the workspace before reproducing the slow interaction so you know what normal values look like.'],
      ['Reproduce one action', 'Trigger a single editor, graph, canvas, or navigation action and watch the corresponding metric change.'],
      ['Correlate with the owning subsystem', 'Use the metric as a clue, then inspect the relevant feature rather than assuming the highest number is the root cause.'],
      ['Disable after diagnosis', 'Turn the HUD off when finished so diagnostic chrome does not compete with the writing workspace.'],
    ],
    questions: [
      ['Does a high instantaneous value prove a bug?', 'No. Look for repeatable regressions and correlate them with a specific user-visible delay.'],
      ['Does the HUD send telemetry?', 'This guide covers the local workspace HUD; review telemetry settings separately for any external reporting policy.'],
    ],
    related: ['hibernation', 'quality', 'diagnostics'],
  },
  {
    id: 'subsystems', title: 'Subsystem hibernation controls', category: 'Workspace', policy: 'manual',
    entry: 'Workspace subsystem hibernation controls.', prerequisite: 'Use these controls when reducing background work or diagnosing a heavy subsystem.',
    safety: 'Hibernating a subsystem can temporarily remove live features or stale their views. It should not change authoritative Markdown by itself.',
    source: 'src/components/shell/SubsystemToggles.tsx', roots: ['.subsystem-toggles'],
    steps: [
      ['Identify the heavy subsystem', 'Prefer evidence from the status, diagnostics, or performance HUD before disabling unrelated features.'],
      ['Hibernate one at a time', 'Change one subsystem so you can tell whether it affected responsiveness or resource use.'],
      ['Observe degraded behavior', 'Confirm which panels stop updating and whether the workspace communicates that the subsystem is asleep.'],
      ['Wake and verify', 'Re-enable the subsystem and confirm its data refreshes before relying on it for search, graph, preview, or other derived views.'],
    ],
    questions: [
      ['Will hibernation delete index data?', 'It is intended as a runtime resource control, not a deletion command; use explicit rebuild/cleanup actions for persistent data.'],
      ['Why is a panel stale after wake?', 'The subsystem may still be refreshing. Check its status and retry only after the owning service reports ready.'],
    ],
    related: ['hibernation', 'performance', 'status'],
  },
  {
    id: 'status-dock', title: 'Status dock and operational tabs', category: 'Workspace', policy: 'manual',
    entry: 'Bottom status dock: Problems, Output, and Jobs.', prerequisite: 'Open a vault for workspace-specific operational status.',
    safety: 'The dock reports diagnostics and background work. Opening a tab does not retry, cancel, or mutate a job unless you invoke an explicit action inside it.',
    source: 'src/components/StatusDockPanel.tsx', roots: ['.bottom-tabs', '#dock-panel-problems', '#dock-panel-output', '#dock-panel-search', '#dock-panel-jobs'],
    steps: [
      ['Start from the summary', 'Use the status footer and dock badges to decide whether Problems, Output, or Jobs contains the evidence you need.'],
      ['Open the matching tab', 'Problems is for actionable diagnostics, Output for operation messages, and Jobs for long-running export or background work.'],
      ['Trace one operation', 'Keep the initiating action and its dock result together instead of treating unrelated warnings as the cause.'],
      ['Close when resolved', 'Collapse the dock after the issue is understood so operational chrome does not permanently reduce writing space.'],
    ],
    questions: [
      ['Why are the three tabs separate?', 'They represent different evidence types: diagnostics, textual operation output, and tracked background jobs.'],
      ['Does clearing a view fix the underlying problem?', 'No. Clear/reset actions affect presentation or records; repair the owning feature separately.'],
    ],
    related: ['problems', 'activity-output', 'export-jobs'],
  },
  {
    id: 'references-preview', title: 'References preview', category: 'Knowledge', policy: 'manual',
    entry: 'Inspector/reference preview for citations in the active note.', prerequisite: 'The note must contain citation keys and the bibliography/index must be available.',
    safety: 'Previewing formatted citations is read-only. Editing bibliography data or source citation keys is a separate operation.',
    source: 'src/components/ReferencesPreviewPanel.tsx', roots: ['.references-preview-panel'],
    steps: [
      ['Check detected keys', 'Confirm that the citation keys shown are the ones actually present in the note source.'],
      ['Inspect formatting mode', 'Verify whether citeproc or the fallback formatter is active before comparing output with a publication target.'],
      ['Resolve missing references', 'Open bibliography tools when a key has no matching entry rather than manually copying rendered text into the note.'],
      ['Verify before publish', 'Compare inline citations and bibliography output in the final export because target styles and processors can differ.'],
    ],
    questions: [
      ['Why does a key render differently here and in export?', 'The final export may use a different CSL style, processor, or publication configuration.'],
      ['Should I edit the rendered preview?', 'No. Edit the note citation key or bibliography source that owns the reference.'],
    ],
    related: ['citations', 'bibliography', 'publish'],
  },
  {
    id: 'panel-recovery', title: 'Panel error recovery', category: 'Recovery', policy: 'manual',
    entry: 'Error fallback shown when an application panel cannot render or initialize.', prerequisite: 'A panel-level failure must have been caught by the application error boundary.',
    safety: 'Retrying recreates the affected view. It should not be used repeatedly to hide a persistent data, permission, or integration failure.',
    source: 'src/components/PanelErrorFallback.tsx', roots: ['[data-help-topic="panel-recovery"]'],
    steps: [
      ['Read the affected panel name', 'Identify which feature failed so recovery stays scoped instead of restarting unrelated workspace state.'],
      ['Preserve useful context', 'Record the visible error and the action that preceded it before retrying, especially for repeatable failures.'],
      ['Retry once', 'Use Retry when offered after the underlying condition may have cleared; dismiss if you need to protect the rest of the workspace.'],
      ['Escalate persistent failures', 'If the same panel fails again, use diagnostics/support with version and reproduction details rather than looping retries.'],
    ],
    questions: [
      ['Did the panel error corrupt my note?', 'The fallback itself does not establish corruption. Verify the authoritative Markdown and any pending save state separately.'],
      ['Should I reload the whole app immediately?', 'Prefer the scoped panel recovery first unless the application itself is no longer responsive.'],
    ],
    related: ['recovery', 'diagnostics', 'support'],
  },
  {
    id: 'mutation-confirmation', title: 'Mutation confirmation', category: 'Recovery', policy: 'manual',
    entry: 'Confirmation block shown before a bounded state-changing operation.', prerequisite: 'A feature has prepared a mutation that requires explicit confirmation.',
    safety: 'Confirm executes the described mutation. Review scope, targets, and consequences; cancel leaves the proposed operation unapplied.',
    source: 'src/components/chrome/MutationConfirmation.tsx', roots: ['.mutation-confirmation'],
    steps: [
      ['Read the operation verb', 'Distinguish create, overwrite, delete, move, publish, send, or permission changes before confirming.'],
      ['Verify scope', 'Check the named file, account, count, destination, or resource so the action matches your intent.'],
      ['Review irreversible effects', 'Look for overwrite, external-send, deletion, or permission consequences that may not have an application-level undo.'],
      ['Confirm or cancel', 'Proceed only when the displayed scope is correct; otherwise cancel and correct the originating settings or selection.'],
    ],
    questions: [
      ['Why am I seeing confirmation for a familiar action?', 'The operation crosses a state-changing boundary that the product keeps explicit.'],
      ['Does Cancel lose my draft?', 'The confirmation should cancel the proposed mutation, not unrelated editor content; verify the owning workflow if it has its own draft state.'],
    ],
    related: ['permissions', 'recovery', 'history'],
  },
  {
    id: 'knowledge-discover', title: 'Knowledge discovery hub', category: 'Knowledge', policy: 'manual',
    entry: 'Knowledge Workbench → Discover.', prerequisite: 'Open a vault; opening a note gives Graph a useful focus target.',
    safety: 'Discover is a navigation hub. Its buttons open other knowledge tools; it does not repair links or mutate notes by itself.',
    source: 'src/components/KnowledgeWorkbench.tsx', roots: ['.knowledge-discover-pane'],
    steps: [
      ['Choose the investigation path', 'Open Graph for relationships, Repair for unresolved structure, Collections for derived groups, or Tags for taxonomy work.'],
      ['Use the active note as context', 'When a note is active, Graph can start from that document. Confirm the path before interpreting relationships.'],
      ['Move to the owning tool', 'Discover does not duplicate each feature. Use the destination panel for filtering, mutation, permissions, and detailed diagnostics.'],
      ['Return without losing scope', 'Reopen Discover when you need to change investigation mode; closing the Workbench does not modify the vault.'],
    ],
    questions: [
      ['Why is there no graph here?', 'Discover is the launch surface; the full graph owns rendering, filters, navigation, and graph-specific recovery.'],
      ['Does opening Repair fix anything automatically?', 'No. The repair queue remains review-driven and source mutations require explicit actions.'],
    ],
    related: ['workbench', 'graph', 'knowledge-repair', 'collections', 'tags'],
  },
  {
    id: 'gmail-messages', title: 'Gmail message search and reading', category: 'Integrations', policy: 'manual', experimental: true,
    entry: 'Gmail Manager → Messages.', prerequisite: 'Enabled Gmail capability, authenticated account, native desktop support, and network access.',
    safety: 'Reading/searching is bounded provider access. Archive, Trash, and Import are separate state-changing actions that require deliberate selection.',
    source: 'src/components/GmailManagerPanel.tsx', roots: ['.gmail-manager-tab--messages'],
    steps: [
      ['Search deliberately', 'Use Gmail search syntax or the default inbox scope. A bounded result list is not a complete mailbox export.'],
      ['Open the intended message', 'Check sender, date, subject, and snippet before loading or acting on message content.'],
      ['Separate local and remote actions', 'Import writes a Markdown copy to the vault; Archive and Trash change Gmail. They do not perform the same operation.'],
      ['Refresh after a mutation', 'Confirm the provider state after archive/trash and the vault note after import instead of assuming the visible row alone proves success.'],
    ],
    questions: [
      ['Why are not all messages visible?', 'The manager intentionally uses bounded provider queries. Refine the Gmail search rather than treating the current list as the whole mailbox.'],
      ['Does Import keep syncing with Gmail?', 'No. It creates a local Markdown copy; it is not a live two-way mailbox mirror.'],
    ],
    related: ['gmail', 'gmail-account', 'gmail-compose', 'vault'],
  },
  {
    id: 'gmail-compose', title: 'Gmail compose and send', category: 'Integrations', policy: 'manual', experimental: true,
    entry: 'Gmail Manager → Compose.', prerequisite: 'Connected Gmail account and a reviewed recipient, subject, and message body.',
    safety: 'Send transmits external mail. Review the recipient and content before sending; Help never presses Send or supplies authority.',
    source: 'src/components/GmailManagerPanel.tsx', roots: ['.gmail-manager-compose'],
    steps: [
      ['Confirm the account', 'Verify the connected Google identity before drafting mail so the message leaves the intended account.'],
      ['Review the recipient', 'Check the full destination address, especially after copy/paste or when multiple similar contacts exist.'],
      ['Review subject and body', 'The shipped composer is intentionally bounded and plain-text oriented; confirm formatting and missing attachment expectations before send.'],
      ['Send once and verify', 'Wait for the result before retrying. A timeout or provider error is not evidence that the message was never accepted.'],
    ],
    questions: [
      ['Can I attach files here?', 'The current experimental composer does not represent a full Gmail client; use the supported fields shown in the surface.'],
      ['Should I retry immediately after a timeout?', 'First check the returned state and provider outcome where possible to avoid duplicate sends.'],
    ],
    related: ['gmail', 'gmail-account', 'permissions'],
  },
  {
    id: 'gmail-account', title: 'Gmail account connection', category: 'Integrations', policy: 'manual', experimental: true,
    entry: 'Gmail Manager → Account.', prerequisite: 'Enabled Gmail capability, desktop app, network access, and a valid Google Desktop-app OAuth client ID.',
    safety: 'Connecting opens Google consent and stores tokens in the OS keychain. Disconnect affects credentials but does not delete imported Markdown notes.',
    source: 'src/components/GmailManagerPanel.tsx', roots: ['.gmail-manager-account'],
    steps: [
      ['Check capability first', 'If Gmail routes to Plugins, enable and review the Gmail capability before troubleshooting OAuth.'],
      ['Use the correct client ID', 'Use the configured Desktop-app OAuth client ID. A web-app redirect credential follows a different browser flow.'],
      ['Approve the intended account', 'Read Google consent and scopes before completing the browser flow, then return to Scriptor for connection status.'],
      ['Disconnect and verify', 'Use Disconnect when needed and treat cleanup/keychain failures as unresolved instead of assuming credentials were removed.'],
    ],
    questions: [
      ['Why does connection fail before Google opens?', 'Capability or native authorization can fail before browser consent. Read the exact local error first.'],
      ['Does disconnect remove imported mail notes?', 'No. Imported Markdown is local vault content and has a separate lifecycle.'],
    ],
    related: ['gmail', 'google', 'plugins', 'permissions'],
  },
  {
    id: 'vault-config', title: 'Vault workflow configuration', category: 'Workspace', policy: 'manual',
    entry: 'Settings → General → Vault configuration.', prerequisite: 'Open the vault whose defaults and workflow rules you intend to change.',
    safety: 'These settings can change where new notes are created, automatic export behavior, graph grouping, and collaboration metadata. Review generated previews and save deliberately.',
    source: 'src/components/VaultConfigSettingsSection.tsx', roots: ['[data-help-topic="vault-config"]'],
    steps: [
      ['Confirm the vault scope', 'Check the active vault before editing directories, templates, inbox rules, writing targets, graph groups, or scan roots because the configuration is vault-specific.'],
      ['Preview path-producing settings', 'Use the daily-note preview and inspect template, note-type, bibliography, and history paths before saving so relative paths land where you expect.'],
      ['Separate workflow from external effects', 'Inbox, export-on-save, graph grouping, Canvas collaboration, and extra scan roots control different subsystems. Change only the owner needed for the current job.'],
      ['Save and verify the affected workflow', 'Persist the vault configuration, then exercise the specific feature you changed. A saved form is not proof that a template, export, scan root, or collaboration path works.'],
    ],
    questions: [
      ['Are these application-wide preferences?', 'No. This section primarily edits the active vault configuration; appearance, shortcuts, and other application preferences have separate owners.'],
      ['Can a bad path delete existing notes?', 'Ordinary configuration should not be treated as deletion, but path changes can redirect future files or derived outputs. Preserve backups and verify destinations before relying on automation.'],
    ],
    related: ['settings', 'daily', 'templates', 'writing-targets', 'export', 'graph', 'canvas'],
  },
  {
    id: 'rename-block', title: 'Rename a block anchor', category: 'Knowledge', policy: 'manual',
    entry: 'Block-anchor rename dialog opened from a note reference/refactor workflow.', prerequisite: 'An existing block anchor and the note that owns it.',
    safety: 'Applying can edit the source anchor and references across multiple notes. Review the dry run before changing a widely referenced anchor.',
    source: 'src/components/RenameBlockDialog.tsx', roots: ['[data-help-topic="rename-block"]'],
    steps: [
      ['Confirm the owning note and anchor', 'Read the note path and existing block id before typing a replacement so similarly named anchors in other notes are not confused.'],
      ['Choose a stable new anchor', 'Use a concise identifier that fits the note and avoids collisions with another block anchor in the same destination.'],
      ['Review reference rewriting', 'Keep the update-references option enabled when backlinks should follow the rename, then run the dry preview and inspect every affected file.'],
      ['Apply and verify navigation', 'Apply only when the preview is correct, then open representative block links and backlinks to confirm they resolve to the renamed anchor.'],
    ],
    questions: [
      ['What happens if I turn off reference updates?', 'The anchor can change while existing wikilinks keep the old target, leaving unresolved references that you must repair separately.'],
      ['Does the dry run modify Markdown?', 'No. It calculates the proposed rewrite scope; the separate Apply action performs the mutation.'],
    ],
    related: ['link-rewrite', 'backlinks', 'outgoing', 'recovery'],
  },
  {
    id: 'rename-section', title: 'Rename a section and its references', category: 'Knowledge', policy: 'manual',
    entry: 'Section rename dialog opened from an outline/link refactor workflow.', prerequisite: 'An existing heading in the intended note.',
    safety: 'Applying can change heading text and references across the vault. A heading rename can affect links, outlines, and generated navigation.',
    source: 'src/components/RenameSectionDialog.tsx', roots: ['[data-help-topic="rename-section"]'],
    steps: [
      ['Confirm the source heading', 'Check the note path and current section label before editing; repeated heading text in different notes does not identify the same target.'],
      ['Choose whether to change the heading', 'Keep Update heading enabled when the visible source heading should change together with backlinks; disable it only when you understand the resulting reference model.'],
      ['Inspect the dry-run scope', 'Review affected files and warnings, especially duplicate headings, aliases, encoded fragments, and links from notes outside the immediate folder.'],
      ['Apply and test representative links', 'After applying, open the renamed heading from the outline and from at least one incoming reference to verify the fragment resolves correctly.'],
    ],
    questions: [
      ['Can I rename only the references and keep the heading text?', 'The dialog exposes whether the source heading is updated. Review the dry-run result because reference-only changes can be surprising.'],
      ['Why can a section rename touch several files?', 'Heading links can originate anywhere in the vault, so maintaining navigation may require rewriting every matching reference.'],
    ],
    related: ['link-rewrite', 'outline', 'backlinks', 'outgoing'],
  },
  {
    id: 'rename-tag', title: 'Rename a tag hierarchy', category: 'Knowledge', policy: 'manual',
    entry: 'Tag rename dialog from the tag browser or knowledge refactor workflow.', prerequisite: 'An existing tag in the active vault.',
    safety: 'Applying rewrites matching tags in note content and also includes hierarchical children. Review scope before renaming a broad parent tag.',
    source: 'src/components/RenameTagDialog.tsx', roots: ['[data-help-topic="rename-tag"]'],
    steps: [
      ['Confirm the parent tag', 'Read the current tag and estimate how many notes and child tags depend on it before choosing a new name.'],
      ['Choose the replacement', 'Enter the canonical tag without relying on visual case or punctuation differences to distinguish unrelated concepts.'],
      ['Inspect hierarchical impact', 'Run the dry preview and check child tags such as parent/child because they are renamed together with the parent namespace.'],
      ['Apply and verify taxonomy', 'After applying, browse tags, search representative notes, and inspect any automation or saved views that depend on the renamed taxonomy.'],
    ],
    questions: [
      ['Will child tags be renamed too?', 'Yes. Hierarchical children under the renamed parent are included, which is why the dry-run scope matters.'],
      ['Do saved views automatically understand the new tag?', 'Not necessarily. Review saved queries, collections, templates, or automation rules that contain the old tag text.'],
    ],
    related: ['tags', 'link-rewrite', 'saved-views', 'collections'],
  },

  {
    id: 'workspace-modes', title: 'Workspace modes', category: 'Workspace', policy: 'manual',
    entry: 'Mode selector in the top bar: Writing, Knowledge, Publish, Review, or Automation.', prerequisite: 'Use a mode to emphasize the tools for the job you are doing; modes do not convert the underlying Markdown.',
    safety: 'Changing mode rearranges and emphasizes workspace surfaces. It does not publish, run automation, enable a capability, or rewrite notes by itself.',
    source: 'src/components/shell/AppTopBar.tsx', roots: ['.workspace-mode-strip'],
    steps: [
      ['Choose the job, not a feature flag', 'Writing prioritizes composition, Knowledge relationship tools, Publish export/publishing, Review quality surfaces, and Automation MCP/operational tools. Pick the job that matches your current intent.'],
      ['Notice layout emphasis', 'A mode can change which panels or actions are prominent without changing the authoritative note content or granting additional permissions.'],
      ['Open the owning feature', 'Use the mode-specific action or command palette to enter Workbench, Publish Center, health/review, or MCP. The mode itself is not the operation.'],
      ['Return without losing content', 'Switch modes whenever your job changes. Verify save state independently because presentation mode and document persistence are separate concerns.'],
    ],
    questions: [
      ['Does Automation mode automatically run tools?', 'No. It makes automation surfaces easier to reach; MCP modes, permissions, drafts, and mutations retain their own explicit controls.'],
      ['Why did the layout change when I selected a mode?', 'Modes are workspace presets for different jobs. Your Markdown remains the same; use layout settings when you want a persistent custom arrangement.'],
    ],
    related: ['workspace', 'docks', 'workbench', 'export', 'diagnostics', 'mcp'],
  },
  {
    id: 'topbar-customize', title: 'Customize top-bar actions', category: 'Workspace', policy: 'manual',
    entry: 'Sliders control at the right side of the top bar, or the top-bar context menu.', prerequisite: 'No vault or external service is required to change chrome visibility.',
    safety: 'Customization only hides or restores shortcuts in the top bar. It does not disable the underlying feature, revoke permissions, or delete its data.',
    source: 'src/components/shell/AppTopBar.tsx', roots: ['.topbar-customize'],
    steps: [
      ['Keep the writing path clear', 'Leave frequent navigation and writing actions visible; hide secondary launchers that compete for horizontal space.'],
      ['Understand hidden versus disabled', 'Unchecked actions disappear from the top bar but remain available through their canonical panel, settings, or command palette where supported.'],
      ['Test constrained widths', 'After changing the set, resize the window or use a split workspace to make sure the remaining controls stay understandable without crowding.'],
      ['Restore defaults when needed', 'Use Restore defaults to return to the product baseline instead of manually guessing which actions originally belonged in persistent chrome.'],
    ],
    questions: [
      ['If I hide Git or MCP here, is the feature turned off?', 'No. Top-bar visibility is presentation only; capability state and runtime configuration are controlled elsewhere.'],
      ['Why is Support hidden by default?', 'The default chrome prioritizes recurring writing and navigation work. Lower-frequency destinations remain discoverable without permanently occupying the writing header.'],
    ],
    related: ['workspace-chrome', 'commands', 'workspace', 'shortcuts'],
  },
  {
    id: 'mobile-navigation', title: 'Mobile and narrow-workspace navigation', category: 'Workspace', policy: 'manual',
    entry: 'Bottom navigation shown on narrow/mobile layouts.', prerequisite: 'Use a narrow window or supported mobile-sized workspace where the desktop three-column layout is collapsed.',
    safety: 'Switching panes changes what is visible, not the note, vault, or capability state. Mode-specific buttons still open their normal reviewed workflows.',
    source: 'src/components/shell/MobileWorkspaceNav.tsx', roots: ['.mobile-workspace-chrome'],
    steps: [
      ['Choose the active pane', 'Vault shows files, Write shows the editor, Lens shows inspector context, and Command opens the command palette without forcing all desktop columns on screen.'],
      ['Use the mode action', 'Knowledge, Publish, Review, and Automation can expose one contextual launch action above the navigation. It opens the same owning feature used on desktop.'],
      ['Return to writing quickly', 'Select Write after navigation or inspection when you want the editor to reclaim the available viewport.'],
      ['Treat hidden panes as present state', 'Moving between panes does not imply a feature closed, a note saved, or an operation finished. Check the owning status before assuming work is complete.'],
    ],
    questions: [
      ['Why can I not see Vault and Inspector at the same time?', 'Narrow layouts intentionally use one primary pane to preserve usable editor width. Wider layouts restore simultaneous regions.'],
      ['Does the Command item change workspace mode?', 'No. It opens command search; workspace mode and mobile pane selection are independent concepts.'],
    ],
    related: ['workspace', 'workspace-modes', 'commands', 'inspector'],
  },
  {
    id: 'typography', title: 'Typography cleanup and text transforms', category: 'Writing', policy: 'manual',
    entry: 'Typography menu in the editor toolbar.', prerequisite: 'Open an editable Markdown note and place the caret or select the text you intend to transform.',
    safety: 'Typography commands edit Markdown text. Review the selection and use undo immediately when a cleanup or quote/case conversion affects more text than intended.',
    source: 'src/components/TypographyMenu.tsx', roots: ['.typography-menu'],
    steps: [
      ['Select the intended scope', 'Select text when the transform should be local. With no selection, understand the editor action scope before running cleanup on a larger block.'],
      ['Choose one transformation', 'Whitespace cleanup, quote conversion, dash spacing, title/sentence case, and quote/italic conversions solve different editorial problems; do not stack them blindly.'],
      ['Inspect Markdown-sensitive text', 'Check links, code spans, frontmatter, citations, and deliberate spacing after a broad cleanup because prose normalization can be inappropriate inside structured syntax.'],
      ['Undo or continue deliberately', 'Compare the result in Source and Preview. Undo unexpected changes before running another transformation so the original boundary remains recoverable.'],
    ],
    questions: [
      ['Why did quote conversion change punctuation I wanted to keep?', 'Typography commands apply deterministic text transforms; select a narrower range or undo and edit exceptional punctuation manually.'],
      ['Should I run cleanup on code or frontmatter?', 'Avoid broad prose transformations over structured syntax unless the specific command documents that syntax as supported.'],
    ],
    related: ['toolbar', 'editor', 'preview', 'frontmatter'],
  },
  {
    id: 'insert', title: 'Insert Markdown structures', category: 'Writing', policy: 'manual',
    entry: 'Insert menu in the editor toolbar.', prerequisite: 'Open an editable note and place the caret where the new Markdown block or inline structure belongs.',
    safety: 'Insert commands modify the active note. Block snippets need valid surrounding blank lines and some inserted structures require later configuration or external renderers.',
    source: 'src/components/InsertMenu.tsx', roots: ['.insert-menu'],
    steps: [
      ['Place the caret first', 'Choose the exact insertion point before opening the menu. For block structures, prefer an empty line so the new Markdown does not concatenate with adjacent prose.'],
      ['Choose the structure', 'Tables, diagrams, math, callouts, horizontal rules, and other inserts create source templates; they are not finished content until you replace placeholders and validate syntax.'],
      ['Complete required fields', 'Edit placeholder labels, diagram nodes, formulas, table cells, or callout text immediately so template markers do not remain in the document.'],
      ['Verify source and rendering', 'Inspect the inserted Markdown in Source and its output in Preview. Fix block boundaries or renderer prerequisites rather than repeatedly inserting a second copy.'],
    ],
    questions: [
      ['Why did an inserted block render as literal text?', 'The caret may have been adjacent to another block or the inserted syntax may be incomplete. Check blank lines and the exact source before inserting again.'],
      ['Does inserting a diagram execute external code?', 'Insertion only writes Markdown/fenced source. Rendering or code execution has separate capability and safety boundaries.'],
    ],
    related: ['toolbar', 'editor', 'preview', 'code-chunks'],
  },

]
