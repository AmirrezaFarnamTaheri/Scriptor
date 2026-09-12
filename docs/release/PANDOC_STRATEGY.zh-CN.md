# Pandoc 策略

[English](PANDOC_STRATEGY.md) · **简体中文** · [Русский](PANDOC_STRATEGY.ru.md) · [Deutsch](PANDOC_STRATEGY.de.md) · [Español](PANDOC_STRATEGY.es.md) · [فارسی](PANDOC_STRATEGY.fa.md)

Scriptor 通过 Pandoc 导出，并只使用明确允许的参数。桌面应用与 CLI 共用 `scriptor-export-runner` 的发现逻辑。

## 解析顺序

1. **`SCRIPTOR_PANDOC_PATH`** — Pandoc 可执行文件的绝对路径。适用于 IT 将 Pandoc 安装在 `PATH` 之外，或系统同时存在多个版本的情况。
2. **`PATH` 中的 `pandoc`** — 默认方式。Windows 使用 `where pandoc` 解析路径；Unix 使用 `which pandoc`。

验证发现结果：

```powershell
pnpm cli -- export-discover
```

## 安装选项

| 方式 | 状态 | 说明 |
|---|---|---|
| `PATH` 中的系统 Pandoc | **默认** | 符合常见高级用户环境；安装包最小。 |
| `SCRIPTOR_PANDOC_PATH` 覆盖 | **支持** | 适合企业部署。 |
| 安装包内置 Pandoc | **可选** | `SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1` |

即使未安装 Pandoc，也可以执行导出的 dry-run（只预览参数）。真实导出需要可工作的 Pandoc 二进制文件以及格式所需的相关引擎，例如生成 PDF 时使用的 LaTeX。

## 推荐安装方式

**Windows（winget）：**

```powershell
winget install --id JohnMacFarlane.Pandoc
```

**macOS（Homebrew）：**

```bash
brew install pandoc
```

**Linux：**使用发行版软件包或 Pandoc 官方 release archive。

## 常见失败模式

| 现象 | 解决办法 |
|---|---|
| `pandoc was not found on PATH` | 安装 Pandoc，或设置 `SCRIPTOR_PANDOC_PATH`。 |
| dry-run 成功但实际导出失败 | 所选格式需要的 Pandoc filter/engine 缺失。 |
| 选中了错误的 Pandoc 版本 | 将 `SCRIPTOR_PANDOC_PATH` 指向目标二进制文件。 |

## Pandoc 的 GPL / AGPL 许可边界

Pandoc 使用 **GPL-2.0-or-later**。Scriptor 使用 **AGPL-3.0-or-later**。两种许可证可以共同分发，但 Scriptor 调用 Pandoc 的方式仍必须保持清晰的边界。

### Scriptor 如何使用 Pandoc

Scriptor 在 `crates/export-runner` 中通过 `std::process::Command` 把 Pandoc 作为**外部进程**调用。Pandoc 源码不会以静态或动态方式链接进 Scriptor 二进制文件；GPL 授权的 Pandoc 代码不会进入 Scriptor 的地址空间。

```
┌──────────────┐   subprocess   ┌──────────────┐
│ Scriptor      │ ─────────────→ │ pandoc        │
│ (AGPL-3.0)   │ ←───────────── │ (GPL-2.0+)   │
└──────────────┘   stdout/file  └──────────────┘
```

### 这意味着什么

| 场景 | 许可证义务 |
|---|---|
| Scriptor 不随附 Pandoc | 无 Pandoc GPL 分发义务。用户自行安装。 |
| 安装包中捆绑 Pandoc | Pandoc 仍是独立作品；安装包必须遵守 Pandoc 二进制文件的 GPL-2.0+ 要求（源码提供方式、许可证声明）。Scriptor 的 AGPL-3.0+ 仅适用于 Scriptor 代码。 |
| Scriptor 在运行时调用 Pandoc | 不产生合并作品义务；进程级调用不是链接。 |
| Scriptor 分发 Pandoc filter | 导入 Pandoc module 的 filter 属于 GPL-2.0+ 派生作品。仅通过 stdin/stdout 通信的 Scriptor 自有 filter 属于独立作品。 |

### `extra_pandoc_args` allowlist

用户提供的 `extra_pandoc_args` 会经过 `crates/export-runner/src/allowlist.rs` 中的 allowlist。这可以阻止任意参数注入，并确保只有已记录的安全 flag 会传递给 Pandoc 子进程。该 allowlist 是安全边界，而不是许可证机制。

### 内置 Pandoc（可选）

如果 Scriptor 将来在安装包中捆绑 Pandoc（`SCRIPTOR_BUNDLED_PANDOC_DIR`），release 流程必须：

1. 在 Pandoc 二进制文件旁附带其自身许可证文件；
2. 按 GPL-2.0 §6 提供 Pandoc 源码的书面要约；
3. 在 release notes 中记录 Pandoc 版本与许可证。

这些义务仅适用于 Pandoc 二进制文件，不适用于 Scriptor 本身。

## 安全

- 导出参数由结构化 Rust 类型生成，不通过 shell 字符串拼接构造；
- `extra_pandoc_args` 经过 `export-runner` 的 allowlist；
- 如果未来加入内置 Pandoc，`export-discover` 输出必须包含固定的版本元数据，供支持诊断使用。
