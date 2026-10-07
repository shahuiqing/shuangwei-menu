-- ============================================================
-- 操作日志 / 盘点历史上云（解禁后新增）
-- 幂等，可重复执行；在 Supabase SQL Editor 运行本文件。
-- 前端：owner/src/lib/cloudSync.ts（上行防抖 upsert，下行全量拉取合并）
-- ============================================================

-- 1) 操作日志（本地 auditLog 上云，复合主键天然幂等去重）
create table if not exists public.owner_audit_log (
  at     bigint not null,
  action text not null,
  detail text not null default '',
  primary key (at, action, detail)
);

-- 2) 盘点历史（本地 stocktakeHistory 上云，at 毫秒时间戳为主键）
create table if not exists public.owner_stocktake (
  at        bigint primary key,
  day       text not null,
  items     integer not null default 0,
  diffs     integer not null default 0,
  net_value numeric not null default 0
);

alter table public.owner_audit_log enable row level security;
alter table public.owner_stocktake enable row level security;

drop policy if exists anon_all_owner_audit_log on public.owner_audit_log;
create policy anon_all_owner_audit_log on public.owner_audit_log
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists anon_all_owner_stocktake on public.owner_stocktake;
create policy anon_all_owner_stocktake on public.owner_stocktake
  for all to anon, authenticated
  using (true) with check (true);

grant all on public.owner_audit_log to anon, authenticated;
grant all on public.owner_stocktake to anon, authenticated;

-- 让 PostgREST 立即识别新表（免重启）
notify pgrst, 'reload schema';

-- 校验
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('owner_audit_log', 'owner_stocktake');
