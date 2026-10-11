# Google 集成

[English](GOOGLE_INTEGRATIONS.md) · [فارسی](GOOGLE_INTEGRATIONS.fa.md) · **简体中文** · [Русский](GOOGLE_INTEGRATIONS.ru.md) · [Deutsch](GOOGLE_INTEGRATIONS.de.md) · [Español](GOOGLE_INTEGRATIONS.es.md)

Scriptor 的实验性桌面集成将 Drive、Docs、Calendar、Tasks 和 Gmail 连接到本地笔记库。Markdown 文件仍是真实数据来源；远程更改需要审核后才能应用。连接账户不会自动同步整个笔记库。

## 设置与连接

打开 **Settings → Integrations**，填写 Google 桌面 OAuth 客户端的公开 ID，保存配置后再打开集成工作区。只使用 Drive 或 Gmail 时，可以保持 Calendar 同步关闭。

Google 项目必须启用所选服务的 API，并配置适用于已安装桌面应用的 OAuth 客户端。按 [Google 官方说明](https://developers.google.com/identity/protocols/oauth2/native-app)设置项目、同意页面和客户端。Scriptor 会打开系统浏览器请求授权。笔记库设置中只填写客户端 ID，不要填写客户端密钥或访问令牌。

连接相互独立：Drive 和 Docs 共用一个连接，Calendar 和 Tasks 共用另一个，Gmail 单独连接。连接需要使用的每一组服务，并核对显示的账户身份。Gmail 还需要启用其插件。令牌保存在操作系统钥匙串中；公开客户端 ID 和资源选择保存在笔记库配置中。

## 通过 Drive 或 Docs 共享 Markdown

从命令面板打开 **Drive collaboration**。浏览可访问的文件夹、手动输入文件夹 ID，或审核写入权限请求后创建文件夹。选择记录传输方式，然后点击 **Save folder and transport**，为当前笔记库保存选择。

Drive JSON 记录和不透明的 Google Docs 记录承载不可变的 Markdown 修订。Docs 记录格式保留 Markdown 字节，并不把文档变成富文本编辑器。应用到本地之前，请审核远程修订并解决冲突。共享修订是明确的远程写入操作。

普通 Google 文档可以在所选文件夹内浏览。转换为文本是独立流程，包含格式损失警告和内容审核。导出会创建新文档，不会替换已有富文本文档。这些 Markdown 记录不会复制媒体文件。传输格式、冲突处理和轮询限制见[协作契约](../validation/COLLABORATION_COMPLETION.md)。

## 使用 Calendar 和 Tasks 规划

在 Integrations 设置中发现日历和任务列表，选择目标资源并保存。无法发现资源时，仍可手动输入标识符。更改权限后请刷新连接。

Tasks 工作区显示本地任务和每周规划器。本地时间块在离线时仍可使用。Google Tasks 的截止日期不表示具体安排时间；有起止时间的时间块使用 Calendar 事件。选择笔记库任务，设定开始和结束时间，保存本地时间块。也可以明确映射一个已有的定时事件。

使用 **Review bidirectional sync** 比较已加载的远程数据、本地任务和已映射时间块，为每项更改选择同步方向。远程写入需要权限；修订冲突需要重新审核。只读日历可以查看和导入，但不能向其推送事件。审核范围是已加载的时间窗口和明确映射，不是全部 Google 事件。

## 使用 Gmail

启用 Gmail 插件并打开 **Gmail Manager**。搜索或刷新邮件、加载后续页，并选择邮件阅读纯文本。可见列表有数量上限；邮件超过上限时请缩小搜索范围。

导入会在原始笔记库中创建新的 Markdown 笔记。邮件文本会转义，避免被当作可执行的 Markdown 或 HTML 解释。导入不会覆盖已有目标。归档、移入垃圾箱和发送是需要审核的独立远程操作。撰写功能发送纯文本；拒绝权限或发送失败时，草稿会保留，方便修改或重试。

## 断开连接与恢复

断开连接会删除所选的本地凭据包，清除已准备的远程审核和账户专属缓存，不会删除本地笔记或时间块。事件映射不会在其他账户或日历中复用。已经提交给 Google 的请求可能在取消后完成；切换账户会阻止旧结果替换新工作区。

本地断开连接不会撤销 Google 对整个应用的授权。要撤销授权，请在 Google 账户中管理应用权限；这可能影响多个已连接服务。

| 问题 | 下一步 |
|---|---|
| 认证过期或需要认证 | 重新连接对应服务并刷新数据。 |
| 资源不存在或拒绝访问 | 核对账户、资源 ID 和共享权限，然后重新发现资源。 |
| 分页或资源发现失败 | 刷新后重新遍历；不接受不完整的发现结果。 |
| 设置尚未保存 | 使用工作区启动链接前保存配置。 |
| 远程修订已更改 | 重新获取，并在写入前准备新的审核。 |

这些集成仍处于实验阶段。浏览器测试夹具验证应用行为，不访问 Google 账户。真实 OAuth、共享云端硬盘权限以及打包后的桌面应用行为，需要单独进行服务和设备验证。支持状态见[能力成熟度记录](../CAPABILITY-MATURITY.md)，证据见[验证记录](../validation/GOOGLE-INTEGRATIONS-2026-10-09.md)。
