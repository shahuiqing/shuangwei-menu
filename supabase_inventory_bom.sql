-- =============================================================
-- 库存 / 配方(BOM) / 采购 —— 结账自动扣库存 + 成本核算
-- 适用：supabase_schema.sql / supabase_setup.sql 之后执行。
-- 特点：幂等（可重复执行）、只新增索引/列/函数/触发器，不删数据。
--
-- 口径（已确认）：
--   · 订单 status -> completed 时，按 recipe_boms 自动扣减 inventory_items.stock
--   · 出库流水 inventory_transactions(type='order_out')，unit_cost 快照当时单价
--   · 以 reference = orders.id 做幂等，重复结账不重复扣
--   · 已结账订单被取消时自动回补
--   · 配方匹配键：recipe_boms.menu_item_name = orders.items[].name
--
-- 执行：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- =============================================================

-- ─── 1. 可选列：后厨档口（用于「后厨用料」按档口统计）───
ALTER TABLE public.recipe_boms ADD COLUMN IF NOT EXISTS station VARCHAR(50) DEFAULT '';

-- ─── 2. 索引：库存流水 / 配方查询 ───
CREATE INDEX IF NOT EXISTS idx_inv_txn_created ON public.inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item   ON public.inventory_transactions (item_id, type);
CREATE INDEX IF NOT EXISTS idx_inv_txn_ref    ON public.inventory_transactions (reference);
CREATE INDEX IF NOT EXISTS idx_bom_name       ON public.recipe_boms (menu_item_name);
CREATE INDEX IF NOT EXISTS idx_orders_completed ON public.orders (status, created_at DESC);

-- ─── 3. 核心函数：结账按 BOM 出库 / 取消回补 ───
CREATE OR REPLACE FUNCTION public.apply_order_bom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it        jsonb;
  v_name    text;
  v_qty     numeric;
  b         record;
  v_deduct  numeric;
BEGIN
  -- 3.1 首次进入 completed：按配方出库
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    -- 幂等：该订单已扣过则跳过
    IF EXISTS (
      SELECT 1 FROM public.inventory_transactions
      WHERE reference = NEW.id AND type = 'order_out'
    ) THEN
      RETURN NEW;
    END IF;

    FOR it IN
      SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
    LOOP
      v_name := it->>'name';
      v_qty  := COALESCE((it->>'quantity')::numeric, 0);
      IF v_name IS NULL OR v_qty = 0 THEN
        CONTINUE;
      END IF;

      FOR b IN
        SELECT rb.inventory_item_id AS id,
               rb.dosage,
               rb.unit,
               ii.name  AS inv_name,
               ii.price AS unit_cost
        FROM public.recipe_boms rb
        JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
        WHERE rb.menu_item_name = v_name
      LOOP
        v_deduct := COALESCE(b.dosage, 0) * v_qty;

        UPDATE public.inventory_items
           SET stock = stock - v_deduct,
               updated_at = now()
         WHERE id = b.id;

        INSERT INTO public.inventory_transactions
          (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
        VALUES
          (LEFT('TXN-' || NEW.id || '-' || b.id, 100),
           b.id, b.inv_name, 'order_out',
           -v_deduct,               -- 出库记为负
           b.unit, b.unit_cost, NEW.id, v_name, now());
      END LOOP;
    END LOOP;
  END IF;

  -- 3.2 已结账后被取消：写反向流水并加回库存
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    IF EXISTS (
      SELECT 1 FROM public.inventory_transactions
      WHERE reference = NEW.id AND notes = '结账后取消回补'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.inventory_transactions
      (id, item_id, item_name, type, quantity, unit, unit_cost, reference, notes, created_at)
    SELECT LEFT('REV-' || NEW.id || '-' || t.item_id, 100),
           t.item_id, t.item_name, 'adjustment',
           -t.quantity,             -- order_out 为负，取反即为正（回补）
           t.unit, t.unit_cost, NEW.id, '结账后取消回补', now()
    FROM public.inventory_transactions t
    WHERE t.reference = NEW.id AND t.type = 'order_out';

    UPDATE public.inventory_items ii
       SET stock = ii.stock - x.qty,
           updated_at = now()
    FROM (
      SELECT item_id, SUM(quantity) AS qty
      FROM public.inventory_transactions
      WHERE reference = NEW.id AND type = 'order_out'
      GROUP BY item_id
    ) x
    WHERE ii.id = x.item_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 4. 触发器 ───
DROP TRIGGER IF EXISTS trg_order_bom ON public.orders;
CREATE TRIGGER trg_order_bom
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_order_bom();

-- ─── 5. 便捷视图：菜品成本（成本 = Σ 配方用量 × 当前单价）───
CREATE OR REPLACE VIEW public.v_dish_cost AS
SELECT
  rb.menu_item_name AS dish_name,
  COALESCE(SUM(rb.dosage * ii.price), 0) AS cost,
  COUNT(*) AS ingredient_count
FROM public.recipe_boms rb
LEFT JOIN public.inventory_items ii ON ii.id = rb.inventory_item_id
GROUP BY rb.menu_item_name;

GRANT SELECT ON public.v_dish_cost TO anon, authenticated;

-- ─── 6. 校验：应返回触发器 + 函数 + 视图 ───
SELECT tgname AS trigger_name
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass AND tgname = 'trg_order_bom';

SELECT proname AS function_name
FROM pg_proc WHERE proname = 'apply_order_bom';

-- =============================================================
-- 回滚（需要时取消注释执行）
-- =============================================================
-- DROP TRIGGER IF EXISTS trg_order_bom ON public.orders;
-- DROP FUNCTION IF EXISTS public.apply_order_bom();
-- DROP VIEW IF EXISTS public.v_dish_cost;
