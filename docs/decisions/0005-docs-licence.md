# ADR 0005 · 文档与许可

状态：已采纳（2026-11-26）

## 背景

本项目是原作者 BeanDesk 的二次扩展，AGPL-3.0。

## 决策

- 原作者的 README、手册章节、版权声明不改；
- 二次开发内容单独成页（中英），并在 NOTICE 中声明衍生关系；
- 所有修改同样以 AGPL-3.0 发布；分发保留 LICENSE、NOTICE、署名；
- 手册源在 `docs/content/docs/`，导出到 `web/public/docs`（生成物，不手改）。

## 影响

- 功能 PR 必须同步更新二次开发说明页；
- 上游合并时优先保留原文章节，冲突集中在 Charts、time-filter、docs。
