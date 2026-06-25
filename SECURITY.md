# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

Security fixes are published for the latest 0.1.x release. Upgrade via [GitHub Releases](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases).

## Reporting a vulnerability

Please **do not** open public GitHub issues for security vulnerabilities.

Email **[taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)** with:

- A description of the issue and potential impact
- Steps to reproduce (proof-of-concept if available)
- Affected versions and platforms

### What to expect

| Step | Timeline |
|------|----------|
| Acknowledgment | Within 7 days |
| Initial assessment | Within 14 days |
| Fix and coordinated disclosure | As soon as a patch is ready |

We will coordinate disclosure and a fix before public announcement when appropriate.

## Scope

**In scope:**

- Scriptor desktop application and bundled daemon
- Vault data handling, plugin sandbox boundaries, and MCP permission modes
- Release artifacts published from this repository

**Out of scope:**

- Third-party tools (Pandoc, Git, OS keychains) except where Scriptor integrates unsafely
- Social engineering or physical access attacks
- Denial-of-service against local-only services without data impact

## Maintainer

Amirreza "Farnam" Taheri — [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
