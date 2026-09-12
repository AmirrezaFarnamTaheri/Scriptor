# Maintainers

## Current maintainer

Amirreza “Farnam” Taheri
Email: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Ownership model

The uploaded source baseline does not contain canonical Git history, so historical ownership and bus factor cannot be proven from this artifact alone. The repository now includes [`.github/CODEOWNERS`](.github/CODEOWNERS), but hosting enforcement and actual review concentration must be verified in the canonical repository. It should maintain:

- `CODEOWNERS` for security, release, Rust kernel, frontend, and docs paths;
- at least two reviewers for release and security-sensitive changes;
- a quarterly ownership/churn/secret-history report;
- immutable release tags and protected production environments.

Until additional maintainers are recorded, the lead maintainer is the escalation owner for all areas. This is a continuity risk, not an inferred team structure.

Generate local history evidence from a full clone with:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Release authority

Production releases:

1. originate from a `v<version>` tag matching [`VERSION`](VERSION);
2. pass `.github/workflows/ci.yml` and platform compile/package gates;
3. use the repository's documented unsigned-installer trust model: exact-source identity, SHA-256 checksums, target-bound trust-status records, SBOM, release receipt, and GitHub provenance attestations;
4. promote the exact downloaded build artifacts without rebuilding during publication;
5. publish the checksums, SBOM, release receipt, trust metadata, and attestations required by the release evidence contract.

See [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md).

## Support and escalation

| Topic | Route |
|---|---|
| Security | Private email per [`SECURITY.md`](SECURITY.md) |
| Bugs/features | GitHub Issues |
| Contributions | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Licensing | [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md) |
| Capability status | [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) |
