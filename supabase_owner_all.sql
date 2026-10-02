-- =============================================================================
-- 老板端「一次性」初始化脚本（幂等，可重复执行）
-- -----------------------------------------------------------------------------
-- 用途：把老板端所需的 表/列/RLS/函数/触发器 一次性建好，
--       解决「数据库缺少聚合函数」等问题。
--
-- 执行方式：
--   Supabase Dashboard → SQL Editor → 新建查询 → 全选粘贴本文件 → Run
--
-- 前置：顾客端 App 能正常使用（说明基础表 orders / settings 已存在）。
-- 本脚本也会顺带创建库存相关表（若不存在）。
--
-- 说明：所有语句均可重复执行，不会重复建对象、不会删数据。
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. 库存相关基础表（若顾客端已建则跳过）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT '常规物料',
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  safety_stock DECIMAL(10, 2) NOT NULL DEFAULT 5,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recipe_boms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_name VARCHAR(100) NOT NULL,
  inventory_item_id VARCHAR(50) REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  dosage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  supplier VARCHAR(100) DEFAULT '',
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id VARCHAR(100) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'adjustment'
    CHECK (type IN ('purchase_in', 'order_out', 'adjustment', 'waste')),
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reference VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recipe_boms ADD COLUMN IF NOT EXISTS station VARCHAR(50) DEFAULT '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. orders 字段 + 索引
-- 关键修复：顾客端在空表时会用硬编码列清单（含 customerName / timestamp），
-- 表里若缺这两列，PostgREST 会以 PGRST204 拒绝插入，导致订单永远写不进库。
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "customerName"   TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "timestamp"      TIMESTAMPTZ;
-- 顾客端 normalizeOrder 会带这些别名/标记列；缺任一列 PostgREST 都会 400 拒绝整条插入
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "createdAt"          TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "tableNo"            TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "unprintedNewOrder"  BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "unprintedAdditions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentMethod"  TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "receivedAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "finalTotal"     NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "completedAt"    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_completed    ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_created     ON public.inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item        ON public.inventory_transactions (item_id, type);
CREATE INDEX IF NOT EXISTS idx_inv_txn_ref         ON public.inventory_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_bom_name            ON public.recipe_boms (menu_item_name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 老板端登录密码哈希（初始 123456，登录后请尽快修改）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "ownerPasswordHash" TEXT DEFAULT '';
UPDATE public.settings
SET "ownerPasswordHash" = '$2b$10$HZU6z.ZHMcY46zBQM9R/kedujlwguLBtKzG4g8II9doyRQF5AOhP.'
WHERE id = 'global' AND COALESCE("ownerPasswordHash", '') = '';

-- 允许匿名读取 settings（顾客端/老板端读取菜单、店名等；幂等，与 setup.sql 一致）
DROP POLICY IF EXISTS "anon_read_settings" ON public.settings;
CREATE POLICY "anon_read_settings" ON public.settings FOR SELECT USING (true);

-- orders 的 anon 读/写策略（老板端只读、顾客端下单必需；幂等）
-- 若缺失，订单虽然能写入却读不出来，老板端会一直是空的。
DROP POLICY IF EXISTS "anon_read_orders" ON public.orders;
CREATE POLICY "anon_read_orders" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON public.orders;
CREATE POLICY "anon_insert_orders" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON public.orders;
CREATE POLICY "anon_update_orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON public.orders;
CREATE POLICY "anon_delete_orders" ON public.orders FOR DELETE USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO anon, authenticated;
GRANT SELECT ON public.settings TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. 库存/配方/采购/流水 的 anon 访问策略（与现有 settings/orders 口径一致）
--    ⚠️ 内部/低风险场景适用；更强隔离应改为后端 service_role
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_boms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items','recipe_boms','purchase_orders','inventory_transactions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "anon_all_%1$s" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 表权限（若为新建表，确保 anon 可读写）
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.inventory_items, public.recipe_boms, public.purchase_orders, public.inventory_transactions
  TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 采购原子入库 RPC（采购单 + 库存 + 流水 一次事务完成）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_create_purchase(
  p_id text, p_supplier text, p_item_id text, p_item_name text,
  p_qty numeric, p_unit text, p_unit_price numeric, p_notes text, p_purchased_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
        price = CASE WHEN COALESCE(p_unit_price, 0) > 0 THEN p_unit_price ELSE public.inventory_items.price END,
        updated_at = now();

  INSERT INTO public.inventory_transactions
    (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
  VALUES
    ('TXN-' || md5(p_id || '|' || p_item_id), p_item_id, p_item_name, 'purchase_in',
     COALESCE(p_qty, 0), v_unit, COALESCE(p_unit_price, 0), p_id,
     CASE WHEN COALESCE(p_supplier, '') <> '' THEN '采购 · ' || p_supplier ELSE '采购入库' END, v_when);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 结账自动扣库存（BOM v2 对账式，兼容加菜/改单/合并/取消）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_order_bom(p_order_id text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  WITH desired AS (
    SELECT rb.inventory_item_id AS item_id,
           COALESCE(it->>'name', '未知') AS dish,
           -(rb.dosage * COALESCE((it->>'quantity')::numeric, 0)) AS qty
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) it
    JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
  ),
  desired_agg AS (SELECT item_id, dish, SUM(qty) AS qty FROM desired GROUP BY item_id, dish),
  existing AS (
    SELECT item_id, COALESCE(NULLIF(notes, ''), '未知') AS dish, SUM(quantity) AS qty
    FROM public.inventory_transactions
    WHERE reference = p_order_id AND type = 'order_out'
    GROUP BY item_id, COALESCE(NULLIF(notes, ''), '未知')
  ),
  keys AS (SELECT item_id, dish FROM desired_agg UNION SELECT item_id, dish FROM existing),
  delta AS (
    SELECT k.item_id, COALESCE(d.qty, 0) - COALESCE(e.qty, 0) AS d
    FROM keys k
    LEFT JOIN desired_agg d ON d.item_id = k.item_id AND d.dish = k.dish
    LEFT JOIN existing   e ON e.item_id = k.item_id AND e.dish = k.dish
  ),
  per_item AS (SELECT item_id, SUM(d) AS d FROM delta GROUP BY item_id)
  UPDATE public.inventory_items ii
     SET stock = ii.stock + p.d, updated_at = now()
    FROM per_item p
   WHERE ii.id = p.item_id AND p.d <> 0;

  DELETE FROM public.inventory_transactions
   WHERE reference = p_order_id AND type = 'order_out';

  INSERT INTO public.inventory_transactions
    (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
  SELECT 'TXN-' || md5(p_order_id || '|' || d.item_id || '|' || d.dish),
         d.item_id, ii.name, 'order_out', d.qty,
         COALESCE(ii.unit, 'kg'), COALESCE(ii.price, 0), p_order_id, d.dish, now()
  FROM (
    SELECT rb.inventory_item_id AS item_id, COALESCE(it->>'name', '未知') AS dish,
           -SUM(rb.dosage * COALESCE((it->>'quantity')::numeric, 0)) AS qty
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) it
    JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
    GROUP BY rb.inventory_item_id, COALESCE(it->>'name', '未知')
  ) d
  JOIN public.inventory_items ii ON ii.id = d.item_id
  WHERE d.qty <> 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_bom()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_run boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_run := (NEW.status = 'completed');
  ELSE
    IF NEW.status = 'completed'
       AND (OLD.status IS DISTINCT FROM 'completed' OR NEW.items IS DISTINCT FROM OLD.items) THEN
      v_run := true;
    ELSIF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM 'completed' THEN
      PERFORM public.deduct_order_bom(NEW.id, '[]'::jsonb);
      RETURN NEW;
    END IF;
  END IF;
  IF v_run THEN
    PERFORM public.deduct_order_bom(NEW.id, COALESCE(NEW.items, '[]'::jsonb));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_bom ON public.orders;
CREATE TRIGGER trg_order_bom
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_bom();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 老板端聚合 RPC（避免前端拉全量，省 egress）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_sales_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(revenue numeric, orders bigint, items numeric, completed bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0)) FILTER (WHERE status = 'completed'), 0)::numeric,
    COUNT(*) FILTER (WHERE status <> 'cancelled'),
    COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0)
                    FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) i))
             FILTER (WHERE status <> 'cancelled'), 0)::numeric,
    COUNT(*) FILTER (WHERE status = 'completed')
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end;
$$;

