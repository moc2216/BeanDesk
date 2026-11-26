# HANDOFF · BeanDesk 二次开发交接

> 目标：半年后回来，读三份文件就能继续，不重复踩坑。
> 先读：`SECONDARY-DEVELOPMENT.md`（改了什么）→ 本文件（现状/坑/怎么跑）→ `docs/decisions/`（为什么这么做）。

## 0. 一句话状态

基于原作者 BeanDesk（AGPL-3.0）的二次扩展，已完成设计体系、会计期间、图表可读性、金额精度、密度、无障碍与开源说明；版本 `0.3.0`；已关闭自动更新（无 endpoint、无签名）；`identifier` 保留 `app.beandesk.desktop`。当前分支 `main`，最新提交见 `git log -1`。

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

## 7. Windows（x64）

- 代码已支持 Windows：进程树用 Job Object（`CREATE_SUSPENDED` 后加入作业再恢复），引擎/restic 按 `.exe` 解析，规则审核键统一盘符与 UNC 写法；
- CI 新增 `windows` 作业：Web lint/test/build、Rust check/test、冻结引擎、`restic.exe`、NSIS 静默安装与安装目录内 `bean-check`/`restic version` 校验；
- 改动清单、实机验证步骤与未验证项：`design-review/WINDOWS-PORT.md`；
- **尚未实机验证**：托盘、单实例、窗口焦点、控制台是否闪烁、文件占用提示。发布前需在一台干净的 Windows x64 上按该文档第 2 节走一遍。
