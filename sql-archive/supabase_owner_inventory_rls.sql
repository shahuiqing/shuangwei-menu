-- =============================================================
-- 老板端（anon）访问 库存/配方/采购/流水：RLS 策略 + 采购原子 RPC
-- 适用：supabase_inventory_bom.sql 之后执行。
-- 特点：幂等、仅动策略/新增函数，不删列、不改数据，可安全重复执行。
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
-- 采购原子入库 RPC：一次事务内完成
--   ① 写 purchase_orders  ② 库存增加并更新成本价  ③ 写 purchase_in 流水
-- 避免前端 3 次独立写库中途失败导致账实不符。
-- =============================================================
CREATE OR REPLACE FUNCTION public.owner_create_purchase(
  p_id text,
  p_supplier text,
  p_item_id text,
  p_item_name text,
  p_qty numeric,
  p_unit text,
  p_unit_price numeric,
  p_notes text,
  p_purchased_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_when timestamptz := COALESCE(p_purchased_at, now());
  v_unit text := COALESCE(NULLIF(p_unit, ''), 'kg');
BEGIN
  INSERT INTO public.purchase_orders
    (id, supplier, item_id, item_name, quantity, unit, unit_price, total_cost, purchased_at, notes, created_at)
  VALUES
    (LEFT(p_id, 100), COALESCE(p_supplier, ''), p_item_id, p_item_name,
     COALESCE(p_qty, 0), v_unit, COALESCE(p_unit_price, 0),
     COALESCE(p_qty, 0) * COALESCE(p_unit_price, 0), v_when, COALESCE(p_notes, ''), v_when);

  INSERT INTO public.inventory_items
    (id, name, category, stock, unit, safety_stock, price, updated_at)
  VALUES
    (p_item_id, p_item_name, '食材', COALESCE(p_qty, 0), v_unit, 0, COALESCE(p_unit_price, 0), now())
  ON CONFLICT (id) DO UPDATE
    SET stock = public.inventory_items.stock + COALESCE(p_qty, 0),
        price = CASE WHEN COALESCE(p_unit_price, 0) > 0
                     THEN p_unit_price ELSE public.inventory_items.price END,
        updated_at = now();

  INSERT INTO public.inventory_transactions
    (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
  VALUES
    ('TXN-' || md5(p_id || '|' || p_item_id), p_item_id, p_item_name, 'purchase_in',
     COALESCE(p_qty, 0), v_unit, COALESCE(p_unit_price, 0), p_id,
     CASE WHEN COALESCE(p_supplier, '') <> '' THEN '采购 · ' || p_supplier ELSE '采购入库' END,
     v_when);
END;
$$;

SELECT proname FROM pg_proc WHERE proname = 'owner_create_purchase';

-- =============================================================
-- 回滚（需要时取消注释执行）
-- =============================================================
-- DROP POLICY IF EXISTS "anon_all_inventory_items" ON public.inventory_items;
-- DROP POLICY IF EXISTS "anon_all_recipe_boms" ON public.recipe_boms;
-- DROP POLICY IF EXISTS "anon_all_purchase_orders" ON public.purchase_orders;
-- DROP POLICY IF EXISTS "anon_all_inventory_transactions" ON public.inventory_transactions;
