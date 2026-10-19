/* ============ 历史汇总补录 ============
 * 把没记账的历史营业日补进报表：新表 owner_backfill（day 主键，upsert 覆盖）。
 * 叠加点在 aggregate.salesSummary / dailySeries；SQL 未执行时静默返回 0，
 * 报表退回真实值（不影响现有统计）。
 */
import { supabase } from "./supabase";
import { businessDayKey } from "./businessDay";

export interface BackfillEntry {
  /** YYYY-MM-DD（与 owner_daily 的 day 对齐） */
  day: string;
  revenue: number;
  orders: number;
  /** 当天食材成本（可选；老数据/未升级库为 0） */
  cogs?: number;
  note: string;
}

let cache: BackfillEntry[] | null = null;

/** 写入后失效，下次读取重新拉 */
export function invalidateBackfill(): void {
  cache = null;
}

async function fetchRaw(withCogs: boolean) {
  return supabase!
    .from("owner_backfill")
    .select(
      withCogs
        ? "day, revenue, orders, cogs, note"
        : "day, revenue, orders, note",
    )
    .order("day", { ascending: true })
    .limit(2000);
}

export async function fetchBackfill(): Promise<BackfillEntry[]> {
  if (cache) return cache;
  if (!supabase) return [];
  let res = await fetchRaw(true);
  let data: unknown = res.data;
  if (res.error) {
    // 未执行最新 SQL 时没有 cogs 列，退回旧字段，避免整个补录消失
    res = await fetchRaw(false);
    data = res.data;
  }
  if (res.error || !Array.isArray(data)) {
    console.warn("[owner] fetchBackfill:", res.error?.message || "no table");
    return [];
  }
  cache = (data as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue) || 0,
    orders: Number(r.orders) || 0,
    cogs: Number(r.cogs) || 0,
    note: String(r.note ?? ""),
  }));
  return cache;
}

export async function saveBackfill(e: BackfillEntry): Promise<boolean> {
  if (!supabase) return false;
  const row = {
    day: e.day,
    revenue: e.revenue,
    orders: e.orders,
    cogs: Number(e.cogs) || 0,
    note: e.note,
  };
  let { error } = await supabase
    .from("owner_backfill")
    .upsert(row, { onConflict: "day" });
  if (error) {
    // cogs 列未升级：退回旧字段保存，至少不丢营收补录
    const legacy = { ...row } as Record<string, unknown>;
    delete legacy.cogs;
    const retry = await supabase
      .from("owner_backfill")
      .upsert(legacy, { onConflict: "day" });
    error = retry.error;
  }
  if (error) {
    console.warn("[owner] saveBackfill:", error.message);
    return false;
  }
  invalidateBackfill();
  return true;
}

export async function deleteBackfill(day: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("owner_backfill")
    .delete()
    .eq("day", day);
  if (error) {
    console.warn("[owner] deleteBackfill:", error.message);
    return false;
  }
  invalidateBackfill();
  return true;
}

/** ISO / YYYY-MM-DD → 营业日键（不能直接 slice，toISOString 会跨时区偏移） */
function localDay(v: string): string {
  const s = String(v || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return businessDayKey(d.getTime());
}

/** 纯函数：区间内补录合计（day 落在 [start 日, end 日]） */
export function backfillTotals(
  entries: BackfillEntry[],
  start: string,
  end: string,
): { revenue: number; orders: number; cogs: number } {
  const s = localDay(start);
  const e = localDay(end);
  let revenue = 0;
  let orders = 0;
  let cogs = 0;
  for (const b of entries) {
    if (b.day >= s && b.day <= e) {
      revenue += b.revenue;
      orders += b.orders;
      cogs += Number(b.cogs) || 0;
    }
  }
  return { revenue, orders, cogs };
}

/** 纯函数：把补录叠加进日趋势（已有天相加，缺天追加，按 day 升序） */
export function applyBackfill<
  T extends {
    day: string;
    revenue: number;
    orders?: number;
    cogs?: number;
  },
>(rows: T[], entries: BackfillEntry[], start: string, end: string): T[] {
  const s = localDay(start);
  const e = localDay(end);
  const inRange = entries.filter((b) => b.day >= s && b.day <= e);
  if (!inRange.length) return rows;
  const out = rows.map((r) => ({ ...r }));
  const byDay = new Map(out.map((r) => [r.day, r]));
  for (const b of inRange) {
    const hit = byDay.get(b.day);
    if (hit) {
      hit.revenue += b.revenue;
      if (typeof hit.orders === "number") hit.orders += b.orders;
      if (typeof hit.cogs === "number") hit.cogs += Number(b.cogs) || 0;
    } else {
      const add = {
        day: b.day,
        revenue: b.revenue,
        orders: b.orders,
        cogs: Number(b.cogs) || 0,
      } as T;
      out.push(add);
      byDay.set(b.day, add);
    }
  }
  out.sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return out;
}
