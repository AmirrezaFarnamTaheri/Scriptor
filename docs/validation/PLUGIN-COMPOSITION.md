# Plugin workspace composition

The module manager lists built-in and registered manifest workspaces. Opening a
workspace requires a current registry contribution, enabled policy, reviewed
read permission, matching vault scope and safe mode disabled. It rechecks those
conditions on invocation; the shell independently resolves the contribution
again before navigation. Successful navigation closes the manager; refusal
preserves it. Opening does not grant consent or install a plugin.
Opening is serialized with a visible busy state. Refusal and failure retain the
manager and provide feedback. New controls and availability feedback are
localized in English, German and Persian.

Declarative workspace bodies expose a named group inside the shell landmark,
avoiding duplicate same-named regions. Long titles, metrics and action labels
wrap within narrow containers; interactive controls retain a 44-pixel minimum
target and semantic colors in both appearances. Visual proof belongs to the
coordinated appearance suite rather than a CSS-only claim.

Workspace contributions require the current host API version, declared workspace
capability and read permission, matching plugin identity, unique bounded IDs,
validated routes and matching command declarations. Collection can be scoped to
vault consent and safe mode. Existing native command authorization remains the
authority for effects.

The runtime landing now describes Python persistence and per-cell authorization
accurately. Other languages retain fresh-process behavior.
Its title is **Runtime workspace overview**, distinct from the executable
**Runtime console** command. IDs and consent scopes retain their existing
`scriptor.runtime-console` identity.

Behavioral evidence: workspace tests cover disabled, missing/revoked read,
cross-vault and safe-mode exclusion, registration ownership, route confinement,
command declaration and incompatible API rejection. Launch availability tests
cover the manager guard. Integrated browser and production gates are recorded
by the workspace composition checkpoint. The plugin browser spec checks missing
consent and safe-mode feedback, reviewed registration opening, and immediate
disable revocation; the integrated run and screenshot evidence are recorded in
`WORKSPACE-COMPOSITION-2026-10-02.md` and `VISUAL-REINSPECTION-2026-10-02.md`.
Owning shells render one overview heading; standalone plugin hosts retain their title.
Locale coverage checks all three supported languages. This document does not claim live
third-party installation or native release proof.
