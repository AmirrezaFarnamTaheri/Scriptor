[English](COLOR-SEMANTICS.md) · [فارسی](COLOR-SEMANTICS.fa.md) · **简体中文** · [Русский](COLOR-SEMANTICS.ru.md) · [Deutsch](COLOR-SEMANTICS.de.md) · [Español](COLOR-SEMANTICS.es.md)

# 颜色语义与所有权

**状态：**生效中的设计契约

Scriptor 按职责划分颜色值，避免用无人负责的字面量编码产品状态。

## 1. 主题与语义 UI 颜色

交互状态、状态提示、选中、焦点、警告、错误、成功、边框和应用表面必须使用具名 CSS custom properties。当前应用兼容层暴露了 `--primary`、`--danger`、`--success`、`--selected`、`--surface`、`--border` 等变量；`src/styles/tokens/` 下的分层 token 系统拥有对应的基础色板和语义色板。

组件 CSS 与 React 渲染代码不得为了表示某个应用状态或交互状态而新造一个十六进制颜色值。应添加或映射 token。

## 2. 内容与可视化色板

持久化或用户创作的视觉数据不同于应用 chrome。Canvas 块填充/描边、便签颜色、annotation 颜色、graph 系列/文件夹色板、syntax/editor theme 定义、导出 SVG 默认值以及用户可选主题色板，在颜色字面量本身属于内容格式或命名色板时可以包含字面颜色。这些值不得被重新解释为隐式应用状态颜色。

## 3. Fallback

组件不得用 `var(--danger, #b42318)` 这类原始语义 fallback 绕过 token 所有权。必需的应用 token 由应用主题契约定义。内容 renderer 在加载缺少样式的用户数据时可以使用稳定字面 fallback，因为这些值描述的是文档内容，而不是 UI 状态。

## 4. Canvas API

SVG presentation attribute 可以直接引用 CSS variable。Canvas 2D API 需要已解析的颜色，因此具有应用语义的 Canvas 颜色应从活动元素计算后的 custom properties 中读取。可视化色板只能作为渲染 fallback，不能成为状态语义来源。
