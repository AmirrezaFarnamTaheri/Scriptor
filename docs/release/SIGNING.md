# Release signing and notarization

Scriptor release artifacts are built by [`.github/workflows/release.yml`](../../.github/workflows/release.yml) on `v*` tag pushes.

## Platforms

| Platform | Artifacts | Signing |
|---|---|---|
| Windows | MSI, NSIS | Optional Authenticode (`WINDOWS_CERTIFICATE`) |
| macOS | DMG | Ad-hoc (`-`) by default; optional Developer ID + notarization (secrets below) |
| Linux | DEB, AppImage | Unsigned by default |

## macOS notarization secrets

Configure these GitHub Actions **repository secrets** for signed, notarized macOS builds:

| Secret | Description |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` Developer ID Application certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` export |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple ID email used for notarization |
| `APPLE_PASSWORD` | App-specific password ([appleid.apple.com](https://appleid.apple.com)) |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

When secrets are present, the release workflow imports the certificate into a temporary keychain and passes signing/notarization environment variables to `tauri build`.

When secrets are absent, macOS builds use **ad-hoc signing** (`signingIdentity: "-"`). No Apple Developer account is required. Users may need to right-click → **Open** the first time, or allow the app under **System Settings → Privacy & Security**. Ad-hoc builds are fine for GitHub Releases and local testing; add Developer ID signing later for smoother public distribution.

## Windows signing secrets

| Secret | Description |
|---|---|
| `WINDOWS_CERTIFICATE` | Base64-encoded code signing certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Certificate export password |

## Local builds

```powershell
pnpm build
pnpm prepare:desktop
pnpm --dir apps/desktop build
```

Set the same environment variables locally when testing signed builds.

## Maintainer

Amirreza "Farnam" Taheri — [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
