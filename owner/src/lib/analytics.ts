import { dayKey, parseTs } from "./format";

/* ---------- 基础取值 ---------- */
export const orderTotal = (o: any) => Number(o?.total ?? o?.total_amount ?? 0);
export const orderItems = (o: any): any[] =>
  Array.isArray(o?.items) ? o.items : [];
export const itemQty = (it: any) => Number(it?.quantity ?? it?.count ?? 1);
export const itemName = (it: any) => it?.name || it?.title || "未知";
export const itemRevenue = (it: any) => Number(it?.price || 0) * itemQty(it);
export const isCompleted = (o: any) => o?.status === "completed";
export const isCancelled = (o: any) => o?.status === "cancelled";
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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  if (range === "today") return { start: t0, end: now };
  if (range === "7d") return { start: t0 - 6 * 86400000, end: now };
  if (range === "30d") return { start: t0 - 29 * 86400000, end: now };
  if (range === "custom" && from && to) {
    return {
      start: new Date(from + "T00:00:00").getTime(),
      end: new Date(to + "T23:59:59").getTime(),
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
  const cur = orders.filter((o) => within(o, b) && !isCancelled(o));
  const pb = previousBounds(b);
  const prev = orders.filter((o) => within(o, pb) && !isCancelled(o));

  const rev = (list: any[]) =>
    list.filter(isCompleted).reduce((s, o) => s + orderTotal(o), 0);
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
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const k = dayKey(d.getTime());
    const list = orders.filter(
      (o) => dayKey(o.timestamp || o.created_at) === k && !isCancelled(o),
    );
    out.push({
      key: k,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      revenue: list.filter(isCompleted).reduce((s, o) => s + orderTotal(o), 0),
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
    if (isCancelled(o)) return;
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

export function dishStats(orders: any[]): DishStat[] {
  const map = new Map<string, DishStat>();
  orders.forEach((o) =>
    orderItems(o).forEach((it) => {
      const name = itemName(it);
      const e = map.get(name) || { name, qty: 0, revenue: 0 };
      e.qty += itemQty(it);
      e.revenue += itemRevenue(it);
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

export interface CategoryStat {
  name: string;
  revenue: number;
  qty: number;
}

export function categoryStats(
  orders: any[],
  dishCatMap: Map<string, string>,
): CategoryStat[] {
  const map = new Map<string, CategoryStat>();
  orders.forEach((o) =>
    orderItems(o).forEach((it) => {
      const name = itemName(it);
      const cat = dishCatMap.get(name) || "其他";
      const e = map.get(cat) || { name: cat, revenue: 0, qty: 0 };
      e.revenue += itemRevenue(it);
      e.qty += itemQty(it);
      map.set(cat, e);
    }),
  );
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/* ---------- 支付方式 ---------- */
export function paymentStats(orders: any[]): { name: string; value: number }[] {
  const map = new Map<string, number>();
  orders.filter(isCompleted).forEach((o) => {
    const m = o?.paymentMethod || "未标注";
    map.set(m, (map.get(m) || 0) + orderTotal(o));
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/* ---------- 菜单工程矩阵（四象限） ---------- */
export type MatrixQuad = "star" | "plowhorse" | "puzzle" | "dog";

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
    hint: "畅销但价低，稳量提价",
  },
  puzzle: {
    title: "问题",
    color: "#a855f7",
    hint: "高价但滞销，加强推荐",
  },
  dog: {
    title: "瘦狗",
    color: "#71717a",
    hint: "既不畅销价又低，考虑下架",
  },
};
