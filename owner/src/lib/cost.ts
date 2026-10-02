import {
  itemName,
  itemQty,
  orderItems,
  orderTime,
  within,
  isCompleted,
  isCancelled,
  type Bounds,
} from "./analytics";
import {
  num,
  type InventoryItem,
  type InventoryTransaction,
  type RecipeBom,
} from "./inventory";
import { dayKey } from "./format";

/* ============ 营收口径 ============ */

/** 结账金额优先 finalTotal，回退 total / total_amount */
export function orderRevenue(o: any): number {
  return num(o?.finalTotal ?? o?.total ?? o?.total_amount);
}

/* ============ 菜品成本 ============ */

export function buildDishCostMap(
  boms: RecipeBom[],
  inventory: InventoryItem[],
): Map<string, number> {
  const priceMap = new Map(inventory.map((i) => [i.id, num(i.price)]));
  const map = new Map<string, number>();
  boms.forEach((b) => {
    const c = num(b.dosage) * (priceMap.get(b.inventory_item_id) ?? 0);
    map.set(b.menu_item_name, (map.get(b.menu_item_name) || 0) + c);
  });
  return map;
}

export function orderCogs(
  order: any,
  dishCost: Map<string, number>,
): { cogs: number; unknown: string[] } {
  let cogs = 0;
  const unknown: string[] = [];
  orderItems(order).forEach((it) => {
    const name = itemName(it);
    const has = dishCost.has(name);
    if (!has) unknown.push(name);
    cogs += (dishCost.get(name) || 0) * itemQty(it);
  });
  return { cogs, unknown };
}

/* ============ 成本毛利报表 ============ */

export interface DishMargin {
  name: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number; // 毛利率 %
  hasCost: boolean;
}

export interface CostReport {
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  orders: number;
  dishes: DishMargin[];
  unknownDishes: string[];
  daily: {
    key: string;
    label: string;
    revenue: number;
    cogs: number;
    profit: number;
  }[];
}

export function computeCostReport(
  allOrders: any[],
  boms: RecipeBom[],
  inventory: InventoryItem[],
  b: Bounds,
): CostReport {
  const dishCost = buildDishCostMap(boms, inventory);
  const orders = allOrders.filter((o) => within(o, b) && !isCancelled(o));

  const dishMap = new Map<string, DishMargin>();
  const unknownSet = new Set<string>();
  let revenue = 0;
  let cogs = 0;

  orders.forEach((o) => {
    const rev = orderRevenue(o);
    const { cogs: c, unknown } = orderCogs(o, dishCost);
    revenue += rev;
    cogs += c;
    unknown.forEach((u) => unknownSet.add(u));
    orderItems(o).forEach((it) => {
      const name = itemName(it);
      const qty = itemQty(it);
      const unitRev = num(it?.price) * qty;
      const unitCost = (dishCost.get(name) || 0) * qty;
      const e =
        dishMap.get(name) ||
        ({
          name,
          qty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          margin: 0,
          hasCost: dishCost.has(name),
        } as DishMargin);
      e.qty += qty;
      e.revenue += unitRev;
      e.cost += unitCost;
      dishMap.set(name, e);
    });
  });

  const dishes = Array.from(dishMap.values()).map((d) => {
    d.profit = d.revenue - d.cost;
    d.margin = d.revenue ? (d.profit / d.revenue) * 100 : 0;
    return d;
  });
  dishes.sort((a, c) => c.profit - a.profit);

  // 日趋势
  const dayMap = new Map<string, { revenue: number; cogs: number }>();
  orders.forEach((o) => {
    if (!isCompleted(o)) return;
    const k = dayKey(orderTime(o));
    if (!k) return;
    const { cogs: c } = orderCogs(o, dishCost);
    const e = dayMap.get(k) || { revenue: 0, cogs: 0 };
    e.revenue += orderRevenue(o);
    e.cogs += c;
    dayMap.set(k, e);
  });
  const daily = Array.from(dayMap.entries())
    .sort((a, c) => (a[0] < c[0] ? -1 : 1))
    .map(([key, v]) => ({
      key,
      label: key.slice(5),
      revenue: v.revenue,
      cogs: v.cogs,
      profit: v.revenue - v.cogs,
    }));

  const profit = revenue - cogs;
  return {
    revenue,
    cogs,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    orders: orders.length,
    dishes,
    unknownDishes: Array.from(unknownSet),
    daily,
  };
}

