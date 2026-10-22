import { parseTs } from "./format";
import {
  BUSINESS_DAY_HOUR,
  businessDayEnd,
  businessDayKey,
  businessDayStart,
} from "./businessDay";

/* ---------- 基础取值 ---------- */
export const orderTotal = (o: any) =>
  Number(o?.finalTotal ?? o?.total ?? o?.total_amount ?? 0);
export const orderItems = (o: any): any[] =>
  Array.isArray(o?.items) ? o.items : [];
export const itemQty = (it: any) => Number(it?.quantity ?? it?.count ?? 1);
export const itemName = (it: any) => it?.name || it?.title || "未知";

/* ---------- 金额口径（与顾客端 Web 统一） ----------
 * 行金额 = (菜品单价 + Σ 配菜单价) × 数量
 * 配菜单价优先取订单行 addons 快照（{ id, name, price }[]），快照缺失时回退到菜单定义
 * （settings.categories[].items[].addons，{ id, name, ..., price }[]）。
 * 老订单没有 addons 字段（undefined/null/非数组）时按「无配菜」处理，不抛错。
 */

/** 价格归一化："75" / "MAD75" / 75 → 75；空值/非法 → 0 */
export function parsePrice(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const m = String(v ?? "").match(/\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** 订单行上的配菜快照（老订单无该字段时返回空数组） */
export function itemAddons(it: any): any[] {
  return Array.isArray(it?.addons) ? it.addons : [];
}

/** 单价合计：菜品单价 + Σ 配菜单价（未乘数量） */
export function itemUnitTotal(it: any): number {
  return (
    parsePrice(it?.price) +
    itemAddons(it).reduce((s, a) => s + parsePrice(a?.price), 0)
  );
}

/** 行金额：(菜品单价 + Σ 配菜单价) × 数量 */
export const itemRevenue = (it: any) => itemUnitTotal(it) * itemQty(it);

/** 从菜品定义（settings.categories[].items[]）建「菜名 → 配菜定义」索引 */
export function buildMenuAddonMap(settings: any): Map<string, any[]> {
  const map = new Map<string, any[]>();
  const cats = settings?.categories;
  if (!Array.isArray(cats)) return map;
  cats.forEach((c: any) => {
    (c?.items || []).forEach((it: any) => {
      const name = String(it?.title || it?.name || "").trim();
      if (!name) return;
      const list = Array.isArray(it?.addons) ? it.addons : [];
      if (list.length) map.set(name, list);
    });
  });
  return map;
}

/**
 * 订单行配菜定义：优先订单行快照，缺失（老订单/后台导入）时回退菜单定义。
 * 快照里的配菜单价不会被菜单现价覆盖，保证历史单金额可复现。
 */
export function resolveItemAddons(it: any, menuAddonMap?: Map<string, any[]>) {
  const snap = itemAddons(it);
  if (snap.length) return snap;
  const def = menuAddonMap?.get(String(itemName(it)).trim());
  return Array.isArray(def) ? def : [];
}

export const isCompleted = (o: any) => o?.status === "completed";
export const isCancelled = (o: any) => o?.status === "cancelled";

/** 退款/赠送/员工餐/试菜不计营收（但成本仍可能计入） */
const NON_REVENUE_TAGS = ["refund", "gift", "staff", "trial"];
export const isRevenueOrder = (o: any) =>
  isCompleted(o) && !NON_REVENUE_TAGS.includes(String(o?.orderTag || "normal"));

export const orderTime = (o: any) => parseTs(o?.timestamp || o?.created_at);

export const tableName = (o: any) => {
  let t = String(
    o?.customerName || o?.customer_name || o?.table_no || "",
  ).trim();
  t = t.replace(/^桌号[_ ]?/, "").replace(/^table[_ ]?/i, "");
  return t || "未知";
};

/* ---------- 日期区间 ---------- */
export type RangeKey = "today" | "7d" | "30d" | "all" | "custom";

export interface Bounds {
  start: number;
  end: number;
}

export function rangeBounds(
  range: RangeKey,
  from?: string,
  to?: string,
): Bounds {
  const now = Date.now();
  const t0 = businessDayStart(now);
  const daysAgo = (n: number) => {
    const d = new Date(t0);
    d.setDate(d.getDate() - n);
    d.setHours(BUSINESS_DAY_HOUR, 0, 0, 0);
    return d.getTime();
  };
  if (range === "today") return { start: t0, end: now };
  if (range === "7d") return { start: daysAgo(6), end: now };
  if (range === "30d") return { start: daysAgo(29), end: now };
  if (range === "custom" && from && to) {
    return {
      start: businessDayStart(new Date(from + "T12:00:00").getTime()),
      end: businessDayEnd(new Date(to + "T12:00:00").getTime()) - 1,
    };
  }
  return { start: 0, end: now };
}

export function within(o: any, b: Bounds): boolean {
  const t = orderTime(o);
  return t >= b.start && t <= b.end;
}

export function previousBounds(b: Bounds): Bounds {
  const span = b.end - b.start;
  return { start: b.start - span - 1, end: b.start - 1 };
}

/* ---------- KPI ---------- */
export interface Kpi {
  revenue: number;
  orders: number;
  aov: number;
  items: number;
  revenueChange: number;
  ordersChange: number;
  aovChange: number;
}

function pct(cur: number, prev: number): number {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export function computeKpi(orders: any[], b: Bounds): Kpi {
  const cur = orders.filter((o) => within(o, b) && isRevenueOrder(o));
  const pb = previousBounds(b);
  const prev = orders.filter((o) => within(o, pb) && isRevenueOrder(o));

  const rev = (list: any[]) => list.reduce((s, o) => s + orderTotal(o), 0);
  const its = (list: any[]) =>
    list.reduce(
      (s, o) => s + orderItems(o).reduce((a, it) => a + itemQty(it), 0),
      0,
    );

  const revenue = rev(cur);
  const ordersN = cur.length;
  const items = its(cur);
  const aov = ordersN ? revenue / ordersN : 0;

  const pRevenue = rev(prev);
  const pOrders = prev.length;
  const pAov = pOrders ? pRevenue / pOrders : 0;

  return {
    revenue,
    orders: ordersN,
    aov,
    items,
    revenueChange: pct(revenue, pRevenue),
    ordersChange: pct(ordersN, pOrders),
    aovChange: pct(aov, pAov),
  };
}

/* ---------- 趋势 ---------- */
export interface DayPoint {
  key: string;
  label: string;
  revenue: number;
  orders: number;
}

export function dailySeries(orders: any[], days: number): DayPoint[] {
  const start = new Date(businessDayStart());
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const k = businessDayKey(d.getTime());
    const list = orders.filter((o) => {
      const t = orderTime(o);
      return !!t && businessDayKey(t) === k && isRevenueOrder(o);
    });
    out.push({
      key: k,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      revenue: list.reduce((s, o) => s + orderTotal(o), 0),
      orders: list.length,
    });
  }
  return out;
}

/* ---------- 时段分布 ---------- */
export function hourlySeries(
  orders: any[],
): { label: string; orders: number }[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")}时`,
    orders: 0,
  }));
  orders.forEach((o) => {
    if (!isRevenueOrder(o)) return;
    const t = orderTime(o);
    if (!t) return;
    const h = new Date(t).getHours();
    buckets[h]!.orders += 1;
  });
  return buckets;
}

