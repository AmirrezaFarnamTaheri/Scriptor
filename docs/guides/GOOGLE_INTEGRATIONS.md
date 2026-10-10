# Google integrations

**English** · [فارسی](GOOGLE_INTEGRATIONS.fa.md) · [简体中文](GOOGLE_INTEGRATIONS.zh-CN.md) · [Русский](GOOGLE_INTEGRATIONS.ru.md) · [Deutsch](GOOGLE_INTEGRATIONS.de.md) · [Español](GOOGLE_INTEGRATIONS.es.md)

Scriptor's experimental desktop integrations connect Drive, Docs, Calendar,
Tasks and Gmail to a local vault. Markdown files remain the source of truth.
Remote changes are reviewed before they are applied; connecting an account does
not start automatic synchronization of the whole vault.

## Set up and connect

Open **Settings → Integrations** and enter the public Google OAuth desktop
client ID. Save the configuration before opening an integration workspace.
Calendar synchronization can remain disabled while you use Drive or Gmail.

The Google project must enable the APIs used by the selected services and have
an OAuth client suitable for an installed desktop application. Follow Google's
[installed-app setup](https://developers.google.com/identity/protocols/oauth2/native-app)
for the project, consent screen and client. Scriptor opens the system browser
for consent. Enter the client ID in Scriptor; never enter a client secret or
access token in a vault setting.

Connections are independent: Drive and Docs share one connection, Calendar and
Tasks share another, and Gmail has its own. Connect each group you intend to use
and check the displayed account identity. Gmail also requires its plugin to be
enabled. Tokens are held in the operating system keychain, while the public
client ID and resource selections belong to the vault configuration.

## Share Markdown through Drive or Docs

Open **Drive collaboration** from the command palette. Browse accessible
folders, enter a folder ID manually, or create a folder after reviewing the
write permission request. Choose a record transport, then use **Save folder and
transport** to retain the selection for this vault.

Drive JSON and opaque Google Docs records carry immutable Markdown revisions.
The Docs record format preserves Markdown bytes; it does not turn the document
into a rich text editor. Review a remote revision and resolve conflicts before
applying it locally. Sharing a revision is an explicit provider write.

For ordinary Google documents, browse documents inside the selected folder.
Text conversion is a separate workflow with an explicit loss warning and
content review. Export creates a new document rather than replacing an existing
rich document. Media files are not replicated with these Markdown records.

For transport formats, conflict handling and polling limits, see the
[collaboration contract](../validation/COLLABORATION_COMPLETION.md).

## Plan with Calendar and Tasks

In Integrations settings, discover calendars and task lists, choose the intended
resources and save. Manual identifiers remain available when discovery cannot
find a resource. Refresh the connection after changing its permissions.

The Tasks workspace shows local tasks and the weekly planner. Local time blocks
remain usable offline. Google Tasks due dates do not represent a scheduled time;
timed blocks use Calendar events. Select a vault task, set its start and end,
and save the local block. An existing timed event can be mapped explicitly.

Use **Review bidirectional sync** to compare loaded provider data with local
tasks and mapped blocks. Choose a direction for each change. Provider writes
require permission, and conflicting revisions require a fresh review. A
read-only calendar can be inspected and imported, but event pushes are disabled.
Review covers the loaded window and explicit mappings, not every Google event.

## Work with Gmail

Enable the Gmail plugin and open **Gmail Manager**. Search or refresh messages,
load additional pages, and select a message to read its plain text. The visible
list is bounded; refine the search when more messages remain than it can hold.

Import saves a new Markdown note in the originating vault. Message text is
escaped so email content is not interpreted as active Markdown or HTML. Import
does not overwrite an existing destination. Archive, trash and send are
separate reviewed provider actions. Compose sends plain text; a rejected
permission request or failed send retains the draft for correction or retry.

## Disconnect and recover

Disconnect removes the selected local credential bundle. It clears prepared
remote reviews and account-specific cached data without deleting local notes or
time blocks. Provider event mappings are not reused for a different account or
calendar. A request already submitted to Google may finish after cancellation;
switching accounts prevents its stale result from replacing the new workspace.

Local disconnect does not revoke Google's app-wide authorization. To revoke
that authorization, manage the app's permissions in your Google Account; this
can affect more than one connected service.

| Problem | Next step |
|---|---|
| Authentication expired or required | Reconnect the affected service and refresh its data. |
| Resource missing or access denied | Confirm the account and resource ID, check its sharing permissions, then rediscover it. |
| Pagination or discovery failed | Refresh to start a new traversal; partial discovery is rejected. |
| Settings have unsaved changes | Save the configuration before using a workspace launch link. |
| Remote revision changed | Fetch again and prepare a new review before applying a write. |

These integrations remain experimental. Browser fixtures verify application
behavior without accessing Google accounts. Live OAuth, shared-drive access and
packaged desktop behavior need separate provider and device verification. See
the [capability ledger](../CAPABILITY-MATURITY.md) for support status and the
[verification record](../validation/GOOGLE-INTEGRATIONS-2026-10-09.md) for evidence.
