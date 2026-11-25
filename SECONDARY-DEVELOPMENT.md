# 二次开发说明 / Secondary development

本仓库基于 [BeanDesk](https://github.com/SuperDaniel-cn/BeanDesk)（作者 **SuperDaniel-cn**，**AGPL-3.0**）做二次扩展。
原始项目的构思、章节与版权声明保持不动；本文件与手册中的「二次开发说明」页只记录我们新增/修改的部分。

This repository is a derivative of [BeanDesk](https://github.com/SuperDaniel-cn/BeanDesk) by **SuperDaniel-cn**, licensed **AGPL-3.0**.
The original design notes, chapters and notices are left intact; this file and the handbook page only document our changes.

## 变更范围 / Scope

| 模块 | 变化 |
|---|---|
| 会计期间 | 单一期间面板（年/季/月/自定义区间）、先选后应用、筛选时常驻显示、日历左侧 FilterX 清除按钮 |
| 图表 | 净值/现金流/储蓄/构成/收款方趋势；资产配置三种维度；类别稳定配色；可折叠明细；空态/失败态/未折算警告 |
| 金额 | 固定货币符号（¥ / US$）；加密货币按单位保留精度；真零、无数据、无定义三态分离 |
| 界面 | 统一表格样式与字号；舒适/紧凑密度；轴字与树图标签对比度；减少动效 |
| 无障碍 | 期间弹窗焦点锁定；图表明细可键盘读取；手册 Esc 关闭 |
| 投资组合 | 目标占比、快速全选/清空、独立区块 |
| 工程 | 191 项单元测试；tsc/lint；手册构建与注入 |

## 文档位置 / Where to read

- 中文手册：`docs/content/docs/secondary-development.zh-CN.mdx`
- English handbook: `docs/content/docs/secondary-development.mdx`
- 版权与归属：`NOTICE`、`LICENSE`

## 许可 / Licence

本仓库的修改同样以 **AGPL-3.0** 发布。分发时请保留：

1. `LICENSE`；
2. `NOTICE` 与原始作者署名；
3. 本文件与手册中的二次开发说明。

All modifications are released under **AGPL-3.0**. Redistributions must keep `LICENSE`, `NOTICE`, the original attribution, and this document.
