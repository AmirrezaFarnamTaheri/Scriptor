# Encrypted vault threat model

**Decision:** encryption remains experimental. Cryptographic primitives are not equivalent to an end-to-end encrypted vault product.

## Assets

Markdown content, attachments, configuration, indexes, search terms, graph/link metadata, Git history, backups, temporary exports, logs, process arguments, keys, and recovery material.

## Threats in scope

- lost or stolen powered-off device;
- offline copy of a vault or backup;
- accidental plaintext residue during migration/export/restore;
- weak passphrases and parameter downgrade;
- key loss and interrupted rekey/migration;
- metadata leakage through paths, indexes, Git, logs, thumbnails, swap, or crash dumps.

## Threats not solved by per-file encryption

A compromised running OS/user session, malicious renderer with already-granted authority, keylogger, hostile external tool, plaintext displayed in memory, or an attacker with access to unlocked keychain/session material.

## Required architecture before graduation

1. versioned envelope containing algorithm/KDF identifiers and parameters;
2. OS-keychain and passphrase recovery design with explicit loss semantics;
3. encrypted or deliberately excluded index/graph/cache strategy;
4. atomic migration/rekey journal with rollback;
5. encrypted external backups and restore drill;
6. Git policy preventing plaintext history;
7. secure temp/export handling;
8. independent cryptographic review, known-answer tests, fuzzing, fault injection, and parameter migration tests;
9. UI that communicates locked/unlocked state and metadata leakage accurately.

## Current implementation

`crates/vault/src/encryption.rs` uses authenticated encryption and Argon2id-based passphrase derivation with version checks and negative tests. It is a prototype library module, not wired as a transparent supported vault mode. Product and security materials must retain that distinction.
