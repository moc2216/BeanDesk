# HANDOFF · BeanDesk 二次开发交接

> 目标：半年后回来，读三份文件就能继续，不重复踩坑。
> 先读：`SECONDARY-DEVELOPMENT.md`（改了什么）→ 本文件（现状/坑/怎么跑）→ `docs/decisions/`（为什么这么做）。

## 0. 一句话状态

基于原作者 BeanDesk（AGPL-3.0）的二次扩展，已完成设计体系、会计期间、图表可读性、金额精度、密度、无障碍、品牌图标与开源说明；版本 `0.3.0`；已关闭自动更新（无 endpoint、无签名）；`identifier` 保留 `app.beandesk.desktop`。当前开发分支 `ui/report-refine-2026-11-28`，`main` 未合并；最新提交见 `git log -1`。

- 远程：`moc2216/BeanDesk`（私有，待转公开）；`origin` 指向它，`upstream` 指向上游。

## 0.1 版本快照与回滚（2026-11-28）

- 标签：snapshot/design-2026-11-28（附注标签，指向本文件所在提交）；
- 内容：暖白画布 #FAFAF8、高彩度等明度数据色、报表摘要带 + 右栏、12px 圆角、
  树图图例、ADR 0007；CI 的 web/docs/rust/windows 全部通过；
- 回滚到该版本：
  git fetch --tags
  git checkout snapshot/design-2026-11-28
  或丢弃当前改动：
  git reset --hard snapshot/design-2026-11-28
- 桌面包：src-tauri/target/release/bundle/macos/BeanDesk.app（2026-11-28 10:02 构建）；
- 该标签用于回滚，不要移动或复用；后续重要节点另打新标签。

## 0.2 品牌与「关于」页（2026-11-28）

- 图标：`src-tauri/icons/` 全套由「豆与账线」1024 主图生成（`bunx @tauri-apps/cli icon`），Dock、Finder、窗口与 favicon 统一为蓝底奶白豆 + 向上账线；`web/src/components/brand-mark.tsx` 为同一几何的应用内标记。
- 托盘：macOS 用 `src-tauri/icons/tray.png`（72×72 黑色单色），`tray.rs` 对它保留 `.icon_as_template(true)`，否则深色菜单栏下不可见；Windows 不支持 template，改用彩色 `src-tauri/icons/tray-windows.png`（蓝色豆 + 白缝，64×64），`icon_as_template(false)`，否则灰豆在灰色任务栏上不明显。
- 「关于」页：删除原作者博客入口与 `AUTHOR_BLOG_URL`；改为「本项目核心特征 + 与 Beancount 的关系 + 打开手册查看致谢」，文案键 `settings.aboutBlurb/aboutBeancountTitle/aboutBeancount/aboutAttribution`（中英各一份）。
- 手册：原始项目与致谢放在 `docs/content/docs/index.mdx` 与 `index.zh-CN.mdx` 首个 Callout（SuperDaniel-cn + `github.com/SuperDaniel-cn/BeanDesk` + AGPL-3.0），不要移回「关于」页。
- 本机已替换 `/Applications/BeanDesk.app`（0.3.0，2026-11-28 12:32）；旧包在 `~/.Trash/BeanDesk-before-tray2-2026-11-28.app`。
- 提交：`60f5ef9 feat(brand): bean app icon, template tray icon, and Beancount-centered About page`（已推送）。

## 0.3 显示缩放（2026-11-28）

