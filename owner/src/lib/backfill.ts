/* ============ 历史汇总补录 ============
 * 把没记账的历史营业日补进报表：新表 owner_backfill（day 主键，upsert 覆盖）。
 * 叠加点在 aggregate.salesSummary / dailySeries；SQL 未执行时静默返回 0，
 * 报表退回真实值（不影响现有统计）。
 */
import { supabase } from "./supabase";

export interface BackfillEntry {
  /** YYYY-MM-DD（与 owner_daily 的 day 对齐） */
  day: string;
  revenue: number;
  orders: number;
  note: string;
}

let cache: BackfillEntry[] | null = null;

/** 写入后失效，下次读取重新拉 */
export function invalidateBackfill(): void {
  cache = null;
}

export async function fetchBackfill(): Promise<BackfillEntry[]> {
  if (cache) return cache;
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("owner_backfill")
    .select("day, revenue, orders, note")
    .order("day", { ascending: true })
    .limit(2000);
  if (error || !Array.isArray(data)) {
    console.warn("[owner] fetchBackfill:", error?.message || "no table");
    return [];
  }
  cache = (data as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue) || 0,
    orders: Number(r.orders) || 0,
    note: String(r.note ?? ""),
  }));
  return cache;
}

export async function saveBackfill(e: BackfillEntry): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("owner_backfill").upsert(
    {
      day: e.day,
      revenue: e.revenue,
      orders: e.orders,
      note: e.note,
    },
    { onConflict: "day" },
  );
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

/** 纯函数：区间内补录合计（day 落在 [start 日, end 日]） */
export function backfillTotals(
  entries: BackfillEntry[],
  start: string,
  end: string,
): { revenue: number; orders: number } {
  const s = start.slice(0, 10);
  const e = end.slice(0, 10);
  let revenue = 0;
  let orders = 0;
  for (const b of entries) {
    if (b.day >= s && b.day <= e) {
      revenue += b.revenue;
      orders += b.orders;
    }
  }
  return { revenue, orders };
}

/** 纯函数：把补录叠加进日趋势（已有天相加，缺天追加，按 day 升序） */
export function applyBackfill<
  T extends { day: string; revenue: number; orders: number },
>(rows: T[], entries: BackfillEntry[], start: string, end: string): T[] {
  const s = start.slice(0, 10);
  const e = end.slice(0, 10);
  const inRange = entries.filter((b) => b.day >= s && b.day <= e);
  if (!inRange.length) return rows;
  const out = rows.map((r) => ({ ...r }));
  const byDay = new Map(out.map((r) => [r.day, r]));
  for (const b of inRange) {
    const hit = byDay.get(b.day);
    if (hit) {
      hit.revenue += b.revenue;
      hit.orders += b.orders;
    } else {
      const add = { day: b.day, revenue: b.revenue, orders: b.orders } as T;
      out.push(add);
      byDay.set(b.day, add);
    }
  }
  out.sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return out;
}
