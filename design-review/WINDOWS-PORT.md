# BeanDesk Windows x64 移植记录

这次改动覆盖桌面进程托管、内置引擎和 restic、Windows 安装包与 CI。基线是 fork 的 5fc5124。Windows 验收由新增的原生 CI 作业和下文的实机步骤完成。

## 已确认的问题与修复

下表的行号指基线 5fc5124，可用 `git show 5fc5124:文件路径` 查看。

| 基线证据 | 影响 | 修复 |
| --- | --- | --- |
| engine/beandesk_engine.spec:50–51，engine/beandesk_engine.py:13–26 | Windows 冻结引擎使用 PyInstaller 的无控制台模式。该模式把 Python 的标准流设为 None，影响 bean-check 错误输出和 Fava 日志。 | 使用 CLI 引导程序保留标准流。桌面端以 CREATE_NO_WINDOW 运行引擎、restic 和账本检查。 |
| src-tauri/src/supervisor.rs:68–70、122–148、293–313 | taskkill 按父进程 PID 查找后代。父进程先退出时，reap 清掉了句柄，后代可能还在运行。桌面进程异常退出时也没有 Windows 端的清理机制。外部命令通过 .arg() 转义，带双引号的命令会用不适合 cmd.exe 的规则编码。 | 启动时挂起子进程，加入 Windows Job Object 后再恢复执行。停止、回收已退出的父进程和应用退出均关闭作业句柄。外部命令仍由 cmd.exe 执行，保留保存的引号并禁用 AutoRun。 |
| src-tauri/src/policy_integrity.rs:465–481 | 同一盘符路径的斜杠写法可能产生不同的规则审核键。扩展 UNC 路径在去前缀后也无法匹配普通 UNC 路径。新增回归用例先在基线上复现了盘符路径不等。 | 统一盘符大小写、分隔符和 UNC 前缀，保留目录组件原有大小写。Mac 上继续兼容 /private/ 路径别名。 |
| src-tauri/src/backup/settings.rs:786–793 | 测试把 /tmp 当作存在的绝对目录，在 Windows 会把它判为不可用。 | 使用系统临时目录构造测试数据。 |
| engine/build.sh:61–76，.github/workflows/release.yml:140–150 | 脚本允许两种引擎文件名，可能在 Windows 把缺少 .exe 的树判为构建成功。发布步骤把 Bash 交给默认 shell 查找，下载 restic 时又单独查找 Python。 | 在 Git Bash 下验证 beandesk-engine.exe 与 _internal 后再替换引擎目录。发布和 CI 显式使用 Bash 和已选定的 Python，Git 属性固定冻结、下载脚本及资产表为 LF。 |
| docs/sync.mjs:33–39 | 手册构建只检查子进程的整数退出码。Bun 启动失败或被信号终止时，脚本可能继续检查旧导出。 | 使用当前 Bun 的可执行路径启动子任务，明确传播启动失败和非零退出状态。 |

