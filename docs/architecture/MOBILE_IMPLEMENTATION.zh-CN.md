[English](MOBILE_IMPLEMENTATION.md) · [فارسی](MOBILE_IMPLEMENTATION.fa.md) · **简体中文** · [Русский](MOBILE_IMPLEMENTATION.ru.md) · [Deutsch](MOBILE_IMPLEMENTATION.de.md) · [Español](MOBILE_IMPLEMENTATION.es.md)

# 移动端实现与验证

移动应用使用共享编辑器和进程内 Rust 内核适配器。Vault 访问遵循移动端存储范围；笔记保存使用内容哈希和历史记录，而不是桌面守护进程。触控操作、文本方向和可恢复草稿均有针对性的浏览器测试覆盖。

Android ARM64 原生编译和调试打包已经验证。调试 APK 包含 `classes.dex`、`AndroidManifest.xml` 和 `lib/arm64-v8a/libscriptor_mobile_lib.so`；ZIP 完整性检查未报告损坏条目。调试包大小为 151,488,290 字节，其中包含一个大小为 144,335,032 字节、未剥离符号的原生库。这是开发制品，并非经过体积优化的发布包。

独立的包检查确认其中包含 AArch64 ELF64 原生库（ELF 机器类型 183）。Android 已安装的签名验证器接受该 APK，其采用 Signature Scheme v2 且有一个签名者。所检查 APK 的 SHA-256 为 `54eeb734857bce66273a2f30219e62dd1a85d2ee3fccb2d772a0a50a48d94e6e`；该值用于标识这个本地调试制品，并非发布证明。

标准 Android 命令在暂存原生库时遇到 Windows 符号链接权限限制。项目打包辅助工具可接收已编译的原生库，将其复制到生成的 ARM64 暂存路径，并使用项目自有的调试签名密钥调用生成的构建。它会验证目标路径、还原自身的进程环境、限制 worker 数量和内存使用，并保持全局 Android 密钥库不变。构建制品和本地调试密钥均由 Git 忽略。

当前没有连接 Android 设备。设备安装、生命周期和权限行为，以及已签名发布包的打包仍有待验证。iOS 编译和设备验证需要 Apple 工具链，本文不声称已在这台 Windows 主机上完成这些验证。
