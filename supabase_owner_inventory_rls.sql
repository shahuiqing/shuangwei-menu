-- =============================================================
-- 老板端（anon）访问 库存/配方/采购/流水 的 RLS 策略
-- 适用：supabase_inventory_bom.sql 之后执行。
-- 特点：幂等、仅动策略，不删列、不改数据，可安全重复执行。
--
-- ⚠️ 安全提示：与 settings / orders 同为「纯静态前端 + Supabase 直连」
--    架构下的妥协：任何持有 anon key 的客户端都能读写库存与采购。
--    仅适用于内部 / 低风险场景。
--    更安全方案：库存写操作交由后端（service_role）边缘函数执行。
--
-- 注意：apply_order_bom 触发器为 SECURITY DEFINER，不受本策略影响。
--
-- 执行：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- =============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_items',
    'recipe_boms',
    'purchase_orders',
    'inventory_transactions'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%1$s" ON public.%1$s', t);
    EXECUTE format(
      'CREATE POLICY "anon_all_%1$s" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- 校验：四张表都应出现 anon_all_* 策略
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('inventory_items', 'recipe_boms', 'purchase_orders', 'inventory_transactions')
ORDER BY tablename, policyname;

-- =============================================================
-- 回滚（需要时取消注释执行）
-- =============================================================
-- DROP POLICY IF EXISTS "anon_all_inventory_items" ON public.inventory_items;
-- DROP POLICY IF EXISTS "anon_all_recipe_boms" ON public.recipe_boms;
-- DROP POLICY IF EXISTS "anon_all_purchase_orders" ON public.purchase_orders;
-- DROP POLICY IF EXISTS "anon_all_inventory_transactions" ON public.inventory_transactions;
