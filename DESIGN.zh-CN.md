# 设计系统

[English](DESIGN.md) · [فارسی](DESIGN.fa.md) · **简体中文** · [Русский](DESIGN.ru.md) · [Deutsch](DESIGN.de.md) · [Español](DESIGN.es.md)

Scriptor 是一个用于**实际操作**的界面：用户打开它来写作、导航、检查、比较和发布。视觉表达服务于这些任务，而不会与任务本身争夺注意力。

## 设计方向

- 精确、安静、明亮、技术感明确，但不模仿 IDE。
- 以中性的炭黑/板岩色表面为主，只使用一个克制的语义强调色。
- 高密度信息通过层级、节奏和分隔线组织，而不是通过层层嵌套的卡片。
- UI 使用系统无衬线字体，代码和数字使用系统等宽字体；不使用远程字体。

## 布局

桌面端包含四个功能区域：

1. 顶部命令栏；
2. vault/导航栏；
3. 编辑器/预览工作区；
4. 上下文 inspector 与状态区域。

在较窄宽度下，次要区域折叠到移动端 workspace 导航中。任何 workspace 变更都必须在 `320`、`375`、`768`、`1024`、`1440` 像素宽度以及 200% 缩放下检查。任何控件都不能只依赖 hover 才能使用。

## Anti-slop 约束

- 不使用默认的紫色/靛蓝色 AI 渐变。
- 工作界面中不使用超大的营销式排版。
- 不使用装饰性的 glassmorphism 或环境光晕；基于 token 的玻璃效果仅用于功能性 chrome。
- 不使用 emoji 作为结构性 UI 图标；统一使用既有的 Lucide 图标集。
- 不使用会引发布局位移的 hover 缩放变换。
- 没有已捕获证据时，不得虚构性能分数、完成证书或验证声明。

## Token 与自定义

权威 token 位于 `src/index.css` 和 `src/styles/`。新组件必须使用语义变量来表达表面、文本、边框、焦点、危险、警告、成功、间距、圆角和动效。任意颜色或阴影必须有文档化的例外说明。

| Token 角色 | Runtime 变量 | 用途 / 范围 |
|---|---|---|
| 主强调色 | `--primary` | 主操作按钮、活动标签指示器、关键 badge |
| 次级琥珀色 | `--amber` | 警告、中间状态 badge、次级高亮 |
| 主背景 | `--bg` | 应用 canvas 根背景 |
| 次级表面 | `--surface` | 面板、侧栏、模态对话框卡片 |
| 抬升表面 | `--surface-raised` | Hover 状态、抬升卡片、下拉项 |
| 主文本 | `--ink` / `--ink-strong` | 高对比度正文与标题 |
| 边框强调 | `--border` | 细微的面板边框与玻璃边缘 |
| 焦点环 | `--focus-ring` | 键盘焦点轮廓 |
| 显示字体 | `--font-sans` | UI 字体族选择（`system`、`inter`、`sf-pro`、`avenir-next`、`outfit`、`jetbrains-mono`、`georgia`） |
| 玻璃模糊 | `--glass-blur` | Backdrop filter 强度（`none`、`subtle`、`glass`、`heavy`） |

### 配色方案目录与 Custom Theme Builder

Scriptor 内置 **18 套精调配色方案**，分为三类（`dark`、`light`、`contrast`）：
- **深色：** `Dark Midnight`、`Catppuccin Mocha`、`Dracula`、`Nord Frost`、`Tokyo Night`、`Solarized Dark`、`Gruvbox Dark`、`Emerald Forest`、`Cyberpunk Neon`、`Monokai Pro`、`Rosé Pine`、`Synthwave 84`、`One Dark Pro`、`Vitesse Dark`。
- **浅色：** `Light Modern`、`Sepia Paper`。
- **高对比度：** `High Contrast`、`OLED True Black`。

用户还可以打开 **Custom Theme Builder** 创建、编辑、实时预览和删除自定义主题；这些主题动态存储在 `scriptor:custom-themes` 下。

## 交互契约

每个异步界面只能表示其所有者确实能够判断的状态。在支持的场景中，应提供：

- 加载或进度状态；
- 有意义的空状态；
- 可操作的错误状态；
- 可见的变更确认；
- 对长时间任务的取消能力。

高风险操作必须在原生确认提示中说明作用范围和后果。禁用的控件必须说明原因。破坏性操作不能作为默认操作。

## 无障碍基线

目标：WCAG 2.2 AA。

- 优先使用语义 HTML，再使用 ARIA；
- 每个交互元素都有清晰可见的 `:focus-visible` 样式；
- Tab 顺序合理，且不存在键盘陷阱；
- 模态对话框使用 label/description、初始焦点、焦点约束、Escape 处理、滚动锁定和焦点恢复；
- 标签页支持方向键、Home、End 和 roving `tabIndex`；
- 不能仅通过颜色传达状态；
- 动效遵循 `prefers-reduced-motion`；
- 面向触控的控件至少为 44×44 CSS 像素；
- 编辑器和 UI 文本在 200% 缩放下仍可读；
- 三级文本 token 在其主要表面上保持 WCAG AA 对比度；
- 除非用户明确覆盖，编辑器跟随应用的浅色/深色主题。

## 动效

动效只用于表达状态变化。默认过渡时间为 120–220 ms，使用 opacity 或不会改变 containing-block 语义的 transform。不得持续动画化对布局至关重要的宽度或高度。Reduced-motion 模式会去掉非必要过渡和 smooth scrolling。

## 组件架构

- 数据和编排位于 hooks 或 domain controllers 中；
- 展示组件接收有类型的 props；
- 共享 overlay 使用统一的 dialog/panel primitive；
- 超过 200 行的组件应被视为拆分候选；
- package 只能通过声明的 entry point 暴露行为；
- loading、empty、error 和 success 状态必须留在能够真实判断它们的所有者处。

## Slop Audit 结果

截至 2026-08-09：
- **原始 Emoji：** production TSX 文件中为 0（100% 使用 Lucide SVG 图标）。
- **不受控的 `transition: all`：** 433 个 CSS 与 TSX 文件中为 0。
- **UI 中显式 `any` cast：** production TSX 组件中为 0。
- **契约验证：** `pnpm check:source` 中 43 个单元测试与验证 suite 全部通过。

## 视觉验证

Playwright 项目覆盖浅色/深色主题、desktop/mobile breakpoints、模态区域、editor/preview、knowledge workbench、settings、graph 以及主要 workflow 状态。冻结的 release candidate 还要求在这些检查尚未可靠自动化之前，执行 200% 缩放、screen reader 和 native shell 的人工检查。Snapshot 阈值不得掩盖整页位移。参见 [`docs/validation/FRONTEND_QUALITY.zh-CN.md`](docs/validation/FRONTEND_QUALITY.zh-CN.md)。
