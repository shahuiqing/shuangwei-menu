-- ============================================================
-- POS / 平台订单 CSV 导入（解禁后新增）
-- 幂等，可重复执行；在 Supabase SQL Editor 运行本文件。
-- 前端：owner/src/lib/csv.ts（解析）+ aggregate.importOrders（本 RPC）
--
-- 为什么走 RPC：orders 上有 AFTER INSERT 触发器 trg_order_bom，
-- status='completed' 的订单会扣减库存（BOM）。导入的是历史订单，
-- 不能扣当前库存 —— RPC 内用 session_replication_role=replica
-- 在本次调用（单事务）内跳过触发器；RPC 为 SECURITY DEFINER。
-- ============================================================

create or replace function public.owner_import_orders(p_orders jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_id text;
  v_ts timestamptz;
  v_n integer := 0;
begin
  -- 本事务内跳过触发器（含 BOM 扣减）；请求结束自动恢复
  perform set_config('session_replication_role', 'replica', true);

  for r in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) loop
    v_ts := coalesce((r->>'timestamp')::timestamptz, now());
    v_id := nullif(r->>'id', '');
    if v_id is null then
      v_id := 'imp-' || md5(coalesce(r->>'orderNumber', '') || v_ts::text || coalesce(r->>'tableNo', ''));
    end if;

    insert into public.orders (
      id, _id,
      "tableNo", table_no,
      customer_name, "customerName",
      type, status,
      total, total_amount, "finalTotal",
      items, notes,
      "orderNumber", "paymentMethod",
      "timestamp", "created_at", "createdAt",
      "isExternal", "unprintedNewOrder", "unprintedAdditions"
    ) values (
      v_id, v_id,
      coalesce(nullif(r->>'tableNo', ''), 'A1'),
      coalesce(nullif(r->>'tableNo', ''), 'A1'),
      coalesce(r->>'customerName', ''), coalesce(r->>'customerName', ''),
      coalesce(r->>'type', 'dine_in'),
      coalesce(r->>'status', 'completed'),
      coalesce((r->>'total')::numeric, 0),
      coalesce((r->>'total')::numeric, 0),
      coalesce((r->>'total')::numeric, 0),
      coalesce(r->'items', '[]'::jsonb),
      coalesce(r->>'notes', ''),
      coalesce(r->>'orderNumber', ''),
      coalesce(r->>'paymentMethod', ''),
      v_ts, v_ts, v_ts,
      coalesce((r->>'isExternal')::boolean, false),
      false, '[]'::jsonb
    )
    on conflict (id) do nothing;
    if found then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;

grant execute on function public.owner_import_orders(jsonb) to anon, authenticated;

-- 让 PostgREST 识别新函数
notify pgrst, 'reload schema';

-- 校验
select proname from pg_proc p
 join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname = 'owner_import_orders';
