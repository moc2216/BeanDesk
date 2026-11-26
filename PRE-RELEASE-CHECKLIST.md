# 开源发布前检查清单

> 这些项涉及账号、版本与分发身份，我没有擅自改。上传前逐项确认。

## 0. 状态（2026-11-26）

- 远程仓库已建立：https://github.com/moc2216/BeanDesk（当前私有，待转公开）；
- `origin` 指向新仓库，`upstream` 保留原作者仓库；`main` 已推送；
- 首次 CI 全绿：web、docs、rust、windows；windows 作业完成 NSIS 打包、静默安装与安装目录内 `bean-check` / `restic version` 校验。

## 1. 仓库与远端

- [x] 在 GitHub 新建自己的仓库（不要直接 push 到 `SuperDaniel-cn/BeanDesk`）；
- [x] `git remote set-url origin <你的仓库>`；确认 `git push` 成功；
- [x] 保留 `NOTICE`、`LICENSE`、原作者署名与二次开发说明。

## 2. 版本与更新源（已按你的决定处理）

已确定并落地（2026-11-26）：

- 版本升至 `0.3.0`（`tauri.conf.json`、`web/package.json`、`src-tauri/Cargo.toml` 三处一致）；
- **关闭自动更新**：移除 updater endpoint 与原作者公钥、移除插件初始化与 `updater:default` 能力、`createUpdaterArtifacts: false`、发布流程不再要求签名密钥；设置页不再显示「检查更新」；
- `identifier` 保留 `app.beandesk.desktop`：它只是应用数据目录与系统标识，保留可延续本机账本连接与设置，不影响开源署名。

仍需你执行：新建仓库后改 `origin`（见第 1 节）。

将来要恢复自动更新：重新加入插件与 endpoint，用 `tauri signer generate` 生成自己的密钥，把公钥写入配置、私钥放 CI secret，然后把 `web/src/components/app-update.tsx` 的 `UPDATES_ENABLED` 改为 `true`。

## 3. 合规

- [ ] `NOTICE` 写明衍生关系与修改日期；
- [ ] 发布页提供对应源码标签与构建脚本（AGPL-3.0 第 6 条）；
- [ ] 不删除原作者版权声明；新增依赖许可证兼容 AGPL。

## 3b. 双平台产物

- [ ] GitHub Actions `windows` 作业通过（Web + Rust + 冻结引擎 + NSIS 安装校验）；
- [ ] 发布草稿同时含 `*_x64-setup.exe`（Windows）与 `.dmg`（macOS），记录各自 SHA-256；
- [ ] Windows 实机验收按 `design-review/WINDOWS-PORT.md` 第 2 节执行（连接、报表、托盘、单实例、备份恢复、卸载）。

## 4. 文档

- [ ] `make docs-sync` 后，手册含「二次开发说明」（中英）；
- [ ] 二次开发页注明：本分支不含日历页；FilterX 清除按钮为最终行为；
- [ ] README 是否加一行 fork 说明——由你决定（当前未改原作者 README）。

## 5. 清理

- [ ] `design-review/` 是否随仓库公开：公开可体现过程，但含内部评审；也可移到 `docs/design/` 或加 `.gitignore`；
- [ ] 确认没有密钥、个人路径、账本数据进入提交；
- [ ] 运行 `git status`，确认只包含预期文件。
