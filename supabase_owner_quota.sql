-- =============================================================
-- 老板端「免费额度友好」升级：结账字段补列 + 服务端聚合 RPC + 用量统计
-- 适用：supabase_schema.sql / supabase_setup.sql / supabase_inventory_bom.sql 之后执行。
-- 特点：幂等，可安全重复执行；只新增列/索引/函数，不删数据。
--
-- 目的（对照 Supabase 免费额度：DB 500MB · Egress 5GB/月 · Realtime 2M 条/月）：
--   1) 补齐 orders 结账字段（此前被前端列白名单静默丢弃）→ 营收/支付方式口径准确
--   2) 提供聚合 RPC：仪表盘/报表在 Postgres 内完成 SUM/GROUP BY，
--      前端只传回「几十行」结果，避免每次拉 3000 条订单（egress 头号杀手）
--   3) 提供表用量统计，便于监控 500MB 配额
--
-- 执行：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- =============================================================

-- ─── 1. orders 结账字段（camelCase，供 PostgREST / 前端列发现识别）───
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentMethod"  TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "receivedAmount" NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "finalTotal"     NUMERIC(10,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "completedAt"    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);

-- ─── 2. 汇总 KPI（营收 / 订单 / 份数 / 已结账）───
CREATE OR REPLACE FUNCTION public.owner_sales_summary(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(revenue numeric, orders bigint, items bigint, completed bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0))
             FILTER (WHERE status = 'completed'), 0)::numeric,
    COUNT(*) FILTER (WHERE status <> 'cancelled'),
    COALESCE(SUM(
      (SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0)
         FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) i)
    ) FILTER (WHERE status <> 'cancelled'), 0)::numeric,
    COUNT(*) FILTER (WHERE status = 'completed')
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end;
$$;

-- ─── 3. 每日趋势 ───
CREATE OR REPLACE FUNCTION public.owner_daily(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT (created_at AT TIME ZONE p_tz)::date AS day,
         COALESCE(SUM(COALESCE("finalTotal", total, total_amount, 0))
                  FILTER (WHERE status = 'completed'), 0)::numeric,
         COUNT(*) FILTER (WHERE status <> 'cancelled')
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- ─── 4. 菜品销量/营收（用于热销、报表、菜单工程、成本毛利）───
CREATE OR REPLACE FUNCTION public.owner_dish_stats(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(name text, qty numeric, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(i->>'name', '未知') AS name,
         COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0)), 0)::numeric,
         COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE((i->>'price')::numeric, 0)), 0)::numeric
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
  WHERE o.created_at >= p_start AND o.created_at < p_end AND o.status <> 'cancelled'
  GROUP BY 1 ORDER BY 3 DESC;
$$;

-- ─── 5. 时段分布 ───
CREATE OR REPLACE FUNCTION public.owner_hourly(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(hour int, orders bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE p_tz))::int AS hour,
         COUNT(*)::bigint
  FROM public.orders
  WHERE created_at >= p_start AND created_at < p_end AND status <> 'cancelled'
  GROUP BY 1 ORDER BY 1;
$$;

-- ─── 6. 消耗汇总（按原料 / 按菜品 / 按天）───
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

-- ─── 6.5 每日营收 / 成本（成本按当前配方单价）───
CREATE OR REPLACE FUNCTION public.owner_daily_profit(p_start timestamptz, p_end timestamptz, p_tz text DEFAULT 'UTC')
RETURNS TABLE(day date, revenue numeric, cogs numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH item_cost AS (
    SELECT rb.menu_item_name, SUM(rb.dosage * COALESCE(ii.price, 0)) AS unit_cost
    FROM public.recipe_boms rb
    JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
    GROUP BY 1
  )
  SELECT (o.created_at AT TIME ZONE p_tz)::date AS day,
         COALESCE(SUM(COALESCE(o."finalTotal", o.total, o.total_amount, 0))
                  FILTER (WHERE o.status = 'completed'), 0)::numeric,
         COALESCE(SUM(
           (SELECT COALESCE(SUM(COALESCE((i->>'quantity')::numeric, 0) * COALESCE(ic.unit_cost, 0)), 0)
              FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) i
              LEFT JOIN item_cost ic ON ic.menu_item_name = (i->>'name'))
         ) FILTER (WHERE o.status = 'completed'), 0)::numeric
  FROM public.orders o
  WHERE o.created_at >= p_start AND o.created_at < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- ─── 7. 表用量统计（监控 500MB 配额）───
CREATE OR REPLACE FUNCTION public.owner_table_stats()
RETURNS TABLE(orders bigint, inventory bigint, boms bigint, purchases bigint, txns bigint, total_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.orders),
    (SELECT count(*) FROM public.inventory_items),
    (SELECT count(*) FROM public.recipe_boms),
    (SELECT count(*) FROM public.purchase_orders),
    (SELECT count(*) FROM public.inventory_transactions),
    pg_total_relation_size('public.orders')
      + pg_total_relation_size('public.inventory_items')
      + pg_total_relation_size('public.recipe_boms')
      + pg_total_relation_size('public.purchase_orders')
      + pg_total_relation_size('public.inventory_transactions');
$$;

-- ─── 8. 手动清理（配额兜底，谨慎使用）───
-- p_orders_days：删除超过 N 天的「已结账/已取消」订单（保留进行中订单）
-- p_txns_days  ：删除超过 N 天的库存流水（会丢失该时段消耗明细）
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
  RETURN QUERY SELECT COALESCE(o,0), COALESCE(t,0);
END; $$;

-- ─── 9. 校验 ───
SELECT proname FROM pg_proc
WHERE proname IN ('owner_sales_summary','owner_daily','owner_dish_stats','owner_hourly',
                  'owner_consumption','owner_consumption_dish','owner_consumption_daily',
                  'owner_daily_profit','owner_table_stats','owner_prune')
ORDER BY proname;

-- =============================================================
-- 回滚（需要时取消注释）
-- =============================================================
-- DROP FUNCTION IF EXISTS public.owner_sales_summary(timestamptz,timestamptz);
-- DROP FUNCTION IF EXISTS public.owner_daily(timestamptz,timestamptz,text);
-- DROP FUNCTION IF EXISTS public.owner_dish_stats(timestamptz,timestamptz);
-- DROP FUNCTION IF EXISTS public.owner_hourly(timestamptz,timestamptz,text);
-- DROP FUNCTION IF EXISTS public.owner_consumption(timestamptz,timestamptz);
-- DROP FUNCTION IF EXISTS public.owner_consumption_dish(timestamptz,timestamptz);
-- DROP FUNCTION IF EXISTS public.owner_consumption_daily(timestamptz,timestamptz,text);
-- DROP FUNCTION IF EXISTS public.owner_daily_profit(timestamptz,timestamptz,text);
-- DROP FUNCTION IF EXISTS public.owner_table_stats();
-- DROP FUNCTION IF EXISTS public.owner_prune(int,int);
