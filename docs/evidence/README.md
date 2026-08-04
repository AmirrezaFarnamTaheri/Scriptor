# Evidence policy

Release evidence is generated from a clean canonical Git checkout and is bound to both the checked-out commit and a deterministic SHA-256 source-tree identity. `release-receipt.json`, `scriptor.cyclonedx.json`, and `SHA256SUMS` are created in the publish job after every platform artifact has been downloaded, then verified before attestation or upload.

Local `artifacts/`, `ci-logs/`, `job_log.txt`, and `ci.log` paths are transient and ignored. Historical failed CI output may be retained outside the source tree for diagnosis, but it is never accepted as evidence for another commit or release candidate.

The verifier treats the receipt as an exact allowlist. A missing artifact, an extra unreceipted artifact, a symbolic link, a traversal/absolute path, a duplicate checksum entry, source-tree drift, or SBOM metadata drift blocks promotion. Evidence generation and verification require a clean canonical Git checkout; archive mode exists only for diagnostic source-identity reports and is not accepted by the promotion verifier.
