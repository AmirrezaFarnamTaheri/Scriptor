# 发布安全与验证

[English](RELEASE-SECURITY.md) · **简体中文** · [Русский](RELEASE-SECURITY.ru.md) · [Deutsch](RELEASE-SECURITY.de.md) · [Español](RELEASE-SECURITY.es.md) · [فارسی](RELEASE-SECURITY.fa.md)

## 版本真相来源

`VERSION` 是权威来源。若 npm package、Cargo package、Tauri config、显式 release version 或 release tag 与其不一致，`node scripts/release/version.mjs check` 会失败。非 tag 的 branch ref 不会被解释为版本。`node scripts/release/version.mjs sync` 只允许在经过 review 的版本变更 branch 中使用；merge 前必须重新生成并检查 lockfile。

## 渠道与 release ownership

- **Preview：** 手动运行，`publish: false`。版本来自 checkout 后的 canonical `VERSION`；上传 workflow artifact，但绝不会创建 GitHub Release。
- **Production：** 不可变的 `v<version>` tag，值必须与 `VERSION` 一致。只有主 `Release` workflow 可以创建或修改 GitHub Release。

合并到 `main` 的 `VERSION` 变更会启动 `Release Kickoff`。它验证版本一致性，只在 tag 不存在时创建，拒绝移动或复用指向其他 commit 的已有 tag，并在该 tag 上 dispatch production workflow。显式 dispatch 是必需的，因为 GitHub 会抑制通过 `GITHUB_TOKEN` 生成的普通 workflow recursion。

## 官方 artifact 信任模型

官方 Scriptor 安装包有意保持**未签名**。Release workflow 不依赖 certificate、notarization、private key 或 signing secret。因此 Windows 与 macOS 可能显示未知发布者或未识别开发者警告。

支持的 upstream target matrix：

| 平台 | 架构 | 发布的安装包类型 |
|---|---|---|
| Windows | `x86_64` | MSI, NSIS EXE |
| macOS | `aarch64` | DMG |
| Linux | `x86_64` | DEB, AppImage |
| Linux | `aarch64` | DEB, AppImage |

每个 packaging job 写入一份与架构绑定的 `signing-evidence-<platform>-<architecture>.json`。官方记录声明：

- `signed: false`；
- `notarized: false`；
- `signatureType: "none"`；
- 精确 source commit；
- release channel、target platform 与 architecture；
- verifier instruction：checksum + GitHub attestation。

Publication job 要求每个受支持 target 恰好一份记录。记录缺失、重复、意外 target、错误 channel 或错误 commit 都会阻止发布。

Release receipt schema 4 会把已验证 target matrix 与 source identity、toolchain metadata、checksums 和精确 installer subject set 一起嵌入。它允许 unsigned production record，但绝不允许缺失或虚假描述 trust status。

## 精确 artifact 边界

每个 packaging job 只传输可分发的 installer 与一份 architecture-bound trust-status record。Publication 再分为两组：

- `release-artifacts`：恰好 7 个 installer——1 个 MSI、1 个 NSIS EXE、1 个 DMG、2 个 DEB、2 个 AppImage；
- `release-evidence`：恰好 4 个 trust-status JSON record，然后加入生成的 SBOM、checksum file 与 receipt。

解包的 AppDir 内容、`.app` 内部文件、DMG helper script、CI log、cache、source map、temporary key material，以及 `target/release/bundle` 下的任意其他文件都绝不是 release subject。

Publication 下载已 staging 的文件，不重新 build。之后生成：

- 只覆盖 7 个 installer subject 的 `SHA256SUMS`；
- 绑定 release version 与 source identity 的 CycloneDX 1.6 SBOM；
- source-bound release receipt schema 4，包含 4 个 normalized trust record；
- 每个 installer subject 的 GitHub provenance 与 SBOM attestations。

4 个 trust-status record 作为 metadata 发布并嵌入 receipt，但它们不是 installer subject，因此不列入 `SHA256SUMS`。

## Supply-chain 控制

- external action 固定到经过 review 的完整 commit SHA；
- 固定 runner label，并 pin Node、pnpm、Rust 版本；
- frozen pnpm dependency installation 与 locked Cargo resolution；
- architecture-specific artifact name，避免 x86_64/aarch64 collision；
- immutable tag creation，禁止 retarget 已有版本；
- evidence generation 前精确检查 installer 与 metadata cardinality；
- release upload 前验证 exact subject set；
- clean-checkout source identity 绑定 release commit；
- 保留 packaging/publication diagnostic，但不混入 release asset。

## 用户验证

从同一个 GitHub Release 下载一个 installer，以及 `SHA256SUMS`、`scriptor.cyclonedx.json` 和 `release-receipt.json`。

验证 GitHub attestation：

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux 校验单个下载 installer：

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```

macOS checksum 验证：

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

Windows PowerShell checksum 验证：

```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```

Maintainer 还可以把全部 7 个 installer 下载到 `release-artifacts`，把 4 个 trust record 加 SBOM/checksum/receipt 放入 `release-evidence`，checkout 精确 tag，然后运行：

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

任何缺失或无效的 checksum、SBOM、receipt、target-status record、source identity、exact-subject match 或 GitHub attestation 都是 production release blocker。官方 upstream installer 不宣称具有 OS publisher signature。
