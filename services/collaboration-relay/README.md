# Scriptor collaboration relay — experimental WSS service

**Status: incomplete experimental multi-author transport, not a released Scriptor feature.** The relay accepts signed document-scoped collaboration sessions and forwards opaque Yjs-compatible update bytes, but the Scriptor desktop native journal, actual Yjs state-vector codec, CRDT editor bindings, safe filesystem projection, and full multi-client recovery acceptance are not implemented. Do not enable this as a production feature or advertise Google Docs/Overleaf-native live editing.

## Components and security boundaries

- `src/room-store.mjs`: SQLite WAL persistence (`synchronous=FULL`) with room/doc/epoch-scoped ACL, deduplicated message IDs, replay cursors, per-document quotas, and durable receipts. `member_keys` stores owner-approved canonical Ed25519 public keys and current roles. Revoked users and rotated keys cannot authenticate again.
- `src/challenge-auth.mjs`: one-time Ed25519 challenges cryptographically bound to room, document, epoch, peer identity and a server-generated nonce; unused attempts expire.
- `src/session-hub.mjs`: challenge/authentication state machine for WebSocket connections. Every read, update, grant and presence event checks the **current** membership and public key in SQLite. Trusted session identity is derived from a verified signature, never taken from request JSON. A committed update gets a durable ACK; it is broadcast to authorized live sockets without the sender's private local vault ID. Reconnecting clients retrieve durable cursor pages.
- `src/server.mjs`: explicit HTTPS/WSS listener using the audited `ws` package. Production requires a real TLS certificate and group/world-unreadable private key; only `/v1/live` and exact subprotocol `scriptor-live-v1` are accepted. Browser Origins must match an operator-provided allowlist, with no wildcard. Message size, WebSocket compression and session counts are bounded. Inbound binary frames, unexpected messages and unapproved clients fail closed.
- `src/cli.mjs`: explicit operator-only `bootstrap` and `serve` commands. Neither runs automatically when Scriptor starts. A bootstrap file must be private (`0600` on POSIX). The server does not provide a remote room-creation endpoint.

The operator of this non-end-to-end-encrypted relay **can read collaboration content**. TLS secures the transport, not the contents against the operator. Never place long-lived private signing keys, Google access tokens, Overleaf cookies or vault paths in the server database or URLs.

## Operator bootstrap (development only)

Use Node.js 22.16+ with the exact locked workspace dependency graph. The selected storage directory must be owned by the operator with mode `0700`; don't place it on a shared network filesystem. Generate an Ed25519 key pair in a trusted native client and keep the *private* key on the client. Create a `0600` bootstrap JSON file containing exactly:

```json
{
  "roomId": "random_room_id",
  "documentId": "random_document_id",
  "epoch": 1,
  "ownerPeerId": "owner_peer_id",
  "ownerPublicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n",
  "initialUpdate": {
    "version": 1,
    "kind": "LOCAL_UPDATE",
    "vaultId": "local_vault_id",
    "roomId": "random_room_id",
    "documentId": "random_document_id",
    "epoch": 1,
    "peerId": "owner_peer_id",
    "messageId": "unique_seed_id",
    "clientSeq": 1,
    "payload": "base64_crdt_bytes"
  }
}
```

The payload must be a real, independently verified binary CRDT seed; the relay does **not** generate or validate Yjs updates. A source-file string encoded in base64 is not a CRDT seed. A bootstrap repeat with identical content is idempotent; a different owner, epoch, or seed is rejected.

```sh
export SCRIPTOR_RELAY_DATA_DIR=/private/scriptor-relay
export SCRIPTOR_RELAY_BOOTSTRAP_FILE=/private/bootstrap.json
pnpm --dir services/collaboration-relay bootstrap
```

Then run a TLS-enabled WSS listener:

```sh
export SCRIPTOR_RELAY_TLS_KEY=/private/tls-key.pem
export SCRIPTOR_RELAY_TLS_CERT=/private/tls-cert.pem
export SCRIPTOR_RELAY_HOST=127.0.0.1
export SCRIPTOR_RELAY_PORT=8443
# For browser-based clients, explicitly allow each exact Origin:
export SCRIPTOR_RELAY_ALLOWED_ORIGINS='tauri://localhost,app://scriptor'
pnpm --dir services/collaboration-relay serve
```

The public endpoint is `wss://HOST:PORT/v1/live` using subprotocol `scriptor-live-v1`. Native clients that omit `Origin` still need their approved Ed25519 signing identity. TLS private key permissions must be `0600` on POSIX. Do not use test certificates, `rejectUnauthorized: false`, wildcard Origins, or an unprotected proxy in production.

## Wire flow

Clients send JSON messages in this order:

1. `{"type":"hello","scope":{"roomId":"...","documentId":"...","epoch":1,"peerId":"..."}}`
2. Server sends a one-use `challenge` containing `challengeId` and signed message text; client signs the UTF-8 challenge with its registered **private** Ed25519 key.
3. Client sends `{"type":"proof","challengeId":"...","signature":"base64url"}`. On success server replies `ready` with current role.
4. Client sends `{"type":"sync","afterCursor":0}` for bounded replay, or `{"type":"update","update":{...}}` with the versioned local-update envelope. A persistent write receives `ack` (`durable: true`, cursor, duplicate). Existing authenticated peers receive `update` events only after commit.
5. Owner may send `grant` with `targetPeerId`, `role` and optional approved public key. Revocation or key rotation immediately invalidates existing sessions. Ephemeral `awareness` messages do not persist.

A durable server ACK **does not** mean another participant applied the change, nor that the native file was saved. The protocol currently provides cursor replay, not CRDT state-vector reconciliation or snapshot compaction. At the quota limit, further updates are rejected without replacing prior history. Long-offline recovery requires dedicated native storage before user deployment.

## Verification and remaining blockers

Run tests with `pnpm --dir services/collaboration-relay test`; the root source-test runner also discovers the tests. Unit tests cover persistence, key rotation, revocation, signed challenges, three-client routing, pagination, quota refusal and TLS policy. The WSS socket integration test runs when the locked `ws` dependency and OpenSSL are present; test-only self-signed certificates are **not** deployment credentials.

Blocking milestone M1 tasks: native durable operation journal and CAS projection coordinator; a proven Yjs text CRDT with causal update/state-vector semantics and CodeMirror/Monaco incremental bindings; native-managed signing-key storage and relay connection; persistent invitation acceptance and consent UX; published security review; three-device offline/partition/crash convergence and installed-app verification. Google Docs structured rich-text and Overleaf whole-project Git adapters are later, independent milestones. Keep PR #339 in draft until those are complete.
