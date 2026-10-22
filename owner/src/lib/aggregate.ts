/**
 * 免费额度友好的数据访问层：
 * - 所有仪表盘/报表统计走 Postgres 聚合 RPC，只回传小结果集（省 egress）
 * - 订单列表走服务端分页（select + range + count）
 * - 只拉「近况」少量订单用于实时流
 */
import { supabase } from "./supabase";
import { saveSnap, snapFallback } from "./snapshot";
import { fetchBackfill, backfillTotals, applyBackfill } from "./backfill";
import {
  BUSINESS_DAY_HOUR,
  businessDayEnd,
  businessDayKey,
  businessDayStart,
} from "./businessDay";
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
  const t0 = businessDayStart(now.getTime());
  const daysAgo = (n: number) => {
    const d = new Date(t0);
    d.setDate(d.getDate() - n);
    d.setHours(BUSINESS_DAY_HOUR, 0, 0, 0);
    return d.getTime();
  };
  let start = t0;
  let end = now.getTime();
  if (range === "7d") start = daysAgo(6);
  else if (range === "30d") start = daysAgo(29);
  else if (range === "all") start = 0;
  else if (range === "custom" && from && to) {
    start = businessDayStart(new Date(from + "T12:00:00").getTime());
    end = businessDayEnd(new Date(to + "T12:00:00").getTime()) - 1;
  }
  const span = end - start;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    prevStart: new Date(start - span - 1).toISOString(),
    prevEnd: new Date(start - 1).toISOString(),
  };
}

/* 数据库未初始化（聚合函数/列缺失）时的诊断通知 */
export interface RpcSchemaError {
  fn: string;
  code?: string;
  message: string;
}

let schemaError: RpcSchemaError | null = null;
let schemaErrorListeners: ((e: RpcSchemaError) => void)[] = [];

export function onRpcSchemaError(cb: (e: RpcSchemaError) => void): () => void {
  schemaErrorListeners.push(cb);
  return () => {
    schemaErrorListeners = schemaErrorListeners.filter((l) => l !== cb);
  };
}

export function getRpcSchemaError(): RpcSchemaError | null {
  return schemaError;
}

/** 是否为「函数/列缺失」类错误（多为未执行 SQL 脚本） */
function isSchemaError(error: { code?: string; message?: string }): boolean {
  const msg = error.message || "";
  return (
    error.code === "PGRST202" || // function not found
    error.code === "PGRST204" || // column not found
    error.code === "42703" || // undefined_column
    /could not find the function|schema cache|does not exist|function .*does not exist/i.test(
      msg,
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
    console.warn(`[owner] rpc ${fn}:`, error.message, error.code);
    if (isSchemaError(error)) {
      schemaError = { fn, code: error.code, message: error.message };
      schemaErrorListeners.forEach((cb) => cb(schemaError!));
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
  const [rows, bf] = await Promise.all([
    call<SalesSummary[]>(
      "owner_sales_summary",
      { p_start: start, p_end: end },
      [],
    ),
    fetchBackfill(),
  ]);
  const r = rows[0];
  const t = backfillTotals(bf, start, end);
  return {
    revenue: Number(r?.revenue || 0) + t.revenue,
    orders: Number(r?.orders || 0) + t.orders,
    items: Number(r?.items || 0),
    completed: Number(r?.completed || 0) + t.orders,
  };
}

/* ============ 成本汇总（快照 COGS / 损耗 / 平台收入） ============ */

export interface CostSummary {
  revenue: number;
  cogs: number;
  waste: number;
  externalRevenue: number;
  /** 赠送/员工餐/试菜的成本（不计入销售 COGS，单列费用） */
  freeCogs: number;
}

/**
 * 区间成本汇总：优先读结账时写入的 cogsSnapshot，历史原料调价不再影响旧账。
 * 数据库未执行最新 SQL 时返回 null，调用方回退旧口径。
 */
export async function costSummary(
  start: string,
  end: string,
): Promise<CostSummary | null> {
  const [rows, bf] = await Promise.all([
    call<
      {
        revenue: number;
        cogs: number;
        waste: number;
        external_revenue: number;
        free_cogs?: number;
      }[]
    >("owner_cost_summary", { p_start: start, p_end: end }, []),
    fetchBackfill(),
  ]);
  const r = rows[0];
  if (!r) return null;
  const t = backfillTotals(bf, start, end);
  return {
    revenue: Number(r.revenue || 0) + t.revenue,
    cogs: Number(r.cogs || 0) + t.cogs,
    waste: Number(r.waste || 0),
    externalRevenue: Number(r.external_revenue || 0),
    freeCogs: Number(r.free_cogs || 0),
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
  const [rows, bf] = await Promise.all([
    call<DailyPoint[]>(
      "owner_daily",
      { p_start: start, p_end: end, p_tz: TZ },
      [],
    ),
    fetchBackfill(),
  ]);
  const mapped = rows.map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue || 0),
    orders: Number(r.orders || 0),
  }));
  return applyBackfill(
    fillDailyGaps(mapped, start, end, (day) => ({
      day,
      revenue: 0,
      orders: 0,
    })),
    bf,
    start,
    end,
  );
}

