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
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "tableNumber"        TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "orderNumber"        TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "isExternal"         BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "unprintedNewOrder"  BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "unprintedAdditions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentMethod"  TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "receivedAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "finalTotal"     NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "completedAt"    TIMESTAMPTZ;
-- 进入「制作中」的时刻（漏单提醒按制作时长起算，非下单时长）
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "cookingAt"      TIMESTAMPTZ;
-- 结账时的食材成本快照（由 trg_order_cogs_snapshot 写入；旧订单为空则按当前配方估算）
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "cogsSnapshot"   NUMERIC(10,2);
-- 订单标记：normal / refund / gift / staff / trial（老板端落库，跨设备一致）
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "orderTag"       TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON public.orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_completed    ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_created     ON public.inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item        ON public.inventory_transactions (item_id, type);
CREATE INDEX IF NOT EXISTS idx_inv_txn_ref         ON public.inventory_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_bom_name            ON public.recipe_boms (menu_item_name);

-- 损耗原因分类（报损登记用，前端按 reason 聚合；历史行为空串不影响）
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS reason VARCHAR(30) DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_inv_txn_waste       ON public.inventory_transactions (type, created_at DESC);

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
    v_run := (NEW.status = 'completed'
              AND COALESCE(NEW."orderTag", 'normal') <> 'refund');
  ELSE
    IF NEW.status = 'completed'
       AND COALESCE(NEW."orderTag", 'normal') <> 'refund'
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

-- 删除订单时回冲库存与流水（否则订单删了、库存仍被扣、消耗仍被统计）
CREATE OR REPLACE FUNCTION public.reverse_order_bom()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.deduct_order_bom(OLD.id, '[]'::jsonb);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_bom_delete ON public.orders;
CREATE TRIGGER trg_order_bom_delete
  AFTER DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reverse_order_bom();

-- 结账时写入成本快照：之后原料调价不再改写历史毛利
CREATE OR REPLACE FUNCTION public.snapshot_order_cogs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cost numeric;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT COALESCE(SUM(rb.dosage * COALESCE(ii.price, 0)
                        * COALESCE((it->>'quantity')::numeric, 0)), 0)
      INTO v_cost
      FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) it
      JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
      JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id;
    NEW."cogsSnapshot" := v_cost;
  ELSE
    NEW."cogsSnapshot" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cogs_snapshot ON public.orders;
CREATE TRIGGER trg_order_cogs_snapshot
  BEFORE INSERT OR UPDATE OF status, items ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_cogs();

-- 标记「退菜」时回冲库存；取消退菜标记时按当前配方重新扣减。
-- 赠送/员工餐/试菜仍然消耗原料，不动库存。
CREATE OR REPLACE FUNCTION public.apply_order_tag_bom()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
  IF COALESCE(OLD."orderTag", 'normal') <> 'refund'
     AND COALESCE(NEW."orderTag", 'normal') = 'refund' THEN
    PERFORM public.deduct_order_bom(NEW.id, '[]'::jsonb);
  ELSIF OLD.status = 'completed'
     AND NEW.status = 'completed'
     AND COALESCE(OLD."orderTag", 'normal') = 'refund'
     AND COALESCE(NEW."orderTag", 'normal') <> 'refund'
     AND NEW.items IS NOT DISTINCT FROM OLD.items THEN
    PERFORM public.deduct_order_bom(NEW.id, COALESCE(NEW.items, '[]'::jsonb));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_tag_bom ON public.orders;
CREATE TRIGGER trg_order_tag_bom
  AFTER UPDATE OF "orderTag" ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_tag_bom();

