# Five Google integration workflows

Scope: complete the existing Drive, Docs, Calendar, Tasks and Gmail workflows.
Sheets and Slides are outside this request. These desktop integrations remain
experimental until the separate live-account and packaged-client gates pass.

## Configuration and account ownership

Settings → Integrations exposes the public OAuth desktop client ID even when
Calendar syncing is disabled. The canonical existing field remains
`calendar_sync.google_client_id`, so existing vaults need no migration. This
value is public configuration, never a client secret or token.

Drive/Docs, Calendar/Tasks and Gmail each have independent connection status,
connect/reconnect and local disconnect controls. Credentials remain in three
separate OS-keychain bundles. Disconnect removes only the selected local bundle,
invalidates pending native OAuth work and informs other mounted consumers.
Google's app-wide authorization can be revoked separately in Google Account
permissions; doing so may affect multiple service grants.

Gmail controls require the explicitly enabled Gmail plugin. Disabled Gmail never
probes its account from Settings. Public config mutations use the originating
vault identity and serialized config merger. Failed persistence remains visible
without deleting successfully connected credentials. Workspace launch links are
disabled while Settings has unsaved edits; save before leaving.

## Resource selection and workflows

- Calendar and Tasks discover bounded complete calendar/task-list collections,
  retaining primary/default choices and manual identifiers for recovery.
  Selection persists in the existing vault settings. Read-only calendars remain
  readable; event pushes require confirmed write access. Provider revisions and
  explicit native approvals protect writes. Tasks title/notes limits are checked
  across an entire batch before any provider mutation.
- Drive lists accessible folders with bounded pagination and duplicate removal.
  Creating a folder requires its own write approval. Saving the folder and record
  transport persists `google_drive_folder_id` and `google_drive_transport` in
  `calendar_sync`. Account changes discard remote resources, preview state and
  ancestry. Shared-drive flags apply consistently to listings, metadata, media
  and uploads.
- Docs discovery is confined to the selected folder. Byte-preserving opaque
  Markdown records and optional reviewed text conversion remain separate modes.
  Conversion requires loss consent and content-hash review; export creates a new
  document. Existing rich documents are never overwritten. See
  [the transport contract](COLLABORATION_COMPLETION.md).
- Gmail loads at most 50 metadata records per page and retains at most 250 visible
  messages. Search, pagination and detail reads reject stale replies. Text import
  escapes active Markdown/HTML and writes only to a missing destination in the
  originating vault. Vault replacement suppresses obsolete indexing/navigation
  and notifications. Sending validates recipients and headers, encodes Unicode
  subjects and long body lines, and requires native approval. Archive/read/trash
  actions retain the same boundary.

## Verification evidence and limits

No local application, install, test, build, lint, typecheck or formatter was run
for this completion. GitHub workers own all executable verification. Authored
behavioral coverage includes resource/parser limits, discovery lifecycle,
independent account lanes, late OAuth/unmount/config failure, cross-vault Gmail
import, provider MIME parsing and native Tasks boundary cases.

Browser suites: `e2e/google-ecosystem-workflows.spec.ts` and
`e2e/google-gmail-workflows.spec.ts`. Fixtures explicitly opt in and never access
real Google accounts. Coverage includes folders, Docs review/conflicts, resource
selector persistence, read-only Calendar, account changes, Gmail search/pages,
native approval cancellation, stale responses, keyboard, RTL and 200% zoom.
Hosted evidence must be recorded against the final committed source, including
all new screenshots; authored tests alone are not passing evidence.

Commit `96d9ac7ef289ad1e4c9e894477811fb5ae8ec4b5` passed hosted desktop
compilation on Windows, Linux and macOS, the existing 108 visual comparisons,
localization, Rust checks and frontend/build/accessibility checks. Its browser
lane passed 442 cases and failed 14; its source lane passed 598 checks and failed
three. Repairs and expanded screenshots require another committed-head run.
These preceding passes do not verify the new screenshot states or subsequent
repairs. Four documented optional Typst upstream advisories remain unsuppressed
and block the supply-chain/release gate.

Primary provider references: [OAuth](https://developers.google.com/identity/protocols/oauth2),
[shared drives](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives),
[Tasks field limits](https://developers.google.com/tasks/reference/rest/v1/tasks).
Live OAuth login/refresh/reconnect, account switching, shared-drive membership,
Google app approval and packaged WebView behavior still require separate
provider/device evidence; fixture passes cannot establish those facts.
