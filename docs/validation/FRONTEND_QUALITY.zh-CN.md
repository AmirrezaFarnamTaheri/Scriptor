# 前端质量标准

[English](FRONTEND_QUALITY.md) · **简体中文** · [Русский](FRONTEND_QUALITY.ru.md) · [Deutsch](FRONTEND_QUALITY.de.md) · [Español](FRONTEND_QUALITY.es.md) · [فارسی](FRONTEND_QUALITY.fa.md)

Scriptor 是一个 **operate** 型界面。质量意味着平静清晰的层级、快速完成任务、完整 interaction state、keyboard access、responsive density，以及不存在隐藏权限——而不是装饰性炫技。

## 自动 Source Gate

```bash
npm run check:frontend-quality --silent
```

该 gate 检查 production TypeScript/CSS：

- UI/runtime contract 中的显式 `any`；
- 用 emoji glyph 替代 icon system；
- remote fonts/CSS imports；
- critical workspace surface 中的 static inline style；
- modal focus containment 与命名；
- typed editor/preview action contracts；
- responsive editor、graph、modal、error-state CSS；
- self-contained error UI 与 design-system inclusion。

Package import 另由 `lint:boundaries` 强制。

## 视觉方向

- neutral charcoal/slate 基础，只使用一个克制的 teal accent；
- 通过 typography、divider、rhythm、negative space 建立层级，而不是嵌套 cards；
- 禁止 purple AI gradient、neon glow、无意义 glass、generic dashboard tile、emoji control、装饰性永久 motion；
- system UI font + system monospace；不依赖 network font；
- motion 只用于状态连续性，并在用户请求时始终禁用/降低。

## Component 验收

每个 async surface 都必须具有 loading、有用 empty、可操作 error、可见 success state。底层 operation 支持时，long-running work 必须暴露 cancellation。High-risk operation 必须在 native confirmation 前解释 scope 与 consequence。

Dialog 必须具有 programmatic title/description、`aria-modal`、initial focus、focus containment、Escape、backdrop behavior、scroll containment 与 focus restoration。Tab 使用 roving focus + Arrow/Home/End。Icon-only control 必须有 accessible name。

Top-bar/toolbar overflow check 覆盖 narrow viewport 与 200% text zoom。Portaled menu/customization popover 必须留在 visual viewport 内，以 Escape 关闭，恢复 trigger focus，并在 resize 或 ancestor scroll 后更新 position。Plugin/store preset 必须作为一次可见 state transition 应用，保留不归自己所有的 third-party plugin ID，并真实暴露 empty 与 persistence-error state。

## 必需视觉证据

Playwright screenshot suite 覆盖 workspace、editor/preview、command palette、graph、canvas、Git、MCP、settings、publish、health、knowledge、conflict resolution、history、shortcuts、mobile layout、onboarding 和 plugins。Release reviewer 必须从 frozen source regenerate snapshot 并检查 diff；历史 PNG 不是当前 source state 的证明。