CREATE OR REPLACE FUNCTION public.owner_daily(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT (created_at AT TIME ZONE p_tz)::date,
         COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0)) FILTER (WHERE status = 'completed'), 0)::numeric,
         COUNT(*) FILTER (WHERE status <> 'cancelled')
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.owner_dish_stats(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(name text, qty numeric, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(i->>'name', '未知'),
         COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0)::numeric,
         COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE((i->>'price')::numeric, 0)), 0)::numeric
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
  WHERE o.created_at >= p_start AND o.created_at < p_end AND o.status <> 'cancelled'
  GROUP BY 1 ORDER BY 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_hourly(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(hour int, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE p_tz))::int, COUNT(*)::bigint
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end AND status <> 'cancelled'
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.owner_consumption(p_start timestamptz, p_end timestamptz, p_type text DEFAULT 'order_out')
RETURNS TABLE(key text, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT item_name, SUM(ABS(quantity))::numeric, SUM(ABS(quantity) * COALESCE(unit_cost, 0))::numeric
  FROM public.inventory_transactions
  WHERE type = p_type AND created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_consumption_dish(p_start timestamptz, p_end timestamptz, p_type text DEFAULT 'order_out')
RETURNS TABLE(key text, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(notes, ''), '未知'),
         SUM(ABS(quantity))::numeric, SUM(ABS(quantity) * COALESCE(unit_cost, 0))::numeric
  FROM public.inventory_transactions
  WHERE type = p_type AND created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_consumption_daily(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC', p_type text DEFAULT 'order_out')
RETURNS TABLE(day date, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT (created_at AT TIME ZONE p_tz)::date,
         SUM(ABS(quantity))::numeric, SUM(ABS(quantity) * COALESCE(unit_cost, 0))::numeric
  FROM public.inventory_transactions
  WHERE type = p_type AND created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.owner_daily_profit(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, cogs numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH item_cost AS (
    SELECT rb.menu_item_name, SUM(rb.dosage * COALESCE(ii.price, 0)) AS unit_cost
    FROM public.recipe_boms rb
    JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
    GROUP BY 1
  )
  SELECT (o.created_at AT TIME ZONE p_tz)::date,
         COALESCE(SUM(COALESCE(o."finalTotal", o.total, o.total_amount, 0)) FILTER (WHERE o.status = 'completed'), 0)::numeric,
         COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE(ic.unit_cost, 0)), 0)
                         FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
                         LEFT JOIN item_cost ic ON ic.menu_item_name = (i->>'name')))
                  FILTER (WHERE o.status = 'completed'), 0)::numeric
  FROM public.orders o
  WHERE o.created_at >= p_start AND o.created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.owner_table_stats()
