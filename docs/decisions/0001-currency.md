# ADR 0001 · 货币符号与精度

状态：已采纳（2026-11-26）

## 背景

同一金额在中文界面显示 ¥、英文界面显示 CN¥；BTC 小额被固定两位小数压成 0.00。

## 决策

- 货币符号固定：CNY ¥、USD US$、HKD HK$、EUR €、JPY JP¥；
- 非货币单位一律“数字 + 代码”（BTC、USDT、AU9999、CN_510300）；
- BTC/ETH 最多 8 位小数，USDT/USDC 2 位；未知单位保留 8 位；
- 汇总可舍入，但不得把非零显示为零。

## 影响

- `web/src/lib/format.ts` 是唯一入口；
- 改精度必须更新 `format.test.ts`；
- 表格对齐依赖 tabular-nums，不因精度变化改列宽逻辑。