- 范围 70%–250%，步进 10%，默认 100%；快捷键 `Cmd/Ctrl +`、`-`、`0`，菜单栏「显示 → 放大/缩小/实际大小」。
- 实现：Rust `UiZoom` 状态 + `set_ui_zoom` 命令，对全部 webview 调 `set_zoom`；手册窗口在 `on_page_load` 自动继承；前端 `web/src/lib/ui-zoom.ts` 负责持久化（`beancount-ui-zoom`）与界面状态，`UiZoomController` 监听菜单事件。
- **权限坑**：新增命令必须同时写入 `src-tauri/build.rs` 的 `commands` 列表与 `capabilities/default.json` 的 `allow-set-ui-zoom`，否则 invoke 静默失败（表现为菜单能改百分比、界面不动）。
- 设置 → 常规 → 显示大小 提供 −/+ 与重置；与「界面密度」独立叠加。
- 已验证：原生菜单/快捷键改到 130%、250% 时导航折叠为汉堡菜单、70% 与 250% 可滚动；`cargo test` 153 项、`bun test` 196 项通过。

## 1. 快速启动

```bash
make install
make dev                 # 前端 http://127.0.0.1:5173（或项目默认端口）
make desktop             # Tauri 桌面
cd web && bun test       # 191 项单测
cd web && bunx tsc -p tsconfig.app.json --noEmit
make docs-sync           # 手册导出到 web/public/docs
```

构建桌面：`bunx @tauri-apps/cli build --bundles app`。
注意：`--bundles dmg` 在无人值守环境可能卡住（挂载镜像），日常验证只用 app。

## 2. 架构地图

| 路径 | 作用 |
|---|---|
| `web/src/pages/` | 报表、图表、日记账、设置 |
| `web/src/components/` | 期间选择器、表头、图表容器、UI 原语 |
| `web/src/lib/` | 格式化、账本模型、图表主题、密度、i18n |
| `src-tauri/` | Rust 外壳、引擎、手册窗口、备份、MCP |
| `src-tauri/src/process.rs` | 子进程启动：Windows Job Object、无窗口标志 |
| `engine/restic-assets.txt` | restic 各平台资产与 SHA-256（脚本与测试共用） |
| `docs/content/docs/` | 手册源文件（中英各一份） |
| `web/public/docs/` | 手册导出（生成物，git 忽略） |
| `design-review/` | 本次设计评审与复盘材料（非发布物） |

## 3. 关键决策（读 ADR）

- `docs/decisions/0001-currency.md`：固定货币符号与加密精度；
- `docs/decisions/0002-palette.md`：分类色按类别键绑定、对比度门槛；
- `docs/decisions/0003-period.md`：先选后应用、顶栏四图标、FilterX 清除；
- `docs/decisions/0004-density.md`：舒适/紧凑，记住选择；
- `docs/decisions/0005-docs-licence.md`：保留原作者内容，二次开发单开章节；
- `docs/decisions/0006-accessibility.md`：焦点锁定、图表明细、减少动效。

## 4. 容易踩的坑

1. **`web/public/docs/` 是生成物**：不要手改；改 `docs/content/docs/*.mdx` 后 `make docs-sync`。
2. **期间弹窗的焦点**：`DialogContent` 上不要加 `onOpenAutoFocus={preventDefault}`，会破坏焦点锁。
3. **图表色**：`CATEGORY_COLORS` 以 `assetClass:*` / `expense:*` 为键；不要按数组下标取色，否则换期间会换色。
4. **KPI 三态**：加载/失败/真零必须分开；失败时储蓄率显示 `—`，不能是 `0.0%`。
5. **金额精度**：`formatCurrency` 对 BTC/ETH 最多 8 位、USDT/USDC 2 位；改精度先跑 `format.test.ts`。
6. **顶栏**：四个纯图标固定；`FilterX` 只在有筛选时出现在日历左侧（右对齐，不影响其它图标位置）。
7. **引擎**：桌面端 Fava 在 `:5000`；引擎没起时图表页显示“需要账本引擎”，这是预期。
8. **Codex CLI**：本机需 0.172+ 才有 gpt-6.2 元数据；旧版会 warning 并退化。
9. **dmg 打包**：无 Finder 会话时可能挂起，用 `--bundles app`；确认没有残留挂载卷。

## 5. 验证方法（可复用）

