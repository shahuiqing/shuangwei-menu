/**
 * 免费额度友好的数据访问层：
 * - 所有仪表盘/报表统计走 Postgres 聚合 RPC，只回传小结果集（省 egress）
 * - 订单列表走服务端分页（select + range + count）
 * - 只拉「近况」少量订单用于实时流
 */
import { supabase } from "./supabase";
import type { RangeKey } from "./analytics";

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export interface IsoRange {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

/** 将业务区间转为 ISO，并给出「上一周期」用于环比 */
export function rangeToIso(
  range: RangeKey,
  from?: string,
  to?: string,
): IsoRange {
  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  let start = t0;
  let end = now.getTime();
  if (range === "7d") start = t0 - 6 * 86400000;
  else if (range === "30d") start = t0 - 29 * 86400000;
  else if (range === "all") start = 0;
  else if (range === "custom" && from && to) {
    start = new Date(from + "T00:00:00").getTime();
    end = new Date(to + "T23:59:59").getTime();
  }
  const span = end - start;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    prevStart: new Date(start - span - 1).toISOString(),
    prevEnd: new Date(start - 1).toISOString(),
  };
}

/* 数据库未初始化（聚合函数缺失）时的诊断通知 */
let schemaErrorNotified = false;
let schemaErrorListeners: (() => void)[] = [];
export function onRpcSchemaError(cb: () => void): () => void {
  schemaErrorListeners.push(cb);
  return () => {
    schemaErrorListeners = schemaErrorListeners.filter((l) => l !== cb);
  };
}

function isMissingFunction(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function|schema cache|does not exist/i.test(
      error.message || "",
    )
  );
}

const call = async <T>(
  fn: string,
  args: Record<string, unknown>,
  fallback: T,
): Promise<T> => {
  if (!supabase) return fallback;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`[owner] rpc ${fn}:`, error.message);
    if (isMissingFunction(error) && !schemaErrorNotified) {
      schemaErrorNotified = true;
      schemaErrorListeners.forEach((cb) => cb());
    }
    return fallback;
  }
  return (data ?? fallback) as T;
};

/* ============ 汇总 ============ */

export interface SalesSummary {
  revenue: number;
  orders: number;
  items: number;
  completed: number;
}

export async function salesSummary(
  start: string,
  end: string,
): Promise<SalesSummary> {
  const rows = await call<SalesSummary[]>(
    "owner_sales_summary",
    { p_start: start, p_end: end },
    [],
  );
  const r = rows[0];
  return {
    revenue: Number(r?.revenue || 0),
    orders: Number(r?.orders || 0),
    items: Number(r?.items || 0),
    completed: Number(r?.completed || 0),
  };
}

/* ============ 趋势 / 分布 ============ */

export interface DailyPoint {
  day: string;
  revenue: number;
  orders: number;
}

export async function dailySeries(
  start: string,
  end: string,
): Promise<DailyPoint[]> {
  const rows = await call<DailyPoint[]>(
    "owner_daily",
    { p_start: start, p_end: end, p_tz: TZ },
    [],
  );
  return rows.map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue || 0),
    orders: Number(r.orders || 0),
  }));
}

export interface DishStat {
  name: string;
  qty: number;
  revenue: number;
}

export async function dishStats(
  start: string,
  end: string,
): Promise<DishStat[]> {
  const rows = await call<DishStat[]>(
    "owner_dish_stats",
    { p_start: start, p_end: end },
    [],
  );
  return rows.map((r) => ({
    name: r.name || "未知",
    qty: Number(r.qty || 0),
    revenue: Number(r.revenue || 0),
  }));
}

export interface DailyProfit {
  day: string;
  revenue: number;
  cogs: number;
}

export async function dailyProfit(
  start: string,
  end: string,
): Promise<DailyProfit[]> {
  const rows = await call<DailyProfit[]>(
    "owner_daily_profit",
    { p_start: start, p_end: end, p_tz: TZ },
    [],
  );
  return rows.map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue || 0),
    cogs: Number(r.cogs || 0),
  }));
}

export interface HourPoint {
  hour: number;
  orders: number;
}

