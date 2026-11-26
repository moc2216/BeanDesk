# 代码审查 · 2026-11-26

审查人：NOMOS（OpenClaw）。审查对象不是 Codex 的自评，而是仓库里的实际代码。

## 范围与方法

| 项目 | 内容 |
|---|---|
| 提交 | `5fc5124`（0.3.0 / 关闭更新通道）、`2834035`（Windows 支持）；并抽查前 44 个提交中的金额、期间、图表逻辑 |
| 基线 | 上游 `c9b7249` |
| 方法 | 逐行读 diff、追调用链、跑测试与静态检查、YAML/JSON 解析、文档与实现一致性检索 |
| 未覆盖 | Windows 真机与 NSIS 实跑（本机无环境）；119 个改动文件未逐行通读，聚焦高风险路径 |

## 结论

**没有发现阻断发布的代码缺陷。** Windows 进程托管的核心设计是对的：挂起创建 → 加入 Job Object → 恢复执行，避免“进程已跑、作业还没接管”的竞态；错误路径都会关闭句柄。发布前需要处理的是发布卫生与文档一致性，不是功能正确性。

## 发现

### P1 · 发布卫生（建议上传前处理）

1. **`.github/workflows/updater-notes.yml` 已是死工作流**：它只在 Release 含 `latest.json` 时触发，而本分支 `createUpdaterArtifacts: false`，永远不会产出该文件。已删除，避免让人误以为还有更新通道。
2. **`.github/FUNDING.yml:3` 仍指向原作者赞助页**：在你自己的仓库上会出现“Sponsor”按钮，但收款方是上游作者。建议删除或改成你自己的赞助方式。
3. **`src-tauri/Cargo.toml:6` 的 `repository` 仍指向上游**：包元数据会误导。建好自有仓库后改成新地址。

### P2 · 行为与文档

4. **【已修】手册与实现冲突**：`docs/content/docs/desktop.mdx:37` 与 `desktop.zh-CN.mdx:37` 原文写“设置 → 关于 可检查更新”，但更新通道已经移除。已改为“本构建不含自动更新，覆盖安装升级，连接与设置保留”；About 行的 “software updates” 也一并去掉。
5. **Windows 停止语义变强硬**：原实现 `taskkill /T`（先礼后兵），新实现关闭 Job 即强杀。对 Fava 没问题，但如果用户保存的命令用 `start` 派生进程，shell 退出后的 `reap()` 会连带杀掉后代——以前会留下。这是有意的可靠性取舍，但应写进手册，避免“为什么我的服务被带走了”的疑问。
6. **恢复暂存目录名可预测（上游既有，非本次引入）**：`src-tauri/src/backup/restic.rs:549` 用 `.beandesk-restore-{pid}`，并且先 `remove_dir_all`。同一父目录下恰好存在同名目录时会被删除；概率低，但属于可以避免的破坏性操作。建议随机后缀 + `create_dir` 失败即报错。
7. **手册仍暴露已移除的日历页**：`docs/content/docs/index.mdx:24` 的 Calendar 卡片、`meta.json:11` 的 `calendar` 导航都在，但本分支已移除日历页。因“原作者章节不动”的约定，我没有擅自删除。建议二选一：删卡片与导航，或在日历页首加一行“上游功能，本分支未包含”。

### P3 · 小问题

8. `policy_integrity.rs` 的 `comparable_key` 对盘符相对路径（`c:Books`）不再统一盘符大小写。正常路径会先 `canonicalize`，影响极小。
9. 前端仍保留 `@tauri-apps/plugin-updater` 依赖与组件（`UPDATES_ENABLED = false` 关闭）。属死代码，可后续清理。
10. `formatCurrency` 用 ASCII `-`，`formatSignedCurrency` 用 U+2212 `−`，同一界面可能混用两种负号。
11. `NOTICE` 原缺修改日期，已补 `Modifications: 2026-11-26`（AGPL 要求声明改动日期）。

## 验证记录

| 检查 | 结果 |
|---|---|
| `cargo check` | 通过 |
| `cargo test` | 154 通过 / 0 失败 |
| `bun test` | 191 通过 / 0 失败 |
| `tauri build --bundles app` | exit 0，150.32 MiB |
| Windows 专用模块 | 在 `x86_64-pc-windows-msvc` + edition 2024 单独编译通过（含 Job Object 全部 API） |
| 工作流 YAML / 配置 JSON | 解析通过 |

**仍未验证**：NSIS 安装、托盘、单实例、WebView2、文件占用行为；`windows` CI 作业尚未在远端实际执行。这是发布前唯一必须补的实证。

## 本次审查改动的文件

- `docs/content/docs/desktop.mdx`、`desktop.zh-CN.mdx`：更新说明与实现对齐；
- `NOTICE`：补修改日期；
- 本文件。

其余发现保持原样，等你决定（尤其是删除 FUNDING / 死工作流、处理日历入口）。
