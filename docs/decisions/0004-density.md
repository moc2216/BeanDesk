# ADR 0004 · 界面密度

状态：已采纳（2026-11-26）

## 决策

- 设置 → 界面密度：舒适 / 紧凑，默认舒适；
- 只影响表格行高、表头高度、卡片内边距（含 KPI 与图表卡）；
- 选择写入 localStorage，重启保持。

## 影响

- `web/src/lib/density.ts` 与 `index.css` 的 `[data-density]` 规则；
- 新增卡片需加 `density-card` 类，否则紧凑模式不生效。