export async function hourlySeries(
  start: string,
  end: string,
): Promise<HourPoint[]> {
  return call<HourPoint[]>(
    "owner_hourly",
    { p_start: start, p_end: end, p_tz: TZ },
    [],
  );
}

/* ============ 消耗 ============ */

export interface ConsStat {
  key: string;
  qty: number;
  cost: number;
}

export async function consumptionByItem(
  start: string,
  end: string,
  type: string = "order_out",
): Promise<ConsStat[]> {
  return call<ConsStat[]>(
    "owner_consumption",
    { p_start: start, p_end: end, p_type: type },
    [],
  );
}

export async function consumptionByDish(
  start: string,
  end: string,
  type: string = "order_out",
): Promise<ConsStat[]> {
  return call<ConsStat[]>(
    "owner_consumption_dish",
    { p_start: start, p_end: end, p_type: type },
    [],
  );
}

export async function consumptionByDay(
  start: string,
  end: string,
  type: string = "order_out",
): Promise<{ day: string; qty: number; cost: number }[]> {
  return call<{ day: string; qty: number; cost: number }[]>(
    "owner_consumption_daily",
    { p_start: start, p_end: end, p_tz: TZ, p_type: type },
    [],
  );
}

/* ============ 订单分页 / 近况 ============ */

export interface OrdersPage {
  rows: any[];
  count: number;
}

export async function fetchOrdersPage(opts: {
  start: string;
  end: string;
  status?: string;
  search?: string;
  sort?: "time_desc" | "time_asc" | "amount_desc";
  offset?: number;
  limit?: number;
}): Promise<OrdersPage> {
  if (!supabase) return { rows: [], count: 0 };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  let q = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .gte("created_at", opts.start)
    .lt("created_at", opts.end);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.search?.trim()) {
    const s = opts.search.trim().replace(/[%,]/g, "");
    q = q.or(
      `table_no.ilike.%${s}%,customer_name.ilike.%${s}%,id.ilike.%${s}%`,
    );
  }
  if (opts.sort === "time_asc") q = q.order("created_at", { ascending: true });
  else if (opts.sort === "amount_desc")
    q = q.order("total", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) {
    console.warn("[owner] fetchOrdersPage:", error.message);
    return { rows: [], count: 0 };
  }
  return { rows: data || [], count: count || 0 };
}

/** 允许的订单状态流转 */
export const NEXT_STATUS: Record<string, string[]> = {
  pending: ["cooking", "cancelled"],
  cooking: ["served", "cancelled"],
  served: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** 老板端修改订单状态（写库后由顾客端 postgres_changes 自动感知） */
export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<boolean> {
  if (!supabase) return false;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, timestamp: now };
  if (status === "completed") patch.completedAt = now;
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) {
    console.warn("[owner] updateOrderStatus:", error.message);
    return false;
  }
  return true;
}

/** 仅拉少量近况订单用于实时流 */
export async function fetchRecentOrders(limit = 30): Promise<any[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[owner] fetchRecentOrders:", error.message);
    return [];
  }
  return data || [];
}

/* ============ 用量 / 清理 ============ */

export interface TableStats {
  orders: number;
  inventory: number;
  boms: number;
  purchases: number;
  txns: number;
  total_bytes: number;
}

export async function tableStats(): Promise<TableStats> {
  const rows = await call<TableStats[]>("owner_table_stats", {}, []);
  const r = rows[0];
  return {
    orders: Number(r?.orders || 0),
    inventory: Number(r?.inventory || 0),
    boms: Number(r?.boms || 0),
    purchases: Number(r?.purchases || 0),
    txns: Number(r?.txns || 0),
    total_bytes: Number(r?.total_bytes || 0),
  };
}

export async function prune(
  ordersDays: number,
  txnsDays: number,
): Promise<{ removed_orders: number; removed_txns: number } | null> {
  const rows = await call<{ removed_orders: number; removed_txns: number }[]>(
    "owner_prune",
    { p_orders_days: ordersDays, p_txns_days: txnsDays },
    [],
  );
  return rows[0] || null;
}
