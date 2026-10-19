/* ============ 固定成本（房租/人工/水电等）+ 净利计算 ============
 * owner_fixed_cost 表：按月金额录入，按当月自然天数摊到每日。
 * 净利 = 营收 − 食材成本(COGS) − 损耗 − 固定成本。
 * 依赖 SQL：supabase_owner_all.sql（未执行时读写静默失败，返回空，净利退回毛利口径）。
 */
import { supabase } from "./supabase";

export interface FixedCost {
  id: string;
  name: string;
  category: string; // 房租 / 人工 / 水电燃气 / 其他
  amount: number; // 月金额
  /** 生效起始月 YYYY-MM（含）；之前月份不计入 */
  startDate: string;
  note: string;
}

export const FIXED_CATEGORIES = ["房租", "人工", "水电燃气", "其他"] as const;

const genId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function newFixedCost(): FixedCost {
  return {
    id: genId("fc"),
    name: "",
    category: "其他",
    amount: 0,
    startDate: currentMonth(),
    note: "",
  };
}

/** 当月自然天数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 某一天的固定成本：Σ 生效月金额 ÷ 当月天数 */
export function dailyFixedCost(costs: FixedCost[], date: Date): number {
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return costs.reduce((sum, c) => {
    if (!c.startDate || c.startDate > ym) return sum;
    const a = Number(c.amount);
    if (!(a > 0)) return sum;
    return sum + a / days;
  }, 0);
}

/**
 * 区间固定成本：按自然日摊派，闭区间（含首尾两天）。
 * 跨月时各月按自己的天数摊；startMs 传 0（全部）也能安全计算。
 */
export function fixedCostForRange(
  costs: FixedCost[],
  startMs: number,
  endMs: number,
): number {
  if (!costs.length || !(endMs >= startMs)) return 0;
  const start = new Date(Math.max(startMs, 0));
  const end = new Date(endMs);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const dayMs = 86400000;
  let total = 0;

  while (cursor.getTime() <= last.getTime()) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 1).getTime();
    const from = new Date(Math.max(start.getTime(), monthStart));
    const to = new Date(Math.min(end.getTime(), monthEnd - 1));
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    const days = Math.round((to.getTime() - from.getTime()) / dayMs) + 1;
    if (days > 0) {
      total += dailyFixedCost(costs, new Date(year, month, 15)) * days;
    }
    cursor.setMonth(month + 1);
  }
  return total;
}

/** 盈亏平衡营收：固定成本 ÷ (1 − 食材成本率)；成本率钳制避免除零 */
export function breakEvenRevenue(
  fixedCost: number,
  foodCostRate: number,
): number {
  const rate = Math.min(Math.max(foodCostRate, 0), 0.95);
  return fixedCost / Math.max(1 - rate, 0.05);
}

/** 净利 = 营收 − 食材成本 − 损耗 − 固定成本 */
export function netProfit(
  revenue: number,
  cogs: number,
  waste: number,
  fixedCost: number,
): number {
  return revenue - cogs - waste - fixedCost;
}

/* ============ CRUD ============ */

export async function fetchFixedCosts(): Promise<FixedCost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("owner_fixed_cost")
    .select("*")
    .order("category", { ascending: true });
  if (error || !Array.isArray(data)) {
    console.warn("[owner] fetchFixedCosts:", error?.message || "no table");
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => {
    const start = String(r.start_date ?? "").slice(0, 7);
    const created = String(r.created_at ?? "").slice(0, 7);
    return {
      id: String(r.id),
      name: String(r.name ?? ""),
      category: String(r.category ?? "其他"),
      amount: Number(r.amount) || 0,
      startDate: start || created || currentMonth(),
      note: String(r.note ?? ""),
    };
  });
}

export async function saveFixedCost(c: FixedCost): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("owner_fixed_cost").upsert({
    id: c.id,
    name: c.name,
    category: c.category,
    amount: c.amount,
    start_date: (c.startDate || currentMonth()).slice(0, 7),
    note: c.note,
  });
  if (error) {
    console.warn("[owner] saveFixedCost:", error.message);
    return false;
  }
  return true;
}

export async function deleteFixedCost(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("owner_fixed_cost")
    .delete()
    .eq("id", id);
  if (error) {
    console.warn("[owner] deleteFixedCost:", error.message);
    return false;
  }
  return true;
}
