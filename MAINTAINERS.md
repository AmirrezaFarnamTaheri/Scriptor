# Maintainers

## Current maintainer

Amirreza “Farnam” Taheri
Email: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Ownership model

The uploaded source baseline does not contain canonical Git history, so historical ownership and bus factor cannot be proven from this artifact alone. The repository now includes [`.github/CODEOWNERS`](.github/CODEOWNERS), but hosting enforcement and actual review concentration must be verified in the canonical repository. It should maintain:

- `CODEOWNERS` for security, release, Rust kernel, frontend, and docs paths;
- at least two reviewers for release/signing and security-sensitive changes;
- a quarterly ownership/churn/secret-history report;
- signed release tags and protected production environments.

Until additional maintainers are recorded, the lead maintainer is the escalation owner for all areas. This is a continuity risk, not an inferred team structure.

Generate local history evidence from a full clone with:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Release authority

Production releases:

1. originate from a `v<version>` tag matching [`VERSION`](VERSION);
2. pass `.github/workflows/ci.yml` and platform compile/package gates;
3. require signing/notarization secrets in a protected production environment;
4. promote the exact downloaded build artifacts;
5. publish checksums, SBOM, release receipt, and attestations.

See [`docs/RELEASE-SECURITY.md`](docs/RELEASE-SECURITY.md).

## Support and escalation

| Topic | Route |
|---|---|
| Security | Private email per [`SECURITY.md`](SECURITY.md) |
| Bugs/features | GitHub Issues |
| Contributions | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Licensing | [`COMMERCIAL-LICENSING.md`](COMMERCIAL-LICENSING.md) |
| Capability status | [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md) |
