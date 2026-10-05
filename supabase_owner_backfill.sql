-- ============================================================
-- 历史汇总补录（解禁后新增）
-- 幂等，可重复执行；在 Supabase SQL Editor 运行本文件。
-- 前端：owner/src/lib/backfill.ts（叠加进 salesSummary / dailySeries）
-- 用途：把没记账的历史营业日补进报表；同一天 upsert 覆盖。
-- ============================================================

create table if not exists public.owner_backfill (
  day        text primary key,          -- YYYY-MM-DD（与 owner_daily 的 day 对齐）
  revenue    numeric not null default 0, -- 当日营业额
  orders     integer not null default 0, -- 当日订单数
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.owner_backfill enable row level security;

drop policy if exists anon_all_owner_backfill on public.owner_backfill;
create policy anon_all_owner_backfill on public.owner_backfill
  for all to anon, authenticated
  using (true) with check (true);

grant all on public.owner_backfill to anon, authenticated;

-- 让 PostgREST 立即识别新表（免重启）
notify pgrst, 'reload schema';

-- 校验
select table_name from information_schema.tables
 where table_schema = 'public' and table_name = 'owner_backfill';
