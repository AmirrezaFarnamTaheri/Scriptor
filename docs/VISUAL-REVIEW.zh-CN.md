[English](VISUAL-REVIEW.md) · [فارسی](VISUAL-REVIEW.fa.md) · **简体中文** · [Русский](VISUAL-REVIEW.ru.md) · [Deutsch](VISUAL-REVIEW.de.md) · [Español](VISUAL-REVIEW.es.md)

# 视觉审查说明

经审查的 Windows 基线视觉图库是本文涉及的所有截图的统一归档位置。README 的截图章节、`docs/assets/screenshots/README.md` 以及 `docs/assets/screenshots/` 下纳入版本控制的 PNG 是权威来源；本页记录的是**审查者的判断依据与审查纪律**，而不是重复存放图片。

## 视觉测试套件验证什么

- 延迟加载面板、顶栏溢出、紧凑布局、模态框焦点以及控制台/网络清洁度均由 Playwright 源测试套件断言，并且必须基于冻结的发布候选版本重新运行。
- 深色模式和 1024 / 768 / 375 px 断点属于测试矩阵；README 中的工作区成对截图与响应式截图记录了已审查的基线。
- Reader、Tasks 与 Kanban 流程由 Playwright 功能回归套件覆盖，并在相应实验性界面启用时作为运行时证据捕获。
- 恢复 fallback、键盘 popover、插件管理和索引就绪状态都有从图库链接的专用截图。

## 审查纪律

- 任何基线变更都必须检查视觉 diff，并在变更包中留下明确的审查说明。
- 只有在审查者检查过 diff 之后才能替换过期快照；绝不能通过提高全局容差来掩盖视觉失败。
- Playwright 源测试套件必须与纳入版本控制的 PNG 保持一致。PNG 属于文档产物，本身并不是发布证据；精确 commit、浏览器、viewport 以及 `pnpm test:visual` 的结果才是权威依据。

## 交叉引用

- README 截图章节 — 面向用户介绍工作区，以及写作、知识、可视化、自动化和运行/发布界面。
- `docs/assets/screenshots/README.md` — 每个纳入版本控制的 PNG、其尺寸及引用它的文档。
- `docs/RELEASE-CHECKLIST.md` — 发布时的视觉门禁项。
- `docs/VERIFICATION.md` — 视觉验证证据链。