/** 由服务端聚合的菜品统计 + BOM 计算毛利（替代拉全量订单） */
export interface DishMarginInput {
  name: string;
  qty: number;
  revenue: number;
}

export function dishMargins(
  dishes: DishMarginInput[],
  boms: RecipeBom[],
  inventory: InventoryItem[],
): DishMargin[] {
  const cost = buildDishCostMap(boms, inventory);
  return dishes
    .map((d) => {
      const hasCost = cost.has(d.name);
      const c = (cost.get(d.name) || 0) * d.qty;
      const profit = d.revenue - c;
      return {
        name: d.name,
        qty: d.qty,
        revenue: d.revenue,
        cost: c,
        profit,
        margin: d.revenue ? (profit / d.revenue) * 100 : 0,
        hasCost,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

export function sumCost(margins: DishMargin[]): number {
  return margins.reduce((s, m) => s + m.cost, 0);
}

/* ============ 消耗 / 后厨用料 ============ */

export interface ConsumptionStat {
  key: string;
  qty: number; // 绝对值
  cost: number;
}

/** 按原料汇总消耗（含耗材），区间内 order_out */
export function consumptionByItem(
  txns: InventoryTransaction[],
  b: Bounds,
): ConsumptionStat[] {
  const map = new Map<string, ConsumptionStat>();
  txns
    .filter((t) => t.type === "order_out" && withinTxn(t, b))
    .forEach((t) => {
      const k = t.item_name || t.item_id;
      const e = map.get(k) || { key: k, qty: 0, cost: 0 };
      e.qty += Math.abs(num(t.quantity));
      e.cost += Math.abs(num(t.quantity)) * num(t.unit_cost);
      map.set(k, e);
    });
  return Array.from(map.values()).sort((a, c) => c.cost - a.cost);
}

/** 按菜品汇总消耗（notes 存菜品名） */
export function consumptionByDish(
  txns: InventoryTransaction[],
  b: Bounds,
): ConsumptionStat[] {
  const map = new Map<string, ConsumptionStat>();
  txns
    .filter((t) => t.type === "order_out" && withinTxn(t, b))
    .forEach((t) => {
      const k = t.notes || "未知";
      const e = map.get(k) || { key: k, qty: 0, cost: 0 };
      e.qty += Math.abs(num(t.quantity));
      e.cost += Math.abs(num(t.quantity)) * num(t.unit_cost);
      map.set(k, e);
    });
  return Array.from(map.values()).sort((a, c) => c.cost - a.cost);
}

/** 按天汇总消耗金额 */
export function consumptionByDay(
  txns: InventoryTransaction[],
  b: Bounds,
): { key: string; qty: number; cost: number }[] {
  const map = new Map<string, { qty: number; cost: number }>();
  txns
    .filter((t) => t.type === "order_out" && withinTxn(t, b))
    .forEach((t) => {
      const k = dayKey(t.created_at);
      if (!k) return;
      const e = map.get(k) || { qty: 0, cost: 0 };
      e.qty += Math.abs(num(t.quantity));
      e.cost += Math.abs(num(t.quantity)) * num(t.unit_cost);
      map.set(k, e);
    });
  return Array.from(map.entries())
    .sort((a, c) => (a[0] < c[0] ? -1 : 1))
    .map(([key, v]) => ({ key, ...v }));
}

export function wasteStats(
  txns: InventoryTransaction[],
  b: Bounds,
): ConsumptionStat[] {
  const map = new Map<string, ConsumptionStat>();
  txns
    .filter((t) => t.type === "waste" && withinTxn(t, b))
    .forEach((t) => {
      const k = t.item_name || t.item_id;
      const e = map.get(k) || { key: k, qty: 0, cost: 0 };
      e.qty += Math.abs(num(t.quantity));
      e.cost += Math.abs(num(t.quantity)) * num(t.unit_cost);
      map.set(k, e);
    });
  return Array.from(map.values()).sort((a, c) => c.cost - a.cost);
}

function withinTxn(t: InventoryTransaction, b: Bounds): boolean {
  const ts = t.created_at ? new Date(t.created_at).getTime() : 0;
  return ts >= b.start && ts <= b.end;
}
