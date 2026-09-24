# 界面视觉评审 — 2026-09-24

[English](ui-visual-review-2026-09-24.md) · [فارسی](ui-visual-review-2026-09-24.fa.md) · **简体中文** · [Русский](ui-visual-review-2026-09-24.ru.md) · [Deutsch](ui-visual-review-2026-09-24.de.md) · [Español](ui-visual-review-2026-09-24.es.md)

本次评审涵盖用户提供的局部截图和文档中的截图图库。图库展示的是示例 vault 的静态画面，只能说明可见状态，并不表示每个流程都在真实 vault 中运行过。

更新后的图库包含 35 张 PNG。所有图片都通过联系表检查；空编辑器和 tablet 截图还以原始分辨率进行了检查。最终修改后的 108 个视觉状态全部通过，tablet 布局、顶部栏面板切换和空编辑器卡片也有专门的回归检查。

## 本次修复

| 区域 | 问题与修复 |
| --- | --- |
| 空编辑器 | 原边框没有包住按钮和说明文字。现在整块空状态都位于一张卡片中，并移除了装饰性渐变。浏览器几何测试覆盖桌面和 tablet 宽度。 |
| 历史导航与 vault 选择器 | 外层边框和内部滚动让控件两端看起来被裁切。已移除多余外框，每个控件保留自己的边界。 |
| 顶部栏操作 | Git 和 Quick Capture 每次点击都会再次打开面板。现在再次点击会关闭面板；命令和深层链接仍会明确打开。 |
| Support | 桌面端默认显示爱心图标。旧默认设置只迁移一次，保留用户自定义设置。窄屏手机上仍可从命令面板访问 Support。 |
| 顶部栏提示 | 定位提示可能越出按钮并遮挡工作区。顶部栏图标现使用浏览器原生标题和无障碍名称。 |
| Tablet 导航 | Inspector 标签、日期和模式栏曾被裁切或互相遮挡。标签可以换行，日期显示为紧凑格式，模式栏改用下拉选择。 |

## 对重复局部截图的深入检查

1. **空状态：** 主要问题是边框没有包住完整内容。在截图所示宽度下，说明文字换成两行是合理的。主按钮和次按钮的层级清晰。建议在 200% 缩放和深色模式下检查 “Local-first…” 小字的对比度。
2. **历史导航：** 后退和前进用于导航；文件夹用于打开 vault；选择器用于切换最近使用的 vault。旧外框让这些不同操作看起来像一个输入框。还应在 320、375、768、1024 和 1440 像素宽度下检查顶部栏。
3. **源码与 Preview：** 截图中的笔记以 `[@citekey]---` 开头，下一行是 `_organized: true`。有效的 YAML frontmatter 必须在第一行单独以 `---` 开始。渲染器会保留格式错误的 frontmatter，避免静默隐藏用户内容。此外，中央 **Preview** 和 **Split** 右侧都是可编辑的 CodeMirror 视觉 Markdown 表面，并不执行完整 HTML 渲染流程。Inspector 中的 **Rendered output** 使用经过清理的渲染器，是检查原始 HTML、引用和高级 Markdown 的准确视图。“Preview” 这个名称没有说明两者区别。后续应支持在直接编辑时进行完整渲染，或将该视图改名为 “Visual edit” 并清楚链接到 “Rendered output”。

后续的 Outline 卡片局部截图没有显示标题裁切、边框重叠或提示缺失。标记过的 tablet 截图确实显示了历史导航和模式栏重叠的问题，该问题已修复。

**T Typography** 操作应保留文字标签。菜单还包含排版转换和清理，并非只选择字体；改称 “Font” 会造成误解，单字母 “F” 在 Insert 和 Tools 旁也不够明确。

## 图库观察与后续事项

| 截图 | 观察 | 优先级 |
| --- | --- | --- |
| `workspace-light`、`workspace-dark`、`inspector-preview`、`workspace-rendered`、`editor-preview` | 可编辑 Preview 和完整渲染使用不同路径，界面没有解释这一差别。 | 高 |
| `workspace-tablet` | 标签裁切已修复。状态区域仍会形成较高的底栏，层级值得进一步调整。 | 中 |
| `graph`、`canvas` | 少量内容占据很大的空白区域。应在应用中检查缩放、适配视图和首个操作的位置。 | 中 |
| `mcp-tools`、`plugin-permissions`、`plugins-installed` | 右侧栏包含密集的说明和权限选项。检查键盘焦点顺序、200% 缩放和主要授权操作是否始终可见。 | 中 |
| `publish-center`、`settings`、`settings-appearance` | 长表单需要大量滚动，许多全宽字段外观相似。 | 中 |
| `knowledge-workbench`、`note-history`、`vault-health` | 空状态、比较和健康状态均可读。可将 Knowledge Workbench 的下一步操作移近标题。 | 低 |
| `command-palette`、`conflict-resolver` | 当前选择和冲突选项清楚可见。调整布局前应检查窄屏、缩放和纯键盘操作。 | 中 |

视觉测试覆盖窄桌面、tablet、手机、深色模式和 200% 缩放。可编辑 Preview 中的原始 HTML，以及停靠式和模态面板，还需要单独进行交互检查。