PyInstaller 的行为、cmd.exe 的引号规则与 Windows 作业对象的关闭语义见上游文档。[PyInstaller 标准流](https://pyinstaller.org/en/latest/common-issues-and-pitfalls.html) · [Microsoft cmd 命令](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd) · [Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)

src-tauri/tauri.conf.json:39–45 的目标列表可以共用。Tauri CLI 读取配置后，Bundler 的 Settings::package_types 会保留与目标平台匹配的类型。Windows x64 得到 NSIS，macOS 得到 app 和 dmg，Linux 得到 deb 和 appimage。CI 用共用配置直接打包。 [Tauri CLI 2.12.6 读取配置](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.6/crates/tauri-cli/src/bundle.rs#L171-L205) · [Bundler 按目标过滤](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.6/crates/tauri-bundler/src/bundle/settings.rs#L1059-L1096)

PyInstaller 6.22.3 在 Windows 自动给 EXE 名添加 .exe，默认使用 _internal 作为依赖目录。资源映射来自 src-tauri/tauri.conf.json:57–62。Windows 安装目录应包含 engine/beandesk-engine.exe、同级 engine/_internal/、restic/restic.exe 和 restic/LICENSE。运行时查找见 src-tauri/src/engine.rs:6–39 和 src-tauri/src/backup/restic.rs:25–54。restic 0.19.1 的 Windows x64 资产为 restic_0.19.1_windows_amd64.zip，固定 SHA-256 为 da948ad707ed690426473aaba2046cd61f8f90f6f0e7dab6be0d5796531de67d，下载脚本也检验 LICENSE。Mac 上用合成 ZIP 验证了 .exe、许可证落盘和摘要错误拦截。真实 Windows 资产下载和执行由 CI 验收。 [PyInstaller 6.22.3 产物命名](https://github.com/pyinstaller/pyinstaller/blob/v6.22.3/PyInstaller/building/api.py#L481-L497) · [restic 0.19.1 上游发布](https://github.com/restic/restic/releases/tag/v0.19.1)

审查也覆盖了托盘、窗口事件、单实例和文件锁。GUI 单实例由 Tauri 插件提供，mcp 入口在 GUI 初始化之前分流。窗口关闭隐藏，托盘退出通过 RunEvent::Exit 停止当前托管服务。连接日志使用 Rust 文件句柄，备份锁由 restic 和 libgit2 管理。Windows CI 会执行真实 restic 的备份、恢复和密钥轮转测试。窗口焦点、控制台闪烁、托盘和 Windows 文件占用行为还需要交互式实机检查。

## 在 Windows x64 上验证

准备 Git for Windows、PowerShell 7、MSVC C++ Build Tools 与 Windows SDK、Rust stable 的 x86_64-pc-windows-msvc 工具链、Bun 1.3.14、CPython 3.12 x64 和 WebView2 Runtime。在仓库根目录的 Git Bash 中执行以下命令。

~~~bash
set -e
rustc -vV
bun --version
python -c 'import platform, struct; assert platform.machine().lower() in ("amd64", "x86_64") and struct.calcsize("P") == 8'
(cd web && bun install --frozen-lockfile && bun run lint && bun test && bun run build)
(cd docs && bun install --frozen-lockfile)
PYTHON="$(command -v python)" bash engine/build.sh
PYTHON="$(command -v python)" bash engine/fetch-restic.sh x86_64-pc-windows-msvc
test -f src-tauri/binaries/engine/beandesk-engine.exe
test -d src-tauri/binaries/engine/_internal
test -f src-tauri/binaries/restic/restic.exe
(cd src-tauri && cargo check --locked && cargo test --locked)
bunx @tauri-apps/cli@2.12.6 build --ci
~~~

在仓库根目录的 PowerShell 7 中安装并检查产物。使用新的临时目录，便于同时覆盖带空格的程序和账本路径。

~~~powershell
$setups = @(Get-ChildItem .\src-tauri\target\release\bundle\nsis -Filter '*_x64-setup.exe')
if ($setups.Count -ne 1) { throw 'Expected one x64 installer' }
$run = Join-Path $env:TEMP ("BeanDesk smoke " + [guid]::NewGuid())
$install = Join-Path $run 'Program Files'
$ledgerDir = Join-Path $run '示例账套'
New-Item -ItemType Directory -Path $ledgerDir | Out-Null
$setup = Start-Process $setups[0].FullName -ArgumentList "/S /D=$install" -Wait -PassThru
if ($setup.ExitCode -ne 0) { throw "Installer exit code $($setup.ExitCode)" }
$ledger = Join-Path $ledgerDir 'main.bean'
Set-Content -Path $ledger -Encoding utf8 -Value 'option "title" "Windows smoke ledger"'
& (Join-Path $install 'engine\beandesk-engine.exe') check $ledger
if ($LASTEXITCODE -ne 0) { throw 'bean-check failed' }
& (Join-Path $install 'restic\restic.exe') version
if ($LASTEXITCODE -ne 0) { throw 'restic failed' }
Start-Process (Join-Path $install 'BeanDesk.exe')
~~~

1. 在设置选中测试账套目录，用“内置引擎”连接。访问 http://127.0.0.1:5000/，打开应用的报表和中英手册。退出之后，用 `Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue` 确认端口已释放。
2. 再次连接，关闭主窗口并从托盘唤回。服务应在窗口隐藏期间继续提供报表。重复启动 BeanDesk.exe，确认现有窗口被激活；再通过托盘“退出”离开。从开始菜单启动发行版时，连接、检查、备份和停止都应只显示应用自己的界面。
3. 在 PowerShell 中运行 `& (Join-Path $install "engine\beandesk-engine.exe") fava --host 127.0.0.1 --port 5001 $ledger`，独立启动另一个 Fava。将 BeanDesk 的连接地址改到该端口，连接后断开并退出。5001 上的原进程应仍在运行。另用“外部命令”模式执行带引号的绝对路径，验证 Fava 工作目录和停止操作。
4. 在单独的新目录初始化标准测试账套。配置同一盘符上独立于账套的本地备份目录，执行 Git 快照、加密备份、恢复到空目录、口令轮转和再次恢复。恢复后检查凭证与 main.bean，确认目标目录可移动。用英文和简体中文各查看一遍连接和备份状态。

## Mac 验证与待验项

| 命令 | 结果 |
| --- | --- |
| `cd src-tauri && cargo check && cargo test` | cargo check 通过。cargo test 共 154 项，143 通过、11 项因本机沙箱失败，退出码 101。基线有同样的 11 项失败。十项需要绑定回环端口（src-tauri/src/mcp/fava_tools.rs:451），一项调用 ps 枚举子进程（基线 src-tauri/src/supervisor.rs:482），均返回 Operation not permitted。 |
| `cd web && bun run lint && bun run build` | 两项通过，保留基线 React lint 和 Vite 大包警告。 |
| `cd web && bun test` | 191 项通过。 |
| `cd web && bun run ensure-docs` | 子进程已启动并报告构建失败。本机沙箱拦截 Turbopack 绑定端口，也无法访问 Google Fonts。使用已有的 Mac 静态导出重试，手册同步和输出比对通过。 |

Mac 上还用 Tauri CLI 2.12.6 和已有手册导出完成了桌面调试构建（`build --debug --no-bundle --ci`），并检查了 Bash 语法、PyInstaller spec 的 Python 语法、工作流 YAML 和 `git diff --check`。当前环境没有 Windows Rust 目标和离线依赖，Windows 专用代码、真实冻结、NSIS 安装和 GUI 行为尚未实跑。Windows 命令行使用了盘符、空格和中文目录的覆盖用例，SMB/UNC 文件系统访问及文件被其他程序占用时的体验留待实机验证。

## Windows 安装包发布清单

- Windows CI 通过 Web lint、测试、类型检查、构建，Rust check/test、冻结引擎启动和进程树停止测试全部通过。
- CI 用 NSIS 静默安装检查资源目录，并运行安装目录下的 bean-check 与 restic version。restic 应报告 0.19.1 和 windows/amd64。
- 在干净的 Windows x64 环境用普通用户安装，实测 WebView2、连接、报表、托盘、单实例、备份恢复及卸载。确认临时账套与凭证保留。
- 发布标签与 tauri.conf.json、web/package.json、src-tauri/Cargo.toml 的版本一致。检查草稿 Release 的 Windows 产物为 *_x64-setup.exe，记录该文件的 SHA-256。
- 确认 createUpdaterArtifacts 为 false，发布物和授权配置里没有更新清单、更新签名、更新端点或更新密钥。等发布矩阵全部通过和实机确认后再发布草稿。
