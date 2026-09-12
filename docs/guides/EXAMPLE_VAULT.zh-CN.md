[English](EXAMPLE_VAULT.md) · [فارسی](EXAMPLE_VAULT.fa.md) · **简体中文** · [Русский](EXAMPLE_VAULT.ru.md) · [Deutsch](EXAMPLE_VAULT.de.md) · [Español](EXAMPLE_VAULT.es.md)

# 示例 Vault 指南

## 概述

`example-research` vault 是 Scriptor 随附的示例知识库，用于展示核心能力：wikilink、frontmatter、每日笔记、引用、模板与 graph 导航。

## 位置

```
packages/test-fixtures/vaults/example-research/
```

## 结构

```
example-research/
├── index.md                      # 带 wikilinks 的主索引
├── daily/
│   └── 2026-01-15.md            # 示例每日笔记
├── projects/
│   └── scriptor-notes.md        # 带 frontmatter 的项目笔记
├── references/
│   └── einstein-1905.md         # 引用示例
├── templates/
│   └── note-template.md         # 带 {{tokens}} 的笔记模板
└── .scriptor/
    ├── config.json              # Vault 配置
    └── snippets.json            # 编辑器 snippets
```

## 展示的功能

### Wikilinks

内部链接使用双中括号：

```markdown
[[daily/2026-01-15|Today's daily note]]
[[projects/scriptor-notes|Scriptor project notes]]
```

- `[[path]]` — 按相对路径链接笔记
- `[[path|display text]]` — 使用自定义显示文本
- 链接相对于 vault 根目录解析

### Frontmatter

每篇笔记开头的 YAML frontmatter 提供 metadata：

```yaml
---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---
```

常用字段：
- `title` — 笔记标题
- `type` — 笔记类型（daily、project、reference 等）
- `tags` — 用于过滤和 graph 分组的标签数组
- `status` — workflow 状态（active、archived、draft）
- `_organized` — inbox triage 标志，由 organize 操作设置

### 每日笔记

每日笔记位于 `daily/`，文件名使用 ISO 日期：

```
daily/2026-01-15.md
```

在 `.scriptor/config.json` 中配置目录和格式：

```json
{
  "daily_note": {
    "directory": "daily",
    "filename_format": "{iso}",
    "title_format": "{iso}"
  }
}
```

### 引用

参考笔记在 frontmatter 中使用 `citation_key`：

```yaml
citation_key: einstein1905
```

Inline citation 使用 `[@key]`：

```markdown
As shown by [@einstein1905], light consists of discrete quanta.
```

Vault 导出使用 `references.bib` bibliography 文件和 CSL 样式生成格式化引用。

### Graph 导航

点击顶栏的 **Graph** 打开 graph：

- 每篇笔记都是 node。
- Wikilink 在 node 之间创建 edge。
- Tag 通过配置中的 `graph_groups` 控制 node 颜色。
- 点击 node 跳转到对应笔记。
- 使用 depth controls 展开/收起 graph。

### 模板

`templates/` 中的模板使用 `{{token}}` placeholder：

```markdown
---
title: "{{title}}"
type: note
---

# {{title}}

## Summary
```

可用 token：
- `{{title}}` — 笔记标题
- `{{date}}` — 当前 ISO 日期

### Snippets

`.scriptor/snippets.json` 中的编辑器 snippets 提供快速插入模板。输入 prefix（如 `daily`、`meeting`、`ref`）并按 Tab 展开。

## 加载示例 Vault

### 从应用加载

1. 打开 Scriptor。
2. 点击 **Open Vault**。
3. 导航到 `packages/test-fixtures/vaults/example-research/`。
4. 点击 **Open**。

### 通过脚本

```bash
# 复制到工作位置
cp -r packages/test-fixtures/vaults/example-research ~/my-research-vault

# 在 Scriptor 中打开
pnpm desktop:dev
# 然后从 UI 打开 ~/my-research-vault
```

### Fixture 脚本

```bash
# 复制到工作位置
cp -r packages/test-fixtures/vaults/example-research packages/test-fixtures/vaults/example-research-copy
```

这样会复制示例 vault，便于安全实验。
