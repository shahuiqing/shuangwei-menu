# SQL 归档（sql-archive）

> 历史 SQL 脚本归档目录。这些脚本的内容**已全部并入**仓库根目录的 3 个权威初始化文件，
> 不再作为初始化入口，仅供排查历史用途或对比差异时参考。

## 当前权威脚本（按执行顺序）

1. `../supabase_schema.sql` — 顾客端基础表 + 基础 RLS
2. `../supabase_setup.sql` — 顾客端补充（anon 策略 / Storage / Realtime / 密码哈希）
3. `../supabase_owner_all.sql` — 老板端一键（库存 + BOM v2 + 聚合 RPC + 采购 + 上云/补录/导入）

## 归档文件与其归宿

| 归档文件                            | 归档原因 / 归宿                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `supabase_full_setup.sql`           | 旧版「统一初始化」，与 schema+setup 重叠，且 settings 仍含明文密码列（已过时）；被 `schema.sql`+`setup.sql` 取代 |
| `supabase_migration_orders_rls.sql` | 一次性增量迁移（orders UPDATE/DELETE RLS）；已并入 `setup.sql` 与 `owner_all.sql`                                |
| `supabase_inventory_bom.sql`        | BOM 扣减 v1（有加菜漏扣缺陷）；被 v2 取代                                                                        |
| `supabase_inventory_bom_v2.sql`     | BOM v2 对账式扣减；已并入 `owner_all.sql` 第 5 段                                                                |
| `supabase_owner_auth.sql`           | 老板端密码哈希；已并入 `owner_all.sql` 第 2 段                                                                   |
| `supabase_owner_inventory_rls.sql`  | 库存四表 anon RLS + 采购 RPC；已并入 `owner_all.sql` 第 3、4 段                                                  |
| `supabase_owner_quota.sql`          | orders 结账字段 + 聚合 RPC + 用量统计；已并入 `owner_all.sql` 第 1、6 段                                         |
| `supabase_owner_waste.sql`          | 报损 `reason` 列；已并入 `owner_all.sql` 第 1 段                                                                 |
| `supabase_owner_cloudsync.sql`      | 操作日志/盘点历史上云表；已并入 `owner_all.sql` 第 6.1 段                                                        |
| `supabase_owner_backfill.sql`       | 历史汇总补录表；已并入 `owner_all.sql` 第 6.2 段                                                                 |
| `supabase_owner_import.sql`         | 订单 CSV 导入 RPC；已并入 `owner_all.sql` 第 6.3 段                                                              |
