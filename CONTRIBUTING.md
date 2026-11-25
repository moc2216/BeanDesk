# Contributing

本仓库是 BeanDesk 的二次扩展（AGPL-3.0）。提交前请先读 `HANDOFF.md` 与 `docs/decisions/`。

## 每个改动的完成定义

1. 先写 5 条验收标准，其中至少 2 条覆盖状态（加载/失败/空/真零/无权限）；
2. 代码 + 测试 + 文档同一提交或同一 PR；
3. 改界面必须附浅色/深色截图；改颜色附对比度数值；
4. 改手册内容必须跑 `make docs-sync`，不要手改 `web/public/docs/`；
5. `bun run lint && bun test && bunx tsc -p tsconfig.app.json --noEmit` 全过。

## 提交信息

`type(scope): 一句话`，type 用 feat/fix/style/docs/test/chore；正文说明“为什么”，不要只写“改了什么”。

## 上游同步

```bash
git remote add upstream https://github.com/SuperDaniel-cn/BeanDesk
git fetch upstream && git merge upstream/main
```

冲突热点：`web/src/pages/Charts.tsx`、`web/src/components/time-filter-selector.tsx`、`docs/content/docs/**`。
合并后必须重跑测试与 docs-sync。

## 文档与版权

- 原作者章节与 README 不改；我们的变化写进 `secondary-development` 手册页与 `CHANGELOG.md`；
- 新增依赖需确认许可证兼容 AGPL-3.0；
- 不要移除 `NOTICE`、`LICENSE` 或原作者署名。