- 失败态：`FAVA_URL=http://127.0.0.1:5999` 起 dev server，看 KPI 是否全 `—`；
- 空期间：seed `beancount_time_filter=2019-Q1`，看真零与“本期没有资产/支出数据”；
- 未折算：`/tmp` 建 CNY+USD 无报价账本，`fava -p 15000`，`FAVA_URL` 指向它；
- 键盘焦点：Edge `--remote-debugging-port` + CDP `Input.dispatchKeyEvent`，断言 `activeElement.closest('[data-slot=dialog-content]')`；
- 截图：`--headless=old --force-device-scale-factor=2`。

## 6. 尚未做 / 下一步

见 `DEVELOPMENT-OPTIMIZATION-PLAN.md`：CI、Playwright 冒烟、视觉回归、token 单一来源、上游同步节奏。

## 7. 交付检查清单

- [ ] `bun test`、`tsc`、`lint` 通过；
- [ ] `make docs-sync` 后手册含「二次开发说明」；
- [ ] `NOTICE`、`LICENSE`、`SECONDARY-DEVELOPMENT.md` 存在；
- [ ] 上游 remote 与合并策略明确；
- [ ] 新增决策写入 `docs/decisions/`，不要只留在聊天里。

## 8. Windows（x64）

- 代码已支持 Windows：进程树用 Job Object（`CREATE_SUSPENDED` 后加入作业再恢复），引擎/restic 按 `.exe` 解析，规则审核键统一盘符与 UNC 写法；
- CI 新增 `windows` 作业：Web lint/test/build、Rust test、冻结引擎、`restic.exe`、NSIS 静默安装与安装目录内 `bean-check`/`restic version` 校验；
- 改动清单、实机验证步骤与未验证项：`design-review/WINDOWS-PORT.md`；
- **尚未实机验证**：托盘、单实例、窗口焦点、控制台是否闪烁、文件占用提示。发布前需在一台干净的 Windows x64 上按该文档第 2 节走一遍。

## 9. 2026-11-29 暂停点

- 分支：`ui/report-refine-2026-11-28`；HEAD `363a04c`；未合并 `main`。
- 最新 Windows 安装包：`/Users/salt/Downloads/BeanDesk_0.3.0_x64-setup-363a04c.exe`；SHA-256 `609626c463cee03e913653654f4387d290e2e9dca4d3022af5c9aa567ec71496`；CI run `46161726605` 全绿。
- Windows 回归测试数据：`/Users/salt/Desktop/BeanDesk-Windows-TestData.zip`；合成账本 2025-01 至 2026-11，CNY/USD/HKD、投资/房产/贷款/信用卡/税费；`bean-check` 与内置引擎均 0 错误。
- Windows 修复：移除 Windows 原生菜单栏（File/Edit/View/Window/Help）；托盘改用彩色豆；`Ctrl +/-/0` 由前端快捷键处理。
- 性能优化：报表页与 Settings 懒加载；ECharts 改为 `echarts/core` 按需注册（Charts chunk 1.15 MB → 664 KB）；拼音搜索改为聚焦搜索框时才加载（TrialBalance chunk 296 KB → 9.5 KB）；首屏脚本实测约 703 KB（原 2.29 MB）。
- 启动日志：`[startup] bundle/shell/handbook`，从导航开始计时，写入控制台与 `BeanDesk.log`；Mac 实测 2026-11-29 00:07：bundle 23ms、shell 197ms、handbook 199ms；Windows 待采集。
- Mac 安装：2026-11-29 00:07 已替换 `/Applications/BeanDesk.app`（0.3.0，pid 55621），旧包在 `~/.Trash/BeanDesk-old-2026-11-29.app`；窗口标题「经营账本」正常。
- 仍有：41 条 lint warning（0 error）、未签名安装包、依赖补丁未升级、Windows 实机托盘/单实例/焦点/备份恢复/卸载验收。
- 恢复开发先读：本文件、`design-review/WINDOWS-PORT.md`、`DEVELOPMENT-OPTIMIZATION-PLAN.md`。