/** 补零：SQL 只返回有订单的营业日，图表需要连续日期 */
function fillDailyGaps<T extends { day: string }>(
  rows: T[],
  start: string,
  end: string,
  make: (day: string) => T,
): T[] {
  const startMs = businessDayStart(new Date(start).getTime());
  const endMs = businessDayStart(new Date(end).getTime());
  if (!(endMs >= startMs) || endMs - startMs > 366 * 86400000) return rows;
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  const d = new Date(startMs);
  const last = new Date(endMs);
  while (d.getTime() <= last.getTime()) {
    const k = businessDayKey(d.getTime());
    out.push(byDay.get(k) || make(k));
    d.setDate(d.getDate() + 1);
  }
  return out;
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
  const [rows, bf] = await Promise.all([
    call<DailyProfit[]>(
      "owner_daily_profit",
      { p_start: start, p_end: end, p_tz: TZ },
      [],
    ),
    fetchBackfill(),
  ]);
  const mapped = rows.map((r) => ({
    day: String(r.day),
    revenue: Number(r.revenue || 0),
    cogs: Number(r.cogs || 0),
  }));
  return applyBackfill(
    fillDailyGaps(mapped, start, end, (day) => ({
      day,
      revenue: 0,
      cogs: 0,
    })),
    bf,
    start,
    end,
  );
}

export interface PaymentStat {
  method: string;
  revenue: number;
}

/** 按支付方式统计营收（服务端聚合，排除退款/赠送/员工餐/试菜） */
export async function paymentStatsRange(
  start: string,
  end: string,
): Promise<PaymentStat[]> {
  const rows = await call<PaymentStat[]>(
    "owner_payment_stats",
    { p_start: start, p_end: end },
    [],
  );
  return rows.map((r) => ({
    method: r.method || "未标注",
    revenue: Number(r.revenue || 0),
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
  item_id?: string;
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

/** 最近一笔已结账订单的时间，用于日历默认定位到有数据的月份 */
export async function latestCompletedOrderAt(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select("created_at")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[owner] latestCompletedOrderAt:", error.message);
    return null;
  }
  return data?.created_at ?? null;
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
  // 不改写 timestamp：它是订单业务时间，改状态不能把历史订单挪到今天
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "completed") patch.completedAt = now;
  if (status === "cooking") patch.cookingAt = now;
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) {
    console.warn("[owner] updateOrderStatus:", error.message);
    return false;
  }
  return true;
}

/** 编辑订单可改字段（桌号/姓名/备注/金额/支付方式） */
export async function updateOrderFields(
  id: string,
  patch: {
    table_no?: string;
    customer_name?: string;
    customerName?: string;
    notes?: string;
    total?: number;
    total_amount?: number;
    finalTotal?: number;
    paymentMethod?: string;
  },
): Promise<boolean> {
  if (!supabase) return false;
  // 不改写 timestamp（否则历史订单会被挪到当天，报表失真）
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) {
    console.warn("[owner] updateOrderFields:", error.message);
    return false;
  }
  return true;
}

/** 删除订单（谨慎：通常保留历史，仅用于误单清理） */
export async function deleteOrder(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) {
    console.warn("[owner] deleteOrder:", error.message);
    return false;
  }
  return true;
}

/** 批量导入历史订单（RPC 绕过 BOM 触发器不扣库存；同 id 幂等跳过）。
 *  返回实际插入条数；未执行 SQL / 失败返回 -1。 */
export async function importOrders(rows: unknown[]): Promise<number> {
  if (!rows.length) return 0;
  return call<number>("owner_import_orders", { p_orders: rows }, -1);
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
    return snapFallback(`orders:${limit}`, []);
  }
  const rows = data || [];
  saveSnap(`orders:${limit}`, rows);
  return rows;
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