-- 升级前已经标记退菜、但库存尚未回冲的历史订单：首次补回，重复执行无副作用
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT o.id
    FROM public.orders o
    WHERE o.status = 'completed'
      AND COALESCE(o."orderTag", 'normal') = 'refund'
      AND EXISTS (
        SELECT 1 FROM public.inventory_transactions t
        WHERE t.reference = o.id AND t.type = 'order_out'
      )
  LOOP
    PERFORM public.deduct_order_bom(r.id, '[]'::jsonb);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 老板端聚合 RPC（避免前端拉全量，省 egress）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_sales_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(revenue numeric, orders bigint, items numeric, completed bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0))
             FILTER (WHERE status = 'completed'
                       AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
    COUNT(*) FILTER (WHERE status = 'completed'
                       AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')),
    COALESCE(SUM((SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0)
                    FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) i))
             FILTER (WHERE status = 'completed'
                       AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
    COUNT(*) FILTER (WHERE status = 'completed'
                       AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial'))
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end;
$$;

-- 营业日从凌晨 3 点切分，与前端 businessDay.ts 一致
DROP FUNCTION IF EXISTS public.owner_daily(timestamptz, timestamptz, text, int);
CREATE OR REPLACE FUNCTION public.owner_daily(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ((created_at AT TIME ZONE p_tz) - interval '3 hours')::date,
         COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0))
                  FILTER (WHERE status = 'completed'
                            AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
         COUNT(*) FILTER (WHERE status = 'completed'
                            AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial'))
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.owner_dish_stats(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(name text, qty numeric, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH lines AS (
    SELECT COALESCE(i->>'name', '未知') AS name,
           COALESCE((i->>'quantity')::numeric, 0) AS qty,
           COALESCE((i->>'quantity')::numeric, 0) * COALESCE((i->>'price')::numeric, 0) AS gross,
           SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE((i->>'price')::numeric, 0))
             OVER (PARTITION BY o.id) AS order_gross,
           COALESCE(o."finalTotal", o.total, o.total_amount, 0) AS order_revenue
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
    WHERE o.created_at >= p_start AND o.created_at < p_end
      AND o.status = 'completed'
      AND COALESCE(o."orderTag", 'normal') NOT IN ('refund','gift','staff','trial')
  )
  SELECT name,
         COALESCE(SUM(qty), 0)::numeric,
         COALESCE(SUM(gross * CASE WHEN order_gross <> 0 THEN order_revenue / order_gross ELSE 0 END), 0)::numeric
  FROM lines
  GROUP BY 1 ORDER BY 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_hourly(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(hour int, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE p_tz))::int, COUNT(*)::bigint
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end
    AND status = 'completed'
    AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')
  GROUP BY 1 ORDER BY 1;
$$;

DROP FUNCTION IF EXISTS public.owner_consumption(timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION public.owner_consumption(p_start timestamptz, p_end timestamptz, p_type text DEFAULT 'order_out')
RETURNS TABLE(key text, item_id text, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT t.item_name, t.item_id,
         SUM(ABS(t.quantity))::numeric,
         SUM(ABS(t.quantity) * COALESCE(t.unit_cost, 0))::numeric
  FROM public.inventory_transactions t
  WHERE t.type = p_type AND t.created_at >= p_start AND t.created_at < p_end
    AND NOT (t.type = 'order_out' AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = t.reference
         AND COALESCE(o."orderTag", 'normal') = 'refund'))
  GROUP BY 1, 2 ORDER BY 4 DESC;
$$;

CREATE OR REPLACE FUNCTION public.owner_consumption_dish(p_start timestamptz, p_end timestamptz, p_type text DEFAULT 'order_out')
RETURNS TABLE(key text, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(t.notes, ''), '未知'),
         SUM(ABS(t.quantity))::numeric,
         SUM(ABS(t.quantity) * COALESCE(t.unit_cost, 0))::numeric
  FROM public.inventory_transactions t
  WHERE t.type = p_type AND t.created_at >= p_start AND t.created_at < p_end
    AND NOT (t.type = 'order_out' AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = t.reference
         AND COALESCE(o."orderTag", 'normal') = 'refund'))
  GROUP BY 1 ORDER BY 3 DESC;
$$;

DROP FUNCTION IF EXISTS public.owner_consumption_daily(timestamptz, timestamptz, text, text, int);
CREATE OR REPLACE FUNCTION public.owner_consumption_daily(
  p_start timestamptz,
  p_end timestamptz,
  p_tz text DEFAULT 'UTC',
  p_type text DEFAULT 'order_out'
)
RETURNS TABLE(day date, qty numeric, cost numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ((t.created_at AT TIME ZONE p_tz) - interval '3 hours')::date,
         SUM(ABS(t.quantity))::numeric,
         SUM(ABS(t.quantity) * COALESCE(t.unit_cost, 0))::numeric
  FROM public.inventory_transactions t
  WHERE t.type = p_type AND t.created_at >= p_start AND t.created_at < p_end
    AND NOT (t.type = 'order_out' AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = t.reference
         AND COALESCE(o."orderTag", 'normal') = 'refund'))
  GROUP BY 1 ORDER BY 1;
$$;

DROP FUNCTION IF EXISTS public.owner_daily_profit(timestamptz, timestamptz, text, int);
CREATE OR REPLACE FUNCTION public.owner_daily_profit(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, cogs numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH item_cost AS (
    SELECT rb.menu_item_name, SUM(rb.dosage * COALESCE(ii.price, 0)) AS unit_cost
    FROM public.recipe_boms rb
    JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
    GROUP BY 1
  )
  SELECT ((o.created_at AT TIME ZONE p_tz) - interval '3 hours')::date,
         COALESCE(SUM(COALESCE(o."finalTotal", o.total, o.total_amount, 0))
                  FILTER (WHERE o.status = 'completed'
                            AND COALESCE(o."orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
         COALESCE(SUM(COALESCE(o."cogsSnapshot", oc.cost, 0))
                  FILTER (WHERE o.status = 'completed'
                            AND COALESCE(o."orderTag", 'normal') <> 'refund'), 0)::numeric
  FROM public.orders o
  LEFT JOIN LATERAL (
    SELECT SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE(ic.unit_cost, 0)) AS cost
    FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
    LEFT JOIN item_cost ic ON ic.menu_item_name = (i->>'name')
  ) oc ON true
  WHERE o.created_at >= p_start AND o.created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- 成本汇总（区间）：收入 / 快照 COGS / 损耗 / 平台订单收入
-- 免费餐（赠送/员工餐/试菜）成本单列为 free_cogs，不计入销售 COGS，
-- 保证「营收」「销售成本」「菜品毛利排行」口径一致、可勾稽。
-- 前端优先用它，避免用「当前原料价」重算历史；函数缺失时前端自动回退旧口径。
DROP FUNCTION IF EXISTS public.owner_cost_summary(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.owner_cost_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(revenue numeric, cogs numeric, waste numeric, external_revenue numeric, free_cogs numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH item_cost AS (
    SELECT rb.menu_item_name, SUM(rb.dosage * COALESCE(ii.price, 0)) AS unit_cost
    FROM public.recipe_boms rb
    JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
    GROUP BY 1
  )
  SELECT
    COALESCE(SUM(COALESCE(o."finalTotal", o.total, o.total_amount, 0))
             FILTER (WHERE o.status = 'completed'
                       AND COALESCE(o."orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
    COALESCE(SUM(COALESCE(o."cogsSnapshot", oc.cost, 0))
             FILTER (WHERE o.status = 'completed'
                       AND COALESCE(o."orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
    (SELECT COALESCE(SUM(ABS(t.quantity) * COALESCE(t.unit_cost, 0)), 0)::numeric
       FROM public.inventory_transactions t
      WHERE t.type = 'waste' AND t.created_at >= p_start AND t.created_at < p_end),
    COALESCE(SUM(COALESCE(o."finalTotal", o.total, o.total_amount, 0))
             FILTER (WHERE o.status = 'completed'
                       AND COALESCE(o."isExternal", false)
                       AND COALESCE(o."orderTag", 'normal') NOT IN ('refund','gift','staff','trial')), 0)::numeric,
    COALESCE(SUM(COALESCE(o."cogsSnapshot", oc.cost, 0))
             FILTER (WHERE o.status = 'completed'
                       AND COALESCE(o."orderTag", 'normal') IN ('gift','staff','trial')), 0)::numeric
  FROM public.orders o
  LEFT JOIN LATERAL (
    SELECT SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE(ic.unit_cost, 0)) AS cost
    FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
    LEFT JOIN item_cost ic ON ic.menu_item_name = (i->>'name')
  ) oc ON true
  WHERE o.created_at >= p_start AND o.created_at < p_end;
$$;
GRANT EXECUTE ON FUNCTION public.owner_cost_summary(timestamptz, timestamptz) TO anon, authenticated;

-- 支付方式分布（按营收，排除退款/赠送/员工餐/试菜）
CREATE OR REPLACE FUNCTION public.owner_payment_stats(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(method text, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(NULLIF("paymentMethod", ''), '未标注'),
         COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0)), 0)::numeric
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end
    AND status = 'completed'
    AND COALESCE("orderTag", 'normal') NOT IN ('refund','gift','staff','trial')
  GROUP BY 1 ORDER BY 2 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.owner_payment_stats(timestamptz, timestamptz) TO anon, authenticated;

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
  -- 归档/清理历史数据时不要触发库存回冲（否则会把多年前的扣减反向加回现库存）
  PERFORM set_config('session_replication_role', 'replica', true);
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
-- 6.1 操作日志 / 盘点历史上云（cloudSync 表）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_audit_log (
  at     bigint not null,
  action text not null,
  detail text not null default '',
  primary key (at, action, detail)
);
CREATE TABLE IF NOT EXISTS public.owner_stocktake (
  at        bigint primary key,
  day       text not null,
  items     integer not null default 0,
  diffs     integer not null default 0,
  net_value numeric not null default 0,
  stock_value numeric not null default 0
);
ALTER TABLE public.owner_stocktake ADD COLUMN IF NOT EXISTS stock_value numeric not null default 0;
ALTER TABLE public.owner_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_stocktake ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all_owner_audit_log ON public.owner_audit_log;
CREATE POLICY anon_all_owner_audit_log ON public.owner_audit_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS anon_all_owner_stocktake ON public.owner_stocktake;
CREATE POLICY anon_all_owner_stocktake ON public.owner_stocktake
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.owner_audit_log TO anon, authenticated;
GRANT ALL ON public.owner_stocktake TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.2 历史汇总补录表（owner_backfill）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_backfill (
  day        text primary key,
  revenue    numeric not null default 0,
  orders     integer not null default 0,
  note       text not null default '',
  created_at timestamptz not null default now()
);
-- 历史补录也带成本，成本类报表才能与营收对齐
ALTER TABLE public.owner_backfill ADD COLUMN IF NOT EXISTS cogs numeric not null default 0;
ALTER TABLE public.owner_backfill ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all_owner_backfill ON public.owner_backfill;
CREATE POLICY anon_all_owner_backfill ON public.owner_backfill
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.owner_backfill TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.3 POS/平台订单 CSV 导入 RPC（绕 BOM 触发器，幂等）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_import_orders(p_orders jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_id text;
  v_ts timestamptz;
  v_n integer := 0;
BEGIN
  perform set_config('session_replication_role', 'replica', true);
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) LOOP
    v_ts := coalesce((r->>'timestamp')::timestamptz, now());
    v_id := nullif(r->>'id', '');
    IF v_id IS NULL THEN
      v_id := 'imp-' || md5(coalesce(r->>'orderNumber', '') || v_ts::text || coalesce(r->>'tableNo', ''));
    END IF;
    INSERT INTO public.orders (
      id, _id, "tableNo", table_no, customer_name, "customerName",
      type, status, total, total_amount, "finalTotal",
      items, notes, "orderNumber", "paymentMethod",
      "timestamp", "created_at", "createdAt",
      "isExternal", "unprintedNewOrder", "unprintedAdditions",
      "orderTag", "cogsSnapshot"
    ) VALUES (
      v_id, v_id,
      coalesce(nullif(r->>'tableNo', ''), 'A1'), coalesce(nullif(r->>'tableNo', ''), 'A1'),
      coalesce(r->>'customerName', ''), coalesce(r->>'customerName', ''),
      coalesce(r->>'type', 'dine_in'), coalesce(r->>'status', 'completed'),
      coalesce((r->>'total')::numeric, 0), coalesce((r->>'total')::numeric, 0), coalesce((r->>'total')::numeric, 0),
      coalesce(r->'items', '[]'::jsonb), coalesce(r->>'notes', ''),
      coalesce(r->>'orderNumber', ''), coalesce(r->>'paymentMethod', ''),
      v_ts, v_ts, v_ts,
      coalesce((r->>'isExternal')::boolean, false), false, '[]'::jsonb,
      coalesce(nullif(r->>'orderTag', ''), 'normal'),
      CASE WHEN coalesce(r->>'status', 'completed') = 'completed' THEN (
        SELECT coalesce(sum(rb.dosage * coalesce(ii.price, 0)
                            * coalesce((it->>'quantity')::numeric, 0)), 0)
        FROM jsonb_array_elements(coalesce(r->'items', '[]'::jsonb)) it
        JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
        JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
      ) ELSE NULL END
    )
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_import_orders(jsonb) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.4 固定成本表（房租/人工/水电等，按月金额录入，按当月天数摊到每日）
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.owner_fixed_cost (
  id         text primary key,
  name       text not null default '',
  category   text not null default '其他',
  amount     numeric not null default 0,
  start_date text not null default '',  -- YYYY-MM 生效月（含）
  note       text not null default '',
  created_at timestamptz not null default now()
);
ALTER TABLE public.owner_fixed_cost ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all_owner_fixed_cost ON public.owner_fixed_cost;
CREATE POLICY anon_all_owner_fixed_cost ON public.owner_fixed_cost
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.owner_fixed_cost TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.5 原料保质期天数（临期/食安预警）
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS shelf_life_days integer;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.6 菜单快照（数据库侧备份 + 一键快速恢复）
--     每次「备份菜单」把当前 settings.categories + deletedItemIds 存一份到库里，
--     出问题后一键恢复，不依赖本机 localStorage，换设备也不丢。保留最近 30 份。
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_snapshots (
  id               text primary key,
  name             text not null default '菜单快照',
  created_at       timestamptz not null default now(),
  categories       jsonb not null default '[]'::jsonb,
  deleted_item_ids jsonb not null default '[]'::jsonb,
  item_count       integer not null default 0
);

CREATE OR REPLACE FUNCTION public.owner_menu_snapshot(p_name text DEFAULT '菜单快照')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id    text;
  v_cats  jsonb;
  v_del   jsonb;
  v_count integer;
BEGIN
  SELECT COALESCE(categories, '[]'::jsonb), COALESCE("deletedItemIds", '[]'::jsonb)
    INTO v_cats, v_del
    FROM public.settings WHERE id = 'global';
  v_cats := COALESCE(v_cats, '[]'::jsonb);
  v_del  := COALESCE(v_del, '[]'::jsonb);
  SELECT COALESCE(SUM(jsonb_array_length(c->'items')), 0)::integer
    INTO v_count
    FROM jsonb_array_elements(v_cats) c;
  v_id := 'snap-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || floor(random()*9000+1000)::text;
  INSERT INTO public.menu_snapshots (id, name, categories, deleted_item_ids, item_count)
  VALUES (v_id, COALESCE(NULLIF(p_name, ''), '菜单快照'), v_cats, v_del, v_count);
  DELETE FROM public.menu_snapshots
   WHERE id NOT IN (SELECT id FROM public.menu_snapshots ORDER BY created_at DESC LIMIT 30);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_menu_snapshot_list()
RETURNS TABLE(id text, name text, created_at timestamptz, item_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, created_at, item_count FROM public.menu_snapshots ORDER BY created_at DESC LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.owner_menu_restore(p_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cats jsonb;
  v_del  jsonb;
BEGIN
  SELECT categories, deleted_item_ids INTO v_cats, v_del
    FROM public.menu_snapshots WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.settings
     SET categories = COALESCE(v_cats, '[]'::jsonb),
         "deletedItemIds" = COALESCE(v_del, '[]'::jsonb)
   WHERE id = 'global';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_menu_snapshot_delete(p_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.menu_snapshots WHERE id = p_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_menu_snapshot(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_menu_snapshot_list() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_menu_restore(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_menu_snapshot_delete(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.5 员工协同：员工账号 / 任务派发 / 每日抽盘 / 采购申报（幂等）
-- 员工端(/staff.html)与老板端共用 anon key，故沿用 anon 全放行策略；
-- 敏感数据（营收/成本/供应商）仍在老板端独有表中，员工端根本不查询。
-- ─────────────────────────────────────────────────────────────────────────────

-- 员工账号（岗位多选：waiter 服务员 / helper 帮厨 / cleaner 保洁 / other 其他）
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',   -- active 在职 / disabled 停用
  phone VARCHAR(30) DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',          -- bcrypt，客户端比对（与现有 adminPasswordHash 同方案）
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 任务模板（检查项 JSONB 字符串数组）
CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  task_type VARCHAR(20) NOT NULL DEFAULT 'daily',  -- daily / weekly / monthly / adhoc
  roles TEXT[] NOT NULL DEFAULT '{}',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  require_photo BOOLEAN NOT NULL DEFAULT false,
  due_hours INTEGER NOT NULL DEFAULT 8,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 派发任务：责任到人，一次派多人 = 多行（batch_id 同批）
CREATE TABLE IF NOT EXISTS public.staff_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID,
  template_id UUID,
  title VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{text, done}]
  require_photo BOOLEAN NOT NULL DEFAULT false,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal',  -- low / normal / high
  assigned_to UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  assignee_name VARCHAR(50) DEFAULT '',
  assignee_roles TEXT[] NOT NULL DEFAULT '{}',
  due_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending / submitted / approved / rejected / cancelled
  note TEXT DEFAULT '',
  photos TEXT[] NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  review_note TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  resubmit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 盘点规则（单行，UI upsert）
CREATE TABLE IF NOT EXISTS public.stocktake_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  items_per_day INTEGER NOT NULL DEFAULT 5,
  strategy VARCHAR(30) NOT NULL DEFAULT 'stale_first', -- stale_first / zone_rotate / random
  zones TEXT[] NOT NULL DEFAULT '{}',
  due_time VARCHAR(5) NOT NULL DEFAULT '22:00',
  require_photo BOOLEAN NOT NULL DEFAULT false,
  show_book_qty BOOLEAN NOT NULL DEFAULT false,
  allow_draft BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 每日盘点任务：UNIQUE(count_date,item_id) 防同日重复
CREATE TABLE IF NOT EXISTS public.stocktake_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(100) NOT NULL DEFAULT '',
  unit VARCHAR(20) DEFAULT '',
  zone VARCHAR(50) DEFAULT '',
  book_qty DECIMAL(10,2),
  actual_qty DECIMAL(10,2),
  note TEXT DEFAULT '',
  photos TEXT[] NOT NULL DEFAULT '{}',
  assigned_to UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  assignee_name VARCHAR(50) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending / drafted / submitted / rejected / calibrated / cancelled
  submitted_at TIMESTAMPTZ,
  review_note TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  calibrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(count_date, item_id)
);

-- 采购申报（员工端发起，老板审批）
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  staff_name VARCHAR(50) DEFAULT '',
  item_name VARCHAR(100) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT '',
  category VARCHAR(50) DEFAULT '',
  urgency VARCHAR(10) NOT NULL DEFAULT 'normal',   -- normal / urgent
  expected_date DATE,
  note TEXT DEFAULT '',
  photos TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(15) NOT NULL DEFAULT 'pending',   -- pending / approved / rejected / purchased
  reject_reason TEXT DEFAULT '',
  decided_at TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 库存表补充：区域（按区域轮换抽盘用）+ 上次盘点时间（久未盘优先用）
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS zone VARCHAR(50) DEFAULT '';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ;

-- 采购申报闭环:记录申报被哪张入库单消化(溯源)
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS purchase_id VARCHAR(100) DEFAULT '';
-- 采购申报闭环:申报关联的库存物品(自动匹配或老板手动关联)
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS inventory_item_id VARCHAR(50) DEFAULT '';

-- RLS：与既有 anon_all_* 策略保持一致
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_members','task_templates','staff_tasks','stocktake_rules','stocktake_tasks','purchase_requests']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%1$s" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "anon_all_%1$s" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 默认盘点规则（不存在才插入）
INSERT INTO public.stocktake_rules (enabled, items_per_day, strategy, due_time)
SELECT false, 5, 'stale_first', '22:00'
WHERE NOT EXISTS (SELECT 1 FROM public.stocktake_rules);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_assignee ON public.staff_tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_stocktake_tasks_date ON public.stocktake_tasks (count_date, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests (status, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.6 盘点按分类自动派发：库存分类 → 责任角色 → 按在职人数拆分到人
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stocktake_category_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(50) NOT NULL UNIQUE,           -- 规范分类（中文键，同 inventory_items.category）
  roles TEXT[] NOT NULL DEFAULT '{}',             -- 责任角色（waiter/helper/cleaner/other，可多选）
  split_mode VARCHAR(20) NOT NULL DEFAULT 'average', -- average / zone / category_group / random / rotate
  enabled BOOLEAN NOT NULL DEFAULT true,          -- 当天排除该分类时临时停用
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 自动派发总开关（关=维持现状：生成后老板手动指派）
ALTER TABLE public.stocktake_rules
  ADD COLUMN IF NOT EXISTS auto_by_category BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.stocktake_category_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_stocktake_category_rules" ON public.stocktake_category_rules;
CREATE POLICY "anon_all_stocktake_category_rules" ON public.stocktake_category_rules
  FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.stocktake_category_rules TO anon, authenticated;

-- 默认映射：食品类→帮厨，耗材→服务员；「其他」留空由老板指定
INSERT INTO public.stocktake_category_rules (category, roles, split_mode)
VALUES
  ('蔬菜', ARRAY['helper'], 'average'),
  ('肉类', ARRAY['helper'], 'average'),
  ('水产', ARRAY['helper'], 'average'),
  ('调料', ARRAY['helper'], 'average'),
  ('粮油', ARRAY['helper'], 'average'),
  ('饮料', ARRAY['helper'], 'average'),
  ('耗材', ARRAY['waiter'], 'average'),
  ('其他', ARRAY[]::TEXT[], 'average')
ON CONFLICT (category) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_stocktake_category_rules_cat ON public.stocktake_category_rules (category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 刷新 PostgREST 缓存（新建函数后必须，否则仍报 could not find function）
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 校验：应返回 14 行 owner_* 函数
-- ─────────────────────────────────────────────────────────────────────────────
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'owner_%'
ORDER BY proname;

-- 校验：owner 相关的扩展表（应返回 owner_audit_log / owner_stocktake / owner_backfill / owner_fixed_cost）
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name LIKE 'owner_%'
 ORDER BY table_name;
