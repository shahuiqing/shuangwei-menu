-- =====================================================================
-- 双味居 · 老板端 · 损耗（报损）登记增量脚本
-- 幂等，可重复执行；也可直接执行 supabase_owner_all.sql（已包含本段）
-- 在 Supabase Dashboard → SQL Editor 粘贴运行即可
-- =====================================================================

-- 1. 报损原因分类：过期 / 做坏 / 出品不合格 / 丢失 / 其他
--    前端「损耗分析」按 reason 分组统计，历史行为空串，归入「其他」
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS reason VARCHAR(30) DEFAULT '';

-- 2. 损耗流水按时间倒序分页的复合索引
CREATE INDEX IF NOT EXISTS idx_inv_txn_waste
  ON public.inventory_transactions (type, created_at DESC);

-- 3. 刷新 PostgREST 缓存（可重复执行）
NOTIFY pgrst, 'reload schema';
