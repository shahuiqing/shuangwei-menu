# 老板端账务系统优化执行计划

> 状态：Phase 1 / Phase 2 代码已完成（待执行 SQL 并验收）。本文档跟随仓库更新。

## 一、统一口径（所有报表必须一致）

| 指标          | 口径                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| 营收          | `status = 'completed'` 订单的 `COALESCE(finalTotal, total, total_amount)`                      |
| 订单数 / 销量 | 仅 `status = 'completed'` 且标记不在退款/赠送/员工餐/试菜内（AOV = 营收 ÷ 计入营收的完成单数） |
| 食材成本 COGS | 结账时写入 `orders."cogsSnapshot"`；旧单无快照时按当前配方估算                                 |
| 损耗          | `inventory_transactions.type = 'waste'`：`SUM(ABS(quantity) × unit_cost)`                      |
| 固定成本      | 月金额 ÷ 当月自然天数，按区间逐日摊派（跨月分别计算）                                          |
| 平台单        | 营收照常计入；佣金 = 平台营收 × 抽成率，在净利中扣减                                           |
| 净利          | 营收 − COGS − 损耗 − 区间固定成本 − 平台佣金                                                   |
| 对账          | 盘点窗口：真实 COGS = 期初 + 采购 − 期末；隐性损耗 = 真实 − 标准                               |

## 二、Phase 1（本次已实现）

- [x] `orders."cogsSnapshot"` 列 + `trg_order_cogs_snapshot`（结账时快照，改单/取消清空）。
- [x] `trg_order_bom_delete`：删除订单回冲库存与流水；`owner_prune` 归档时跳过回冲。
- [x] `owner_cost_summary(p_start, p_end)`：返回营收 / 快照 COGS / 损耗 / 平台营收。
- [x] `owner_sales_summary`、`owner_daily`、`owner_dish_stats`、`owner_hourly` 统一只统计 `completed` 且非退款/赠送/员工餐/试菜。
- [x] `owner_daily_profit` 优先使用成本快照。
- [x] `fixedCostForRange()`：区间固定成本逐月摊派 + 5 个单测。
- [x] 成本页：净利扣损耗/固定/佣金；盈亏平衡按区间日均；净利构成明细。
- [x] 成本对账：采购按盘点窗口查询（`fetchPurchasesBetween`），标准成本用同窗口快照 COGS。
- [x] Dashboard / 助手：订单数、AOV 使用计入营收的完成单。
- [x] 数据库未升级时自动回退旧口径并提示，不阻塞使用。

## 三、Phase 2（本次已实现）

- [x] 订单标记落库：`orders."orderTag"`，退菜/赠送/员工餐/试菜跨设备一致。
- [x] 报表口径：退款不计营收/成本；赠送/员工餐/试菜不计营收、成本仍计入。
- [x] 历史补录增加 `cogs`，成本趋势与成本页同步计入；旧库自动降级。
- [x] `analytics.orderTotal` 统一为 `finalTotal` 优先；`owner_dish_stats` 按订单实收比例分摊菜品营收（折扣不再导致菜品营收大于总营收）。
- [x] 支付方式报表：新增 `owner_payment_stats`，报表页展示占比。
- [x] 订单改价/删除/改状态写审计日志。
- [x] 导入订单写入 `orderTag` 与 `cogsSnapshot`。
- [x] 退菜单从理论消耗（`owner_consumption*`）中剔除，赠送/员工餐/试菜照常消耗。
- [x] 标记退菜时回冲库存；取消标记时重新扣减（`trg_order_tag_bom`）；SQL 首次执行会补回历史退菜单库存。
- [x] 升级前只存在浏览器里的订单标记，首次从数据库读取时会自动补写 `orderTag`，避免标记丢失。
- [x] 订单编辑/改状态不再覆盖 `timestamp`，避免历史订单被挪到当天；改价同步 `finalTotal`。
- [x] 补录按营业日匹配（修复跨时区 `toISOString().slice` 错一天/重复计入，02:59 归前一营业日）。
- [x] 统一营业日边界（03:00）：前端 `businessDay.ts` / `rangeToIso` / `rangeBounds` 与 SQL `owner_daily`、`owner_daily_profit`、`owner_consumption_daily` 的 3 小时偏移一致；跨零点订单归前一营业日。

## 四、Phase 3（P2）

- [ ] 采购价历史表（last_cost / 移动均价），替代直接用 `inventory.price`。
- [ ] 配方版本化，历史成本可追溯到当时的配方。
- [ ] 对账差异自动提醒（隐性损耗超阈值）。
- [ ] 财务报表导出（营收/成本/损耗/固定成本/净利）。

## 五、发布步骤

1. 在 Supabase SQL Editor 重跑 `supabase_owner_all.sql`（幂等）。
2. 校验：`SELECT proname FROM pg_proc WHERE proname LIKE 'owner\_%' ORDER BY 1;` 应返回 14 个函数。
3. 部署 `owner/`（`npm run build`）。
4. 打开成本页：黄色「未执行最新 SQL」提示应消失。
5. 完成一笔订单后检查：
   `SELECT id, status, "orderTag", "cogsSnapshot" FROM orders ORDER BY created_at DESC LIMIT 5;`
   completed 单的快照应 > 0（未配配方的菜品为 0）。
6. 给一笔订单标记「赠送」后刷新页面，标记应保留（已写入 `orderTag`）。

## 六、验收标准

- 近 7 天净利 = 营收 − COGS − 损耗 − 7 天固定成本 − 平台佣金。
- 跨月区间固定成本 = 各月（月额 ÷ 当月天数 × 覆盖天数）之和。
- 修改原料单价后，历史区间毛利不变；新结账订单按新价快照。
- 删除已完成订单后，相关原料库存回到删除前水平。
- 凌晨 00:00–02:59 的订单计入前一营业日；「今日」从 03:00 开始。
- 给退菜单取消标记后，库存恢复扣减；标记退菜后库存回冲。
- AOV = 区间营收 ÷ 区间计入营收的完成单数；取消单、退款单、赠送/员工餐/试菜不计入。
- 给订单标记「退菜」后，该单从营收与成本中同时消失，原料库存回冲；取消标记后库存重新扣减。
- 编辑历史订单金额/状态后，订单仍留在原营业日，不会跳到今天。
- 菜品/分类营收合计与区间营收一致（无历史补录、订单都有明细时）。
- 支付方式合计包含「历史补录」行，与区间营收一致（排除退款等非营收单）。
- 两次盘点后，对账使用盘点窗口的采购与标准成本，不再用页面区间充数。

## 七、回滚

- 前端可直接回滚（旧版不读新列/RPC）。
- 数据库可删除四个触发器（`trg_order_bom`、`trg_order_bom_delete`、`trg_order_cogs_snapshot`、`trg_order_tag_bom`）；`cogsSnapshot` / `orderTag` 列、`owner_cost_summary`、`owner_payment_stats` 保留无副作用。
