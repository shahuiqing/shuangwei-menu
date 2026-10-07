-- =============================================================
-- BOM 扣减 v2：对账式（reconcile），修复「加菜/改单/合并」漏扣
-- 适用：supabase_inventory_bom.sql 之后执行（CREATE OR REPLACE 覆盖 v1）。
-- 幂等，可安全重复执行。
--
-- 背景（v1 缺陷）：
--   v1 为 AFTER UPDATE OF status + 按订单幂等。
--   但顾客端「加菜/合并」只把菜品追加进 orders.items，**不改变 status**
--   （src/api.ts:1250、src/features/orders/OrderBoard.tsx:143,166），
--   因此已结账订单加菜不会被扣库存；订单也可被多次修改。
--
-- v2 策略：
--   核心函数 deduct_order_bom(order_id, items) 按当前 items 重算应扣量，
--   与已有 order_out 流水对账，只补差额，并重写该订单的 order_out 明细。
--   触发器在「订单进入 completed 且 items 变化」或「从 completed 离开」时调用。
--   → 天然幂等，兼容加菜、改单、合并、取消回补、重复结账。
--
-- 口径（沿用已确认）：
--   · 配方匹配键 recipe_boms.menu_item_name = orders.items[].name
--   · 出库 quantity 记负；unit_cost 快照 inventory_items.price
--   · 按 (原料, 菜品) 维度保留明细，供「按菜品消耗」统计
--
-- 执行：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- =============================================================

-- ─── 1. 核心：按 order_id + items 对账式扣减 ───
CREATE OR REPLACE FUNCTION public.deduct_order_bom(p_order_id text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1.1 对账：应扣(desired) vs 已扣(existing)，只补差额
  WITH desired AS (
    SELECT rb.inventory_item_id AS item_id,
           COALESCE(it->>'name', '未知') AS dish,
           -(rb.dosage * COALESCE((it->>'quantity')::numeric, 0)) AS qty
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) it
    JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
  ),
  desired_agg AS (
    SELECT item_id, dish, SUM(qty) AS qty FROM desired GROUP BY item_id, dish
  ),
  existing AS (
    SELECT item_id, COALESCE(NULLIF(notes, ''), '未知') AS dish, SUM(quantity) AS qty
    FROM public.inventory_transactions
    WHERE reference = p_order_id AND type = 'order_out'
    GROUP BY item_id, COALESCE(NULLIF(notes, ''), '未知')
  ),
  keys AS (
    SELECT item_id, dish FROM desired_agg
    UNION
    SELECT item_id, dish FROM existing
  ),
  delta AS (
    SELECT k.item_id, COALESCE(d.qty, 0) - COALESCE(e.qty, 0) AS d
    FROM keys k
    LEFT JOIN desired_agg d ON d.item_id = k.item_id AND d.dish = k.dish
    LEFT JOIN existing   e ON e.item_id = k.item_id AND e.dish = k.dish
  ),
  per_item AS (
    SELECT item_id, SUM(d) AS d FROM delta GROUP BY item_id
  )
  UPDATE public.inventory_items ii
     SET stock = ii.stock + p.d,
         updated_at = now()
    FROM per_item p
   WHERE ii.id = p.item_id AND p.d <> 0;

  -- 1.2 重写该订单的 order_out 明细为当前应扣量
  DELETE FROM public.inventory_transactions
   WHERE reference = p_order_id AND type = 'order_out';

  INSERT INTO public.inventory_transactions
    (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
  SELECT 'TXN-' || md5(p_order_id || '|' || d.item_id || '|' || d.dish),
         d.item_id, ii.name, 'order_out', d.qty,
         COALESCE(ii.unit, 'kg'), COALESCE(ii.price, 0),
         p_order_id, d.dish, now()
  FROM (
    SELECT rb.inventory_item_id AS item_id,
           COALESCE(it->>'name', '未知') AS dish,
           -SUM(rb.dosage * COALESCE((it->>'quantity')::numeric, 0)) AS qty
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) it
    JOIN public.recipe_boms rb ON rb.menu_item_name = (it->>'name')
    GROUP BY rb.inventory_item_id, COALESCE(it->>'name', '未知')
  ) d
  JOIN public.inventory_items ii ON ii.id = d.item_id
  WHERE d.qty <> 0;
END;
$$;

-- ─── 2. 触发器逻辑：判定时机后调用核心函数 ───
CREATE OR REPLACE FUNCTION public.apply_order_bom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_run := (NEW.status = 'completed');
  ELSE
    IF NEW.status = 'completed'
       AND (OLD.status IS DISTINCT FROM 'completed'
            OR NEW.items IS DISTINCT FROM OLD.items) THEN
      v_run := true;                         -- 首次结账 / 结账后加菜改单
    ELSIF OLD.status = 'completed'
          AND NEW.status IS DISTINCT FROM 'completed' THEN
      -- 结账后作废：传空 items 即全额回补
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

-- ─── 3. 触发器：INSERT / UPDATE ───
DROP TRIGGER IF EXISTS trg_order_bom ON public.orders;
CREATE TRIGGER trg_order_bom
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_order_bom();

-- ─── 4. 校验 ───
SELECT tgname, pg_get_triggerdef(oid) AS def
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass AND tgname = 'trg_order_bom';

-- =============================================================
-- 可选：历史已完成订单回填（幂等，建议低峰期执行一次）
--   对 v2 之前已结账、但未正确扣减的订单重算 BOM。
--   想执行时取消下面注释即可。
-- =============================================================
-- SELECT public.deduct_order_bom(o.id, COALESCE(o.items, '[]'::jsonb))
-- FROM public.orders o
-- WHERE o.status = 'completed';

-- =============================================================
-- 回滚到 v1：重新执行 supabase_inventory_bom.sql 中的函数与触发器定义。
-- =============================================================
