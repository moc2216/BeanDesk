# 开源发布前检查清单（需你拍板/执行）

> 这些项涉及账号、版本与分发身份，我没有擅自改。上传前逐项确认。

## 1. 仓库与远端

- [ ] 在 GitHub 新建自己的仓库（不要直接 push 到 `SuperDaniel-cn/BeanDesk`）；
- [ ] `git remote set-url origin <你的仓库>`；确认 `git push` 成功；
- [ ] 保留 `NOTICE`、`LICENSE`、原作者署名与二次开发说明。

## 2. 版本与更新源（必须处理）

当前 `src-tauri/tauri.conf.json`：

- `version: 0.2.9`（与上游同号）；
- `identifier: app.beandesk.desktop`（上游标识）；
- updater endpoint 指向 `https://github.com/SuperDaniel-cn/BeanDesk/releases/latest/download/latest.json`；
- updater 公钥为原作者密钥。

三选一：

1. **推荐**：版本升 `0.3.0`；关闭 updater（移除 endpoints / 不启用插件），发布页手动更新；
2. 配置自己的 endpoint 与新密钥（`tauri signer generate`），保留自动更新；
3. 保持现状（仅限私有使用，不建议公开分发）。

identifier 二选一：保留（延续本机数据）或改为自己的反向域名（新应用数据目录，需重新连接账本）。

## 3. 合规

- [ ] `NOTICE` 写明衍生关系与修改日期；
- [ ] 发布页提供对应源码标签与构建脚本（AGPL-3.0 第 6 条）；
- [ ] 不删除原作者版权声明；新增依赖许可证兼容 AGPL。

## 4. 文档

- [ ] `make docs-sync` 后，手册含「二次开发说明」（中英）；
- [ ] 二次开发页注明：本分支不含日历页；FilterX 清除按钮为最终行为；
- [ ] README 是否加一行 fork 说明——由你决定（当前未改原作者 README）。

## 5. 清理

- [ ] `design-review/` 是否随仓库公开：公开可体现过程，但含内部评审；也可移到 `docs/design/` 或加 `.gitignore`；
- [ ] 确认没有密钥、个人路径、账本数据进入提交；
- [ ] 运行 `git status`，确认只包含预期文件。
