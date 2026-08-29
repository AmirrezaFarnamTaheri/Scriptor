interface SubsystemTogglesProps {
  graph: boolean
  onGraphChange: (enabled: boolean) => void
  mcp: boolean
  onMcpChange: (enabled: boolean) => void
  watcher: boolean
  onWatcherChange: (enabled: boolean) => void
  git: boolean
  onGitChange: (enabled: boolean) => void
  spellcheck: boolean
  onSpellcheckChange: (enabled: boolean) => void
}

export function SubsystemToggles({
  graph,
  onGraphChange,
  mcp,
  onMcpChange,
  watcher,
  onWatcherChange,
  git,
  onGitChange,
  spellcheck,
  onSpellcheckChange,
}: SubsystemTogglesProps) {
  const subsystems = [
    { label: 'Graph', title: 'Graph simulation', hibernated: graph, onChange: onGraphChange },
    { label: 'MCP', title: 'MCP', hibernated: mcp, onChange: onMcpChange },
    { label: 'Watch', title: 'Watcher', hibernated: watcher, onChange: onWatcherChange },
    { label: 'Git', title: 'Git polling', hibernated: git, onChange: onGitChange },
    { label: 'Spell', title: 'Spellcheck', hibernated: spellcheck, onChange: onSpellcheckChange },
  ]

  return (
    <div className="subsystem-toggles" aria-label="Subsystem hibernation">
      {subsystems.map(({ label, title, hibernated, onChange }) => (
        <button
          key={label}
          type="button"
          className={`subsystem-toggle-badge ${hibernated ? 'hibernated' : 'active'}`}
          onClick={() => onChange(!hibernated)}
          aria-pressed={hibernated}
          title={`${title}: ${hibernated ? 'Hibernated' : 'Active'} (click to toggle)`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