/* ---------- 菜品统计 ---------- */
export interface DishStat {
  name: string;
  qty: number;
  revenue: number;
}

/**
 * 菜品统计：营收含配菜加价（与结账单/小票逐行小计口径一致），
 * menuAddonMap 用于老订单缺 addons 快照时回退菜单定义。
 */
export function dishStats(
  orders: any[],
  menuAddonMap?: Map<string, any[]>,
): DishStat[] {
  const map = new Map<string, DishStat>();
  orders.filter(isRevenueOrder).forEach((o) =>
    orderItems(o).forEach((it) => {
      const name = itemName(it);
      const e = map.get(name) || { name, qty: 0, revenue: 0 };
      e.qty += itemQty(it);
      e.revenue += lineRevenue(it, menuAddonMap);
      map.set(name, e);
    }),
  );
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/* ---------- 分类统计（需菜单分类映射） ---------- */
export function buildDishCategoryMap(settings: any): Map<string, string> {
  const map = new Map<string, string>();
  const cats = settings?.categories;
  if (!Array.isArray(cats)) return map;
  cats.forEach((cat: any) => {
    const catName = cat?.name || cat?.title || "未分类";
    (cat?.items || []).forEach((it: any) => {
      const name = it?.title || it?.name;
      if (name) map.set(String(name), catName);
    });
  });
  return map;
}

/**
 * 行金额（带菜单回退）：订单行缺 addons 快照时按菜单定义的配菜计价。
 * 报表/成本/毛利统一走这个入口，避免与结账单口径不一致。
 */
export function lineRevenue(
  it: any,
  menuAddonMap?: Map<string, any[]>,
): number {
  if (itemAddons(it).length) return itemRevenue(it);
  const addons = resolveItemAddons(it, menuAddonMap);
  const unit =
    parsePrice(it?.price) +
    addons.reduce((s, a) => s + parsePrice(a?.price), 0);
  return unit * itemQty(it);
}

export interface CategoryStat {
  name: string;
  revenue: number;
  qty: number;
}

export function categoryStats(
  orders: any[],
  dishCatMap: Map<string, string>,
  menuAddonMap?: Map<string, any[]>,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  orders.filter(isRevenueOrder).forEach((o) =>
    orderItems(o).forEach((it) => {
      const name = itemName(it);
      const cat = dishCatMap.get(name) || "其他";
      const e = map.get(cat) || { name: cat, revenue: 0, qty: 0 };
      e.revenue += lineRevenue(it, menuAddonMap);
      e.qty += itemQty(it);
      map.set(cat, e);
    }),
  );
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/**
 * 逐行累加得到的订单金额（结账单/小票口径）。
 * 与 orderTotal 的差异只可能来自折扣、退菜等订单级优惠。
 */
export function orderComputedTotal(
  o: any,
  menuAddonMap?: Map<string, any[]>,
): number {
  return orderItems(o).reduce((s, it) => s + lineRevenue(it, menuAddonMap), 0);
}

/* ---------- 支付方式 ---------- */
export function paymentStats(orders: any[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  orders.filter(isRevenueOrder).forEach((o) => {
    const m = o?.paymentMethod || "未标注";
    map.set(m, (map.get(m) || 0) + orderTotal(o));
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/* ---------- 菜单工程矩阵（四象限） ---------- */
export type MatrixQuad = "star" | "plowhorse" | "puzzle" | "dog" | "loss";

export interface MatrixDish extends DishStat {
  quad: MatrixQuad;
}

export function menuEngineering(dishes: DishStat[]): MatrixDish[] {
  if (!dishes.length) return [];
  const avgQty = dishes.reduce((s, d) => s + d.qty, 0) / dishes.length || 0;
  const unitPrices = dishes.map((d) => (d.qty ? d.revenue / d.qty : 0));
  const avgPrice =
    unitPrices.reduce((s, p) => s + p, 0) / (unitPrices.length || 1) || 0;
  return dishes.map((d) => {
    const price = d.qty ? d.revenue / d.qty : 0;
    const highQty = d.qty >= avgQty;
    const highPrice = price >= avgPrice;
    let quad: MatrixQuad = "dog";
    if (highQty && highPrice)
      quad = "star"; // 明星
    else if (highQty && !highPrice)
      quad = "plowhorse"; // 金牛
    else if (!highQty && highPrice) quad = "puzzle"; // 问题
    return { ...d, quad };
  });
}

export const QUAD_LABEL: Record<
  MatrixQuad,
  { title: string; color: string; hint: string }
> = {
  star: {
    title: "明星",
    color: "#f97316",
    hint: "畅销且高毛利，主推",
  },
  plowhorse: {
    title: "金牛",
    color: "#3b82f6",
    hint: "畅销但毛利低，提价或降本",
  },
  puzzle: {
    title: "问题",
    color: "#a855f7",
    hint: "高毛利但滞销，加强推荐",
  },
  dog: {
    title: "瘦狗",
    color: "#71717a",
    hint: "低销量低毛利，考虑下架",
  },
  loss: {
    title: "赔钱菜",
    color: "#ef4444",
    hint: "每单亏钱，立即停售或提价/降本",
  },
};