RETURNS TABLE(orders bigint, inventory bigint, boms bigint, purchases bigint, txns bigint, total_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.orders),
    (SELECT count(*) FROM public.inventory_items),
    (SELECT count(*) FROM public.recipe_boms),
    (SELECT count(*) FROM public.purchase_orders),
    (SELECT count(*) FROM public.inventory_transactions),
    pg_total_relation_size('public.orders') + pg_total_relation_size('public.inventory_items')
      + pg_total_relation_size('public.recipe_boms') + pg_total_relation_size('public.purchase_orders')
      + pg_total_relation_size('public.inventory_transactions');
$$;

CREATE OR REPLACE FUNCTION public.owner_prune(p_orders_days int DEFAULT 90, p_txns_days int DEFAULT 180)
RETURNS TABLE(removed_orders bigint, removed_txns bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o bigint; t bigint;
BEGIN
  IF p_orders_days > 0 THEN
    DELETE FROM public.orders
     WHERE status IN ('completed', 'cancelled')
       AND created_at < now() - make_interval(days => p_orders_days);
    GET DIAGNOSTICS o = ROW_COUNT;
  END IF;
  IF p_txns_days > 0 THEN
    DELETE FROM public.inventory_transactions
     WHERE created_at < now() - make_interval(days => p_txns_days);
    GET DIAGNOSTICS t = ROW_COUNT;
  END IF;
  RETURN QUERY SELECT COALESCE(o, 0), COALESCE(t, 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 刷新 PostgREST 缓存（新建函数后必须，否则仍报 could not find function）
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 校验：应返回 11 行 owner_* 函数
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'owner_%'
ORDER BY proname;
